/* Poll Post Studio - plain HTML/CSS/JS + Gemini API (free-tier models, Google Search grounding) */

const $ = (id) => document.getElementById(id);
const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models/";
const DISCLAIMER_SI = "කරුණාකර එකිනෙකාට ගරු කරමින් අදහස් දක්වන්න. 🙏";
const DISCLAIMER_FR = "Merci de commenter dans le respect de chacun. 🙏";

let usedModel = "";
let usedSearch = true;
let currentLang = "si";
let image = null; // { mime, data(base64), url }

/* ---------- toast ---------- */
let toastTimer;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 1800);
}

/* ---------- theme ---------- */
$("themeBtn").onclick = () => {
  const cur = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  const next = cur === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("theme", next); } catch {}
};

/* ---------- settings ---------- */
const DEFAULT_MODEL = "gemini-3.7-flash";
const VALID_MODELS = ["gemini-3.7-flash", "gemini-3.5-flash", "gemini-3-flash-preview", "gemini-2.5-flash"];
let savedModel = localStorage.getItem("gemini_model");
if (!VALID_MODELS.includes(savedModel)) { savedModel = DEFAULT_MODEL; localStorage.setItem("gemini_model", savedModel); }
const settings = $("settings");
$("apiKey").value = localStorage.getItem("gemini_key") || "";
$("model").value = savedModel;
$("modelInfo").textContent = "Model: " + savedModel;
$("settingsBtn").onclick = () => settings.showModal();
$("saveSettings").onclick = () => {
  localStorage.setItem("gemini_key", $("apiKey").value.trim());
  localStorage.setItem("gemini_model", $("model").value);
  $("modelInfo").textContent = "Model: " + $("model").value;
  settings.close();
  toast("Settings save වුණා");
};
if (!localStorage.getItem("gemini_key")) settings.showModal();

/* ---------- input: counter + screenshot (click, drop, paste) ---------- */
$("newsText").addEventListener("input", () => { $("counter").textContent = $("newsText").value.length + " අකුරු"; });

const drop = $("drop");
drop.onclick = () => $("file").click();
drop.onkeydown = (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); $("file").click(); } };
$("file").onchange = (e) => e.target.files[0] && setImage(e.target.files[0]);
drop.ondragover = (e) => { e.preventDefault(); drop.classList.add("over"); };
drop.ondragleave = () => drop.classList.remove("over");
drop.ondrop = (e) => {
  e.preventDefault(); drop.classList.remove("over");
  const f = e.dataTransfer.files[0];
  if (f && f.type.startsWith("image/")) setImage(f);
};
document.addEventListener("paste", (e) => {
  for (const item of e.clipboardData.items) {
    if (item.type.startsWith("image/")) { setImage(item.getAsFile()); e.preventDefault(); break; }
  }
});
$("clearImg").onclick = () => {
  image = null; $("preview").hidden = true; $("preview").removeAttribute("src");
  $("clearImg").hidden = true; $("dropText").hidden = false; $("dropIcon").style.display = ""; $("file").value = "";
};
function setImage(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const url = reader.result;
    image = { mime: file.type || "image/png", data: url.split(",")[1], url };
    $("preview").src = url; $("preview").hidden = false;
    $("dropText").hidden = true; $("dropIcon").style.display = "none"; $("clearImg").hidden = false;
  };
  reader.readAsDataURL(file);
}
const getLang = () => document.querySelector('input[name="lang"]:checked').value;

/* ---------- pipeline (left rail) ---------- */
// stage -1 = idle, 0..3 = that step is active (earlier ones done), 4 = all done
function setStage(n) {
  document.querySelectorAll("#pipeline li").forEach((li) => {
    const s = Number(li.dataset.stage);
    li.className = n < 0 ? "" : s < n ? "done" : s === n ? "active" : "";
  });
}
let stageTimer = null;
function startPipeline() {
  let stage = 1;
  setStage(stage);
  clearInterval(stageTimer);
  stageTimer = setInterval(() => { if (stage < 3) { stage++; setStage(stage); } }, 6000);
}
function stopPipeline() { clearInterval(stageTimer); }

/* ---------- prompt ---------- */
function systemPrompt(lang, grounded = true) {
  const fr = lang === "si_fr"
    ? "Write TITLE, CAPTION and CTA in Sinhala first, then add the same line in French right below it (new line). Keep both equally short. DISCLAIMER must also be given in Sinhala then French."
    : "Write TITLE, CAPTION, CTA and DISCLAIMER in Sinhala. The poll labels keep the French words Oui / Non.";

  const noSearch = grounded ? "" : `
IMPORTANT: Google Search is NOT available for this request, so you cannot verify the news. Set VERDICT to UNVERIFIED (never TRUE), and say in VERDICT_NOTE, in Sinhala, that live sources could not be checked and the user must verify manually before posting. Word the caption cautiously.
`;

  return `You are a professional social media manager who is fluent in Sinhala and French. You manage a Facebook/Instagram page.
${noSearch}
TASK
The user gives you a news item (text and/or a screenshot). Do three jobs:

JOB 1 - FACT CHECK: Use Google Search to check whether this news is real, comparing against reputable independent sources (news agencies, official sites, established newspapers). Decide the verdict honestly. If you cannot find reliable confirmation, say UNVERIFIED, never guess.

JOB 2 - FRENCH TRANSLATION: Translate the WHOLE news item faithfully into French (neutral journalistic register; do not add, remove or soften facts; keep names, numbers and dates exactly). Then proofread your own translation like a French copy editor: spelling and accents, gender/number agreement, verb conjugation and tenses, prepositions, natural phrasing, and French punctuation (a space before : ; ! ?). Output only the final corrected French. If the source is a screenshot, read its text first.

JOB 3 - POLL POST: Write a Poll post that creates engagement and has NO platform policy risk.

STRICT RULES FOR THE POST
1. Neutrality: take no side (political, religious, social). The poll question must be fair to both sides. No loaded words, insults, blame, graphic or hateful content, misinformation or clickbait.
2. High conciseness: no long paragraphs. CAPTION = exactly one sentence with the news + one sentence that is the poll question.
3. Respectful engagement: a respectful-comments disclaimer is mandatory.
4. If VERDICT is FALSE or UNVERIFIED, still write the post but word it cautiously ("reports say") and never present the claim as confirmed.
5. If the news is too sensitive for a safe poll (death, tragedy, violence, hate), set RISK to HIGH and explain in RISK_NOTE. Still give the safest neutral version.
6. The poll is answered with two reactions: 👍 Oui / ඔව්   |   ❤️ Non / නැත. Write the question so both answers are natural.

${fr}

OUTPUT FORMAT
Return ONLY these blocks, each starting with its marker line, with no markdown, no code fences and no extra text:
===VERDICT===
one of: TRUE | PARTLY_TRUE | UNVERIFIED | FALSE
===VERDICT_NOTE===
2-3 short Sinhala sentences explaining what you found
===RISK===
one of: LOW | MEDIUM | HIGH
===RISK_NOTE===
one short Sinhala sentence about policy risk
===TITLE===
short title with 1-2 simple functional emojis
===CAPTION===
sentence 1: the news summary. sentence 2: the poll question.
===CTA===
one short line asking people to comment
===DISCLAIMER===
one short line asking people to comment respectfully
===HASHTAGS===
5 to 7 relevant hashtags separated by spaces
===FR_NEWS===
the full corrected French translation of the news (keep paragraph breaks)
===FR_CHECK===
up to 4 lines, each starting with "- ", written in Sinhala, listing the grammar or spelling corrections you made to your first French draft; if there were none write one line: "- ගැටළු හමු වුණේ නෑ."`;
}

/* ---------- call Gemini (model + search fallbacks) ---------- */
async function callGemini(text, lang) {
  const key = localStorage.getItem("gemini_key");
  const chosen = localStorage.getItem("gemini_model") || DEFAULT_MODEL;
  const parts = [];
  if (text) parts.push({ text: "NEWS TEXT:\n" + text });
  if (image) {
    parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
    parts.push({ text: text ? "The image above is a screenshot of the same news." : "The image above is a screenshot of the news. Read it first." });
  }

  const models = [chosen, ...VALID_MODELS.filter((m) => m !== chosen)];
  // pass 1: every model WITH Google Search; pass 2: every model WITHOUT it (when free search quota is gone)
  const attempts = [
    ...models.map((m) => ({ model: m, search: true })),
    ...models.map((m) => ({ model: m, search: false }))
  ];

  let json = null, lastErr = "";
  for (const at of attempts) {
    const body = {
      system_instruction: { parts: [{ text: systemPrompt(lang, at.search) }] },
      contents: [{ role: "user", parts }]
    };
    if (at.search) body.tools = [{ google_search: {} }];
    let res, data;
    try {
      res = await fetch(`${API_BASE}${at.model}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(body)
      });
      data = await res.json();
    } catch (netErr) { throw new Error("Network error: " + netErr.message); }
    if (res.ok && data.candidates?.[0]) { json = data; usedModel = at.model; usedSearch = at.search; break; }
    lastErr = data?.error?.message || data?.promptFeedback?.blockReason || `HTTP ${res.status}`;
    const retryable = [429, 404, 400, 503].includes(res.status) ||
      /quota|exhausted|no longer available|not found|not supported|grounding|overloaded/i.test(lastErr);
    if (!retryable) throw new Error(lastErr);
  }
  if (!json) throw new Error("හැම free model එකකම quota ඉවරයි: " + lastErr.split("\n")[0] + " | https://ai.dev/rate-limit එකෙන් බලන්න, නැත්නම් පැය කිහිපයකින් try කරන්න.");

  const cand = json.candidates[0];
  const out = (cand.content?.parts || []).map((p) => p.text || "").join("");
  const chunks = cand.groundingMetadata?.groundingChunks || [];
  return { out, chunks };
}

function parseBlocks(raw) {
  const result = {};
  const re = /===([A-Z_]+)===\s*([\s\S]*?)(?=\n===[A-Z_]+===|$)/g;
  let m;
  while ((m = re.exec(raw)) !== null) result[m[1]] = m[2].trim();
  return result;
}

/* ---------- tabs ---------- */
const TABS = ["post", "fr", "src"];
function showTab(name) {
  TABS.forEach((t) => {
    const on = t === name;
    const btn = $("tab-" + t);
    btn.setAttribute("aria-selected", on);
    btn.tabIndex = on ? 0 : -1;
    $("pane-" + t).hidden = !on;
  });
}
document.querySelectorAll(".tabs button").forEach((b) => {
  b.onclick = () => showTab(b.dataset.tab);
  b.onkeydown = (e) => {
    const i = TABS.indexOf(b.dataset.tab);
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const n = TABS[(i + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length];
      showTab(n); $("tab-" + n).focus();
    }
  };
});

/* ---------- template check (live, updates while you edit) ---------- */
function updateChecks() {
  const caption = $("pCaption").textContent.trim();
  const sentences = caption.split(/(?<=[.!?。])\s+|\n+/).filter((s) => s.trim()).length;
  const maxSentences = currentLang === "si_fr" ? 4 : 2;
  const tags = ($("pTags").textContent.match(/#[^\s#]+/g) || []).length;
  const hasDisc = $("pDisc").textContent.trim().length > 5;
  const items = [
    [sentences <= maxSentences, "Caption කෙටියි (පුවත + ප්‍රශ්නය)", `Caption දිගයි (වාක්‍ය ${sentences})`],
    [true, "Poll: 👍 Oui / ඔව් - ❤️ Non / නැත", ""],
    [hasDisc, "ගරුත්ව Disclaimer එක තියෙනවා", "Disclaimer එක නෑ"],
    [tags >= 5 && tags <= 7, `Hashtags ${tags} (5-7 ඕනේ)`, `Hashtags ${tags} (5-7 ඕනේ)`]
  ];
  const ul = $("checks");
  ul.replaceChildren();
  items.forEach(([ok, good, bad]) => {
    const li = document.createElement("li");
    if (!ok) li.className = "warn";
    li.textContent = ok ? good : bad;
    ul.appendChild(li);
  });
}
["pTitle", "pCaption", "pCta", "pDisc", "pTags"].forEach((id) => $(id).addEventListener("input", updateChecks));

/* ---------- render ---------- */
const VERDICT = {
  TRUE: { label: "සත්‍යයි (Verified)", icon: "✓" },
  PARTLY_TRUE: { label: "අර්ධ වශයෙන් සත්‍යයි", icon: "!" },
  UNVERIFIED: { label: "තහවුරු කරගන්න බැරි වුණා", icon: "?" },
  FALSE: { label: "අසත්‍ය / ව්‍යාජ විය හැක", icon: "✕" }
};
const normVerdict = (v) => { const k = (v || "UNVERIFIED").replace(/[^A-Z_]/g, ""); return VERDICT[k] ? k : "UNVERIFIED"; };

function render(blocks, chunks, lang) {
  currentLang = lang;
  const verdict = normVerdict(blocks.VERDICT);
  $("verdict").className = "verdict v-" + verdict;
  $("verdictIcon").textContent = VERDICT[verdict].icon;
  $("verdictLabel").textContent = VERDICT[verdict].label;
  $("verdictNote").textContent = blocks.VERDICT_NOTE || "";
  const risk = (blocks.RISK || "").trim();
  $("riskNote").textContent = risk ? `Policy risk: ${risk}${blocks.RISK_NOTE ? " - " + blocks.RISK_NOTE : ""}` : "";

  // sources
  const list = $("sourceList");
  list.replaceChildren();
  const seen = new Set();
  chunks.forEach((c) => {
    const web = c.web;
    if (!web || !web.uri || seen.has(web.uri)) return;
    seen.add(web.uri);
    const title = web.title || web.uri;
    const li = document.createElement("li");
    const fav = document.createElement("span");
    fav.className = "fav"; fav.textContent = title.replace(/^(https?:\/\/)?(www\.)?/i, "").charAt(0) || "?";
    const a = document.createElement("a");
    a.href = web.uri; a.target = "_blank"; a.rel = "noopener"; a.textContent = title;
    const go = document.createElement("span");
    go.className = "go"; go.textContent = "Open ↗";
    li.append(fav, a, go);
    list.appendChild(li);
  });
  if (!seen.size) {
    const li = document.createElement("li");
    li.className = "none";
    li.textContent = usedSearch
      ? "Google Search එකෙන් මූලාශ්‍ර හොයාගන්න බැරි වුණා. පුවත තහවුරු වෙනකම් post නොකරන්න."
      : "Free Google Search quota එක ඉවරයි, ඒ නිසා live sources check කළේ නෑ. Post කරන්න කලින් විශ්වාසදායක site වල ඔයාම check කරන්න.";
    list.appendChild(li);
  }
  $("srcCount").textContent = seen.size;

  // post
  $("pTitle").textContent = blocks.TITLE || "";
  $("pCaption").textContent = blocks.CAPTION || "";
  $("pPoll").replaceChildren(...["👍 Oui / ඔව්", "❤️ Non / නැත"].map((t) => {
    const s = document.createElement("span"); s.textContent = t; return s;
  }));
  $("pCta").textContent = blocks.CTA || "💬 ඔබේ අදහස Comment කරන්න";
  // disclaimer is mandatory: fall back to a fixed line if the model skipped it
  let disc = blocks.DISCLAIMER && blocks.DISCLAIMER.trim() ? blocks.DISCLAIMER : DISCLAIMER_SI;
  if (lang === "si_fr" && !/[a-z]{4}/i.test(disc)) disc += "\n" + DISCLAIMER_FR;
  $("pDisc").textContent = disc;
  $("pTags").textContent = blocks.HASHTAGS || "";
  updateChecks();

  // French section
  const fr = blocks.FR_NEWS || "";
  $("frNews").textContent = fr || "(French translation එක ලැබුණේ නෑ. නැවත generate කරන්න.)";
  $("frWords").textContent = (fr.trim() ? fr.trim().split(/\s+/).length : 0) + " mots";
  const ul = $("frCheck");
  ul.replaceChildren();
  (blocks.FR_CHECK || "- ගැටළු හමු වුණේ නෑ.").split("\n").map((l) => l.replace(/^[-•*]\s*/, "").trim()).filter(Boolean).forEach((l) => {
    const li = document.createElement("li"); li.textContent = l; ul.appendChild(li);
  });

  $("runMeta").textContent = usedModel + (usedSearch ? " · Search ✔" : " · Search නැතුව");
  $("runMeta").hidden = !usedModel;
  $("empty").hidden = true;
  $("loading").hidden = true;
  $("result").hidden = false;
  showTab("post");
}

function postAsText() {
  return [
    $("pTitle").textContent.trim(), "",
    $("pCaption").textContent.trim(), "",
    "👍 Oui / ඔව්   |   ❤️ Non / නැත", "",
    $("pCta").textContent.trim(),
    $("pDisc").textContent.trim(), "",
    $("pTags").textContent.trim()
  ].join("\n");
}

/* ---------- history (last 12, stored in this browser) ---------- */
const HKEY = "ps_history";
const loadHist = () => { try { return JSON.parse(localStorage.getItem(HKEY)) || []; } catch { return []; } };
function saveHist(entry) {
  const h = loadHist();
  h.unshift(entry);
  try { localStorage.setItem(HKEY, JSON.stringify(h.slice(0, 12))); } catch {}
}
function openHistory() {
  const ul = $("historyList");
  ul.replaceChildren();
  const h = loadHist();
  if (!h.length) {
    const li = document.createElement("li");
    li.className = "none"; li.textContent = "තාම history නෑ.";
    ul.appendChild(li);
  }
  h.forEach((e) => {
    const li = document.createElement("li");
    const b = document.createElement("button");
    b.type = "button";
    const dot = document.createElement("span");
    dot.className = "vd " + normVerdict(e.blocks.VERDICT);
    const box = document.createElement("span");
    box.textContent = e.blocks.TITLE || "(no title)";
    const small = document.createElement("small");
    small.textContent = new Date(e.t).toLocaleString();
    box.appendChild(small);
    b.append(dot, box);
    b.onclick = () => {
      usedModel = e.model || ""; usedSearch = e.search !== false;
      render(e.blocks, e.chunks || [], e.lang || "si");
      setStage(4);
      $("historyDlg").close();
      toast("History එකෙන් load කළා");
    };
    li.appendChild(b);
    ul.appendChild(li);
  });
  $("historyDlg").showModal();
}
$("historyBtn").onclick = openHistory;
$("closeHist").onclick = () => $("historyDlg").close();
$("clearHist").onclick = () => { try { localStorage.removeItem(HKEY); } catch {} openHistory(); };

/* ---------- actions ---------- */
async function generate() {
  const text = $("newsText").value.trim();
  const status = $("status");
  status.className = "status";
  if (!localStorage.getItem("gemini_key")) { settings.showModal(); return; }
  if (!text && !image) { status.textContent = "පුවතක් paste කරන්න, නැත්නම් screenshot එකක් දාන්න."; status.classList.add("err"); return; }

  const lang = getLang();
  $("go").disabled = true; $("regen").disabled = true;
  status.textContent = "";
  $("empty").hidden = true; $("result").hidden = true; $("loading").hidden = false; $("runMeta").hidden = true;
  startPipeline();
  try {
    const { out, chunks } = await callGemini(text, lang);
    const blocks = parseBlocks(out);
    if (!blocks.TITLE && !blocks.CAPTION) throw new Error("Model එකෙන් format එක නිවැරදිව ආවේ නෑ. නැවත try කරන්න.");
    render(blocks, chunks, lang);
    setStage(4);
    $("modelInfo").textContent = "Model: " + usedModel + (usedSearch ? " (Search ✔)" : " (Search නැතුව)");
    saveHist({
      t: Date.now(), lang, model: usedModel, search: usedSearch, blocks,
      chunks: chunks.filter((c) => c.web && c.web.uri).map((c) => ({ web: { uri: c.web.uri, title: c.web.title || "" } }))
    });
  } catch (err) {
    $("loading").hidden = true;
    $("empty").hidden = false;
    setStage(-1);
    status.textContent = "Error: " + err.message;
    status.classList.add("err");
  } finally {
    stopPipeline();
    $("go").disabled = false; $("regen").disabled = false;
  }
}
$("go").onclick = generate;
$("regen").onclick = generate;

async function copyText(text, msg) {
  try { await navigator.clipboard.writeText(text); toast(msg); }
  catch { toast("Copy කරන්න බැරි වුණා"); }
}
$("copy").onclick = () => copyText(postAsText(), "Post එක copy වුණා ✔");
$("copyFr").onclick = () => copyText($("frNews").textContent, "French text එක copy වුණා ✔");

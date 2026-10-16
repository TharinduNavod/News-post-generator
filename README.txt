Poll Post Studio
================
(UI: left rail pipeline, dark/light theme, History, editable post preview, template check)
1. index.html එක browser එකේ open කරන්න (double click).
2. Settings එබුවම Gemini API key එක දාන්න (https://aistudio.google.com/apikey).
3. පුවත paste කරන්න, නැත්නම් screenshot එකක් drop / Ctrl+V කරන්න.
4. "Analyse & Generate" එබුවම result එක tab 3කින් පෙනෙනවා:
   - Post: Phone preview එකේ fixed template එකේ poll post එක (Title, Caption, Poll, CTA, Disclaimer, Hashtags)
   - Français: පුවත මුළුමනින්ම French වලට පරිවර්තනය කරලා grammar check කරපු text එක + කරපු නිවැරදි කිරීම්
   - Sources: Google Search එකෙන් ලැබුණු මූලාශ්‍ර links
   Verdict එක (සත්‍ය / තහවුරු නෑ / අසත්‍ය) tab වලට උඩින්ම පෙනෙනවා.

Free tier (billing නැතුව)
- Flash models විතරයි පාවිච්චි කරන්නේ. Model එකකට quota නැත්නම් ඊළඟ model එකට ඉබේම මාරු වෙනවා.
- Free Google Search quota එක ඉවරවුණොත් Search නැතුවම post එක හදනවා, ඒත් verdict එක UNVERIFIED විදියට යනවා.
- Usage බලන්න: https://ai.dev/rate-limit

Notes
- French grammar check එක AI proofreading එකක්. වැදගත් පුවතක් නම් post කරන්න කලින් French දන්න කෙනෙක්ට පෙන්වන්න.
- Post කරන්න කලින් source links ටික ඔයාම බලන්න.
- Public site එකක host කරනවා නම් API key එක browser එකට දාන එක safe නෑ; small backend (proxy) එකක් පාවිච්චි කරන්න.

Extra
- Header එකේ icons: History (අන්තිම post 12), Theme (light/dark), Settings.
- Post preview එකේ text click කරලා edit කරන්න පුළුවන්. Copy කරද්දී edit කරපු version එක යනවා.
- Template check: caption කෙටි ද, disclaimer තියෙනවාද, hashtags 5-7 ද කියලා ඉබේම බලනවා.

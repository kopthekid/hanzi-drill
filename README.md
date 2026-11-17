# Hanzi Drill

Practice the 1,000 characters from *Your First 1,000 Chinese Characters*. Works offline once it has been opened online one time.

- **Study**: browse cards in day order with each character's origin, parts, radical, traditional form and stroke-order animation. Swipe left or right.
- **Read**: see a character, pick its pinyin and meaning.
- **Recall**: see a meaning, pick the character and pinyin.
- **Write**: draw the character with your finger; each stroke is checked. Use "Parts hint" if you need it.

## Put it on GitHub Pages (about 5 minutes, easiest on a laptop or Chromebook)

1. Sign in at [github.com](https://github.com) (free account).
2. Click **+** (top right) → **New repository**. Name it `hanzi-drill`, set it to **Public**, and click **Create repository**. (Free GitHub Pages needs a public repository.)
3. On the new repository's page, click **uploading an existing file**.
4. Unzip `hanzi-drill.zip`. Open the `hanzi-drill` folder and drag **everything inside it** into the upload area, including the `strokes`, `icons` and `licenses` folders. Click **Commit changes**.
   - Check that `index.html` sits at the top level of the repository, not inside another folder.
   - `.nojekyll` is a hidden file. If it doesn't upload, the app still works.
5. Go to **Settings** → **Pages**. Under **Build and deployment**, set **Source** to **Deploy from a branch**, pick **main** and **/ (root)**, and click **Save**.
6. Wait a minute or two, then open `https://YOUR-USERNAME.github.io/hanzi-drill/`.

## Install it on your phone

1. Open the link above on your phone while you have internet.
2. Wait until **Available offline** appears under the title on the start screen. That means all 1,000 characters and their stroke data are saved on the phone.
3. Add it to your home screen:
   - **Android (Chrome)**: ⋮ menu → **Add to Home screen** or **Install app**.
   - **iPhone (Safari)**: Share button → **Add to Home Screen**.
4. Open it from the home screen icon. It now works in airplane mode.

## Updating later

If you change any file, open `sw.js` and bump the version (`hanzi-drill-v2` → `hanzi-drill-v3`), then upload the changed files. Phones fetch the new version the next time they open the app with internet, and use it from the launch after that.

## Notes

- Your progress (which characters you miss) is saved on each device separately. On iPhone, the home screen app and Safari also keep separate progress.
- "Hear it" uses your device's built-in Chinese voice. If you don't hear anything, install a Chinese (Mandarin) voice in your phone's text-to-speech settings.

## Credits

- Stroke order and stroke checking: [Hanzi Writer](https://hanziwriter.org) (MIT) and [hanzi-writer-data](https://github.com/chanind/hanzi-writer-data), derived from Make Me a Hanzi and the Arphic PL fonts (Arphic Public License).
- Character origins, parts and radicals: [Make Me a Hanzi](https://github.com/skishore/makemeahanzi) `dictionary.txt` (LGPL), plus hand-written notes for 113 characters that dataset leaves without an origin.
- Traditional forms: [OpenCC](https://github.com/BYVoid/OpenCC) (Apache 2.0).
- License texts are in the `licenses` folder.

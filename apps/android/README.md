# Localmod Android

Each React app is an **independent APK**. Install only the ones you want. They sit side by side on the phone (`com.localmod.blackwhale`, `com.localmod.nightweaver`, …). An APK will not install on Windows.

## Independent install — repeat for every APK

Do these five steps **once per file**. Installing Nightweaver does not replace Blackwhale.

1. **Download that APK** from GitHub Releases (or double-click `Install-Android.bat` on Windows, or `apps/<app>/Install-Android.bat` for one app).
2. **Copy the file to the phone** (USB cable, Google Drive, or Files). Do not open `.apk` on a PC.
3. On the phone: **Settings → Apps → Special app access → Install unknown apps** → choose **Files** (or Chrome) → **Allow**.
4. Open **Files**, tap that `.apk`, then **Install**.
5. Open that app from the launcher.

| File | App | Package |
|---|---|---|
| [blackwhale.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/blackwhale.apk) | Chat | `com.localmod.blackwhale` |
| [nightweaver.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/nightweaver.apk) | Agentic coding | `com.localmod.nightweaver` |
| [obsidian.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/obsidian.apk) | API keys | `com.localmod.obsidian` |
| [mako.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/mako.apk) | Speed / race | `com.localmod.mako` |
| [trench.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/trench.apk) | Editor | `com.localmod.trench` |
| [ironmantis.apk](https://github.com/mrsmitg/ai-app-dev/releases/latest/download/ironmantis.apk) | Autonomous builder | `com.localmod.ironmantis` |

Full local GGUF inference still runs on Windows / macOS / Linux.

```bash
npm install
npm run build:android
```

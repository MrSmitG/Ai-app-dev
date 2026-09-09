# Localmod Android

Sideload **Localmod.apk** from GitHub Releases. The APK is the React UI in a WebView (About, Suite, settings). Full local inference still runs on Windows / macOS / Linux.

```bash
npm install
npm --prefix apps/desktop install
npm run build:android
```

Output: `release/Localmod.apk`

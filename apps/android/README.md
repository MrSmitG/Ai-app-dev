# Localmod Android

Sideload **one APK per React app** from GitHub Releases. Each APK is that app’s UI in a WebView. They install side by side (`com.localmod.blackwhale`, `com.localmod.nightweaver`, …). Full local inference still runs on Windows / macOS / Linux.

| APK | App |
|---|---|
| `blackwhale.apk` | Chat |
| `nightweaver.apk` | Agentic coding |
| `obsidian.apk` | API keys |
| `mako.apk` | Speed / race |
| `trench.apk` | Editor |
| `ironmantis.apk` | Autonomous builder |

```bash
npm install
npm run build:android
```

Output:

```
release/blackwhale.apk
release/nightweaver.apk
release/obsidian.apk
release/mako.apk
release/trench.apk
release/ironmantis.apk
```

const { app, BrowserWindow, shell, Menu, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");

const isDev = !app.isPackaged;
const ENGINE_PORT = Number(process.env.LOCALMOD_ENGINE_PORT || 4781);
const UI_PORT = Number(process.env.LOCALMOD_UI_PORT || 1420);

let mainWindow = null;
let splashWindow = null;
let engineProc = null;

function engineEntry() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "engine", "src", "index.js");
  }
  return path.join(__dirname, "../../../packages/engine/src/index.js");
}

function engineCwd() {
  if (app.isPackaged) return path.join(process.resourcesPath, "engine");
  return path.resolve(__dirname, "../../..");
}

function waitForUrl(url, timeoutMs = 90000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode < 500) resolve();
        else if (Date.now() - start > timeoutMs) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(tick, 400);
      });
      req.on("error", () => {
        if (Date.now() - start > timeoutMs) reject(new Error(`Timeout waiting for ${url}`));
        else setTimeout(tick, 400);
      });
    };
    tick();
  });
}

function healthOk() {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${ENGINE_PORT}/health`, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(1500, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function startEngine() {
  const entry = engineEntry();
  const cwd = engineCwd();
  const logFile = path.join(app.getPath("userData"), "engine.log");
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const logFd = fs.openSync(logFile, "a");
  const env = {
    ...process.env,
    LOCALMOD_ENGINE_PORT: String(ENGINE_PORT),
    LOCALMOD_HOME: process.env.LOCALMOD_HOME || path.join(app.getPath("home"), ".localmod"),
  };
  let cmd = "node";
  const args = [entry];
  if (app.isPackaged) {
    cmd = process.execPath;
    env.ELECTRON_RUN_AS_NODE = "1";
    env.NODE_PATH = path.join(cwd, "node_modules");
  }
  engineProc = spawn(cmd, args, {
    cwd,
    env,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });
  engineProc.on("exit", (code) => {
    console.log(`Localmod engine exited (${code})`);
    engineProc = null;
  });
}

async function ensureEngine() {
  if (process.env.LOCALMOD_EXTERNAL_ENGINE === "1" || (await healthOk())) {
    console.log(`Engine already on http://127.0.0.1:${ENGINE_PORT}`);
    await waitForUrl(`http://127.0.0.1:${ENGINE_PORT}/health`);
    return;
  }
  startEngine();
  await waitForUrl(`http://127.0.0.1:${ENGINE_PORT}/health`);
}

function showSplash() {
  splashWindow = new BrowserWindow({
    width: 420,
    height: 220,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    backgroundColor: "#0c0f14",
    show: true,
  });
  const html = encodeURIComponent(`<!doctype html><html><body style="margin:0;background:#0c0f14;color:#e8e4dc;font-family:Segoe UI,system-ui,sans-serif;display:grid;place-items:center;height:100vh">
    <div style="text-align:center">
      <div style="font-size:28px;font-weight:800;letter-spacing:.04em;color:#ff9f43">Localmod</div>
      <div style="margin-top:12px;opacity:.75">Starting on this machine…</div>
    </div>
  </body></html>`);
  splashWindow.loadURL(`data:text/html;charset=utf-8,${html}`);
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

async function createWindow() {
  const isMac = process.platform === "darwin";
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1024,
    minHeight: 700,
    title: "Localmod",
    backgroundColor: "#0c0f14",
    show: false,
    autoHideMenuBar: !isMac,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow?.show();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  if (isDev) {
    await waitForUrl(`http://127.0.0.1:${UI_PORT}/`);
    await mainWindow.loadURL(`http://127.0.0.1:${UI_PORT}/`);
  } else {
    await mainWindow.loadFile(path.join(__dirname, "../dist/index.html"));
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const template = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: "about" },
              { type: "separator" },
              { role: "services" },
              { type: "separator" },
              { role: "hide" },
              { role: "hideOthers" },
              { role: "unhide" },
              { type: "separator" },
              { role: "quit" },
            ],
          },
        ]
      : []),
    {
      label: "File",
      submenu: [isMac ? { role: "close" } : { role: "quit" }],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Window",
      submenu: [
        { role: "minimize" },
        { role: "zoom" },
        ...(isMac ? [{ type: "separator" }, { role: "front" }] : [{ role: "close" }]),
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

app.setName("Localmod");
if (process.platform === "win32") {
  app.setAppUserModelId("com.localmod.app");
}

app.whenReady().then(async () => {
  buildMenu();
  showSplash();
  try {
    await ensureEngine();
    await createWindow();
  } catch (err) {
    closeSplash();
    dialog.showErrorBox(
      "Localmod",
      `Could not start the local engine.\n\n${err.message || err}\n\nLogs: ${path.join(app.getPath("userData"), "engine.log")}`
    );
    app.quit();
  }

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0) await createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (engineProc && !engineProc.killed) {
    try {
      engineProc.kill();
    } catch {
      /* ignore */
    }
  }
});

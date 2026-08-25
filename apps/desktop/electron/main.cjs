const { app, BrowserWindow, shell, Menu } = require("electron");
const path = require("node:path");
const { spawn } = require("node:child_process");
const http = require("node:http");

const isDev = !app.isPackaged;
const ENGINE_PORT = Number(process.env.LOCALMOD_ENGINE_PORT || 4781);
const UI_PORT = Number(process.env.LOCALMOD_UI_PORT || 1420);

let mainWindow = null;
let engineProc = null;

function repoRoot() {
  if (app.isPackaged) {
    // resources/app.asar or resources/app → go up to resources then include unpacked engine
    return process.resourcesPath;
  }
  // apps/desktop/electron → repo root
  return path.resolve(__dirname, "../../..");
}

function engineEntry() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "engine", "src", "index.js");
  }
  return path.join(repoRoot(), "packages", "engine", "src", "index.js");
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
  const cwd = app.isPackaged ? process.resourcesPath : repoRoot();
  engineProc = spawn("node", [entry], {
    cwd,
    env: { ...process.env, LOCALMOD_ENGINE_PORT: String(ENGINE_PORT) },
    stdio: "inherit",
    shell: true,
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

  mainWindow.once("ready-to-show", () => mainWindow?.show());

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

app.whenReady().then(async () => {
  buildMenu();
  try {
    await ensureEngine();
    await createWindow();
  } catch (err) {
    console.error(err);
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

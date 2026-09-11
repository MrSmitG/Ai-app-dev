const { app, BrowserWindow, shell, Menu, dialog, ipcMain, utilityProcess } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const { spawn } = require("node:child_process");
const http = require("node:http");
const { pathToFileURL } = require("node:url");

const isDev = !app.isPackaged;
const ENGINE_PORT = Number(process.env.LOCALMOD_ENGINE_PORT || 4781);
const UI_PORT = Number(process.env.LOCALMOD_UI_PORT || 1420);

const SUITE = [
  { id: "blackwhale", name: "Blackwhale", port: 1421 },
  { id: "nightweaver", name: "Nightweaver", port: 1422 },
  { id: "obsidian", name: "Obsidian", port: 1423 },
  { id: "mako", name: "Mako", port: 1424 },
  { id: "trench", name: "The Trench", port: 1425 },
  { id: "ironmantis", name: "Ironmantis", port: 1426 },
];

let mainWindow = null;
let splashWindow = null;
let engineProc = null;
let engineStartError = null;
const servers = [];
const suiteWindows = new Map();
let uiPort = UI_PORT;

const UI_MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".map": "application/json",
};

function requestedApps(argv = process.argv) {
  const ids = [];
  for (const a of argv) {
    if (String(a).startsWith("--app=")) ids.push(String(a).slice(6).toLowerCase());
  }
  if (!ids.length) {
    const bundled = bundledSuiteId();
    if (bundled) ids.push(bundled);
  }
  return ids;
}

function bundledSuiteId() {
  const candidates = [];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, "suite-app.txt"));
  candidates.push(path.join(__dirname, "suite-app.txt"));
  for (const file of candidates) {
    try {
      if (fs.existsSync(file)) {
        const id = String(fs.readFileSync(file, "utf8") || "").trim().toLowerCase();
        if (suiteById(id)) return id;
      }
    } catch {
      /* ignore */
    }
  }
  const base = path.basename(process.execPath, path.extname(process.execPath)).toLowerCase().replace(/\s+/g, "");
  if (base && base !== "localmod" && base !== "electron") {
    const spec =
      suiteById(base) || SUITE.find((s) => s.name.toLowerCase().replace(/\s+/g, "") === base);
    if (spec) return spec.id;
  }
  return "";
}

function suiteById(id) {
  return SUITE.find((a) => a.id === id || a.name.toLowerCase() === String(id || "").toLowerCase());
}

function suiteByPort(port) {
  return SUITE.find((a) => a.port === Number(port));
}

function uiDist() {
  return path.join(__dirname, "../dist/client");
}

function suiteRoot() {
  if (app.isPackaged) return path.join(process.resourcesPath, "suite");
  return path.join(__dirname, "../../../build/suite-pack");
}

function suiteDist(spec) {
  return path.join(suiteRoot(), spec.id);
}

function suiteIndex(spec) {
  return path.join(suiteDist(spec), "index.html");
}

function probeUrl(url, timeoutMs = 800) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(Boolean(res.statusCode && res.statusCode < 500));
    });
    req.on("error", () => resolve(false));
    req.setTimeout(timeoutMs, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function listenStatic(dist, preferredPort) {
  const index = path.join(dist, "index.html");
  if (!fs.existsSync(index)) {
    return Promise.reject(new Error(`Packaged React app missing at ${dist}`));
  }
  const handler = (req, res) => {
    try {
      const u = new URL(req.url || "/", "http://127.0.0.1");
      let rel = decodeURIComponent(u.pathname);
      if (rel === "/" || !rel) rel = "index.html";
      else rel = rel.replace(/^\/+/, "");
      const root = path.resolve(dist);
      let file = path.resolve(root, rel);
      if (file !== root && !file.startsWith(root + path.sep)) {
        res.writeHead(403);
        res.end();
        return;
      }
      if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
        file = index;
      }
      const ext = path.extname(file);
      res.writeHead(200, { "Content-Type": UI_MIME[ext] || "application/octet-stream" });
      fs.createReadStream(file).pipe(res);
    } catch (err) {
      res.writeHead(500);
      res.end(String(err.message || err));
    }
  };
  const bind = (port) =>
    new Promise((resolve, reject) => {
      const server = http.createServer(handler);
      const onError = (err) => {
        try {
          server.close();
        } catch {
          /* ignore */
        }
        reject(err);
      };
      server.once("error", onError);
      server.listen(port, "127.0.0.1", () => {
        server.off("error", onError);
        servers.push(server);
        resolve({ server, port: server.address().port, reused: false });
      });
    });
  return (async () => {
    try {
      return await bind(preferredPort);
    } catch (err) {
      if (err.code === "EADDRINUSE" || err.code === "EACCES") {
        if (await probeUrl(`http://127.0.0.1:${preferredPort}/`)) {
          return { server: null, port: preferredPort, reused: true };
        }
        return bind(0);
      }
      throw err;
    }
  })();
}

async function startPackagedUi() {
  if (isDev) return;
  try {
    const hub = await listenStatic(uiDist(), UI_PORT);
    uiPort = hub.port;
  } catch (err) {
    console.error("Hub static server failed:", err.message || err);
  }
  const wanted = requestedApps();
  const apps = wanted.length ? SUITE.filter((s) => wanted.includes(s.id)) : SUITE;
  for (const spec of apps) {
    const dist = suiteDist(spec);
    if (!fs.existsSync(path.join(dist, "index.html"))) {
      console.log(`Suite pack missing ${spec.id} at ${dist}`);
      continue;
    }
    try {
      const bound = await listenStatic(dist, spec.port);
      spec.livePort = bound.port;
    } catch (err) {
      console.error(`Suite static server failed ${spec.id}:`, err.message || err);
    }
  }
}

function engineLogPath() {
  return path.join(app.getPath("userData"), "engine.log");
}

function appendEngineLog(text) {
  try {
    const file = engineLogPath();
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.appendFileSync(file, `${new Date().toISOString()} ${text}\n`);
  } catch {
    /* ignore */
  }
}

function readEngineLogTail(max = 4000) {
  try {
    const buf = fs.readFileSync(engineLogPath(), "utf8");
    return buf.slice(-max);
  } catch {
    return "";
  }
}

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

function engineEnv() {
  return {
    ...process.env,
    LOCALMOD_ENGINE: "1",
    LOCALMOD_ENGINE_PORT: String(ENGINE_PORT),
    LOCALMOD_HOME: process.env.LOCALMOD_HOME || path.join(app.getPath("home"), ".localmod"),
    NODE_PATH: path.join(engineCwd(), "node_modules"),
  };
}

function waitForUrl(url, timeoutMs = 20000) {
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
      req.setTimeout(2000, () => {
        req.destroy();
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

function startEngineChild() {
  const entry = engineEntry();
  const cwd = engineCwd();
  const logFile = engineLogPath();
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
  const logFd = fs.openSync(logFile, "a");
  const env = engineEnv();
  let cmd = "node";
  const args = [entry];
  if (app.isPackaged) {
    cmd = process.execPath;
    env.ELECTRON_RUN_AS_NODE = "1";
  }
  appendEngineLog(`spawn ${cmd} ${args.join(" ")} cwd=${cwd}`);
  engineProc = spawn(cmd, args, {
    cwd,
    env,
    stdio: ["ignore", logFd, logFd],
    windowsHide: true,
  });
  engineProc.on("error", (err) => {
    appendEngineLog(`spawn error: ${err.message || err}`);
  });
  engineProc.on("exit", (code) => {
    appendEngineLog(`engine child exited (${code})`);
    engineProc = null;
  });
}

async function startEngineUtility(entry) {
  if (!utilityProcess || typeof utilityProcess.fork !== "function") {
    startEngineChild();
    return;
  }
  appendEngineLog(`utilityProcess.fork ${entry}`);
  const child = utilityProcess.fork(entry, [], {
    cwd: engineCwd(),
    stdio: "pipe",
    serviceName: "localmod-engine",
    env: engineEnv(),
  });
  engineProc = child;
  const logFile = engineLogPath();
  const pipe = (stream) => {
    if (!stream) return;
    stream.on("data", (d) => {
      try {
        fs.appendFileSync(logFile, d);
      } catch {
        /* ignore */
      }
    });
  };
  pipe(child.stdout);
  pipe(child.stderr);
  child.on("exit", (code) => {
    appendEngineLog(`utility engine exited (${code})`);
    engineProc = null;
  });
}

async function startEngineInProcess() {
  const entry = engineEntry();
  if (!fs.existsSync(entry)) {
    throw new Error(`Engine files are missing at ${entry}`);
  }
  process.env.LOCALMOD_ENGINE_PORT = String(ENGINE_PORT);
  if (!process.env.LOCALMOD_HOME) {
    process.env.LOCALMOD_HOME = path.join(app.getPath("home"), ".localmod");
  }
  const extra = path.join(engineCwd(), "node_modules");
  if (fs.existsSync(extra)) {
    const Module = require("module");
    process.env.NODE_PATH = [extra, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
    Module._initPaths();
  }
  appendEngineLog(`import engine ${entry}`);
  const mod = await import(pathToFileURL(entry).href);
  if (typeof mod.startEngine !== "function") {
    throw new Error("Engine pack did not export startEngine");
  }
  await mod.startEngine(ENGINE_PORT);
}

async function startEnginePackaged() {
  try {
    await startEngineInProcess();
    if (await healthOk()) return;
    appendEngineLog("in-process engine imported but /health is not up");
  } catch (err) {
    appendEngineLog(`in-process engine failed: ${err?.stack || err}`);
  }
  try {
    await startEngineUtility(engineEntry());
  } catch (err) {
    appendEngineLog(`utility engine failed: ${err?.stack || err}`);
    startEngineChild();
  }
}

async function ensureEngine() {
  if (process.env.LOCALMOD_EXTERNAL_ENGINE === "1" || (await healthOk())) {
    appendEngineLog(`Engine already on http://127.0.0.1:${ENGINE_PORT}`);
    await waitForUrl(`http://127.0.0.1:${ENGINE_PORT}/health`);
    return;
  }
  if (app.isPackaged) await startEnginePackaged();
  else startEngineChild();
  await waitForUrl(`http://127.0.0.1:${ENGINE_PORT}/health`, 25000);
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
      <div style="font-size:28px;font-weight:800;letter-spacing:.04em;color:#ff9f43">${app.getName()}</div>
      <div style="margin-top:12px;opacity:.75">Starting on this machine…</div>
    </div>
  </body></html>`);
  splashWindow.loadURL(`data:text/html;charset=utf-8,${html}`);
}

function closeSplash() {
  if (splashWindow && !splashWindow.isDestroyed()) splashWindow.close();
  splashWindow = null;
}

function attachOpenHandler(win) {
  win.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const u = new URL(url);
      if (u.hostname === "127.0.0.1" || u.hostname === "localhost") {
        const spec = suiteByPort(u.port);
        if (spec) {
          openSuiteWindow(spec);
          return { action: "deny" };
        }
      }
    } catch {
      /* fall through */
    }
    shell.openExternal(url);
    return { action: "deny" };
  });
}

function browserPrefs() {
  return {
    preload: path.join(__dirname, "preload.cjs"),
    contextIsolation: true,
    nodeIntegration: false,
    sandbox: true,
  };
}

async function createHubWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.focus();
    return mainWindow;
  }
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
    webPreferences: browserPrefs(),
  });

  mainWindow.once("ready-to-show", () => {
    closeSplash();
    mainWindow?.show();
  });
  attachOpenHandler(mainWindow);

  if (isDev) {
    await waitForUrl(`http://127.0.0.1:${UI_PORT}/`);
    await mainWindow.loadURL(`http://127.0.0.1:${UI_PORT}/`);
  } else {
    const hubIndex = path.join(uiDist(), "index.html");
    if (fs.existsSync(hubIndex) && !(await probeUrl(`http://127.0.0.1:${uiPort}/`))) {
      await mainWindow.loadFile(hubIndex);
    } else {
      await waitForUrl(`http://127.0.0.1:${uiPort}/`);
      await mainWindow.loadURL(`http://127.0.0.1:${uiPort}/`);
    }
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
  return mainWindow;
}

async function openSuiteWindow(spec) {
  if (!spec) return;
  const existing = suiteWindows.get(spec.id);
  if (existing && !existing.isDestroyed()) {
    existing.focus();
    return existing;
  }
  if (!isDev) {
    const index = suiteIndex(spec);
    if (!fs.existsSync(index)) {
      dialog.showErrorBox(
        spec.name,
        `This React app is not in this install (${suiteDist(spec)}).\nDownload the latest ${spec.name}-Setup.exe from GitHub Releases.`
      );
      return;
    }
  }
  const isMac = process.platform === "darwin";
  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 800,
    minHeight: 560,
    title: spec.name,
    backgroundColor: "#0c0f14",
    show: false,
    autoHideMenuBar: !isMac,
    titleBarStyle: isMac ? "hiddenInset" : "default",
    webPreferences: browserPrefs(),
  });
  win.once("ready-to-show", () => {
    closeSplash();
    win.show();
  });
  attachOpenHandler(win);
  if (isDev) {
    await waitForUrl(`http://127.0.0.1:${spec.port}/`);
    await win.loadURL(`http://127.0.0.1:${spec.port}/`);
  } else {
    await win.loadFile(suiteIndex(spec));
  }
  suiteWindows.set(spec.id, win);
  win.on("closed", () => suiteWindows.delete(spec.id));
  return win;
}

async function openRequested(ids) {
  const wanted = (ids || []).map(suiteById).filter(Boolean);
  if (!wanted.length) {
    await createHubWindow();
    return;
  }
  for (const spec of wanted) await openSuiteWindow(spec);
}

function buildMenu() {
  const isMac = process.platform === "darwin";
  const appsMenu = {
    label: "Apps",
    submenu: [
      {
        label: "Localmod hub",
        click: () => {
          createHubWindow().catch(() => {});
        },
      },
      { type: "separator" },
      ...SUITE.map((spec) => ({
        label: spec.name,
        click: () => {
          openSuiteWindow(spec).catch(() => {});
        },
      })),
    ],
  };
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
    appsMenu,
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
  const bundled = bundledSuiteId();
  const spec = bundled ? suiteById(bundled) : null;
  if (spec) app.setName(spec.name);
  app.setAppUserModelId(spec ? `com.localmod.${spec.id}` : "com.localmod.app");
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_event, argv) => {
    openRequested(requestedApps(argv)).catch((err) => console.error(err));
  });

  ipcMain.handle("localmod:openSuite", async (_event, id) => {
    const spec = suiteById(id);
    if (!spec) return { ok: false };
    await openSuiteWindow(spec);
    return { ok: true, id: spec.id };
  });

  app.whenReady().then(async () => {
    buildMenu();
    showSplash();
    try {
      try {
        await ensureEngine();
      } catch (err) {
        appendEngineLog(`ensureEngine failed: ${err?.stack || err}`);
        engineStartError = err;
      }
      if (!isDev) await startPackagedUi();
      await openRequested(requestedApps());
      closeSplash();
      if (engineStartError) {
        const log = readEngineLogTail();
        dialog.showMessageBox({
          type: "warning",
          title: app.getName() || "Localmod",
          message: "The local engine did not start. The app window is open; chat and models need the engine.",
          detail: `${engineStartError.message || engineStartError}\n\nLogs: ${engineLogPath()}\n\n${log}`,
        }).catch(() => {});
      }
    } catch (err) {
      closeSplash();
      const msg = String(err.message || err);
      const title = app.getName() || "Localmod";
      const log = readEngineLogTail();
      dialog.showErrorBox(
        title,
        `${msg}\n\nLogs: ${engineLogPath()}\n\n${log}`
      );
      app.quit();
    }

    app.on("activate", async () => {
      if (BrowserWindow.getAllWindows().length === 0) await openRequested(requestedApps());
    });
  });
}

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

app.on("before-quit", () => {
  if (engineProc && !engineProc.killed) {
    try {
      if (typeof engineProc.kill === "function") engineProc.kill();
    } catch {
      /* ignore */
    }
  }
  for (const server of servers) {
    try {
      server.close();
    } catch {
      /* ignore */
    }
  }
});

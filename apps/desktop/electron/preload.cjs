const { ipcRenderer, contextBridge } = require("electron");

contextBridge.exposeInMainWorld("localmodDesktop", {
  platform: process.platform,
  isDesktop: true,
  openSuite: (id) => ipcRenderer.invoke("localmod:openSuite", String(id || "")),
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});

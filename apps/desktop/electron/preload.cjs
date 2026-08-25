const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("localmodDesktop", {
  platform: process.platform,
  isDesktop: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});

import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../..");
const desktop = path.join(repo, "apps/desktop/src");

export default defineConfig({
  plugins: [react()],
  root: here,
  resolve: {
    alias: {
      "@": desktop,
      react: path.join(repo, "node_modules/react"),
      "react-dom": path.join(repo, "node_modules/react-dom"),
    },
  },
  server: {
    port: 1423,
    strictPort: true,
    host: "127.0.0.1",
    open: false,
    fs: { allow: [repo] },
    proxy: {
      "^/engine(/|$)": {
        target: "http://127.0.0.1:4781",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine/, "") || "/",
      },
    },
  },
});

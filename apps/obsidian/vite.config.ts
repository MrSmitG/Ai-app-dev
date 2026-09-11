import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const dir = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(dir, "../..");

export default defineConfig({
  plugins: [react()],
  base: "./",
  root: dir,
  resolve: {
    alias: {
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
        rewrite: (p: string) => p.replace(/^\/engine/, "") || "/",
      },
    },
  },
});

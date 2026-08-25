import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  // Relative base so Electron can load file:// dist/index.html on Mac & Windows
  base: "./",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 1420,
    strictPort: true,
    host: "127.0.0.1",
    open: false,
    proxy: {
      "/engine": {
        target: "http://127.0.0.1:4781",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine/, ""),
      },
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: true,
  },
});

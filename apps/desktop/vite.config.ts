import { reactRouter } from "@react-router/dev/vite";
import path from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [reactRouter()],
  clearScreen: false,
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
});

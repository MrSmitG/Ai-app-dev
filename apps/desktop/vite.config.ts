import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: false,
    open: true,
    proxy: {
      "/engine": {
        target: "http://127.0.0.1:4781",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/engine/, ""),
      },
    },
  },
});

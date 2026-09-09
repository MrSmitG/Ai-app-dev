import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export function suiteVite(appDir: string, port: number) {
  const repo = path.resolve(appDir, "../..");
  return defineConfig({
    plugins: [react()],
    root: appDir,
    resolve: {
      alias: {
        "@suite": path.join(repo, "packages/suite-kit/src"),
        "@desktop": path.join(repo, "apps/desktop/src"),
        react: path.join(repo, "node_modules/react"),
        "react-dom": path.join(repo, "node_modules/react-dom"),
      },
    },
    server: {
      port,
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
}

export function hereDir(metaUrl: string) {
  return path.dirname(fileURLToPath(metaUrl));
}

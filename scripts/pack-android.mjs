#!/usr/bin/env node
/** Build one APK per suite React app into release/blackwhale.apk … */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const android = path.join(root, "apps", "android");
const assets = path.join(android, "app", "src", "main", "assets");
const mipmap = path.join(android, "app", "src", "main", "res", "mipmap-xxxhdpi");
const outDir = path.join(root, "release");
const wrapperJar = path.join(android, "gradle", "wrapper", "gradle-wrapper.jar");
const viteJs = path.join(root, "node_modules", "vite", "bin", "vite.js");

const APPS = [
  { id: "blackwhale", name: "Blackwhale", folder: "apps/blackwhale" },
  { id: "nightweaver", name: "Nightweaver", folder: "apps/nightweaver" },
  { id: "obsidian", name: "Obsidian", folder: "apps/obsidian" },
  { id: "mako", name: "Mako", folder: "apps/mako" },
  { id: "trench", name: "The Trench", folder: "apps/trench" },
  { id: "ironmantis", name: "Ironmantis", folder: "apps/ironmantis" },
];

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, npm_config_update_notifier: "false" } });
}

if (!existsSync(wrapperJar)) {
  mkdirSync(path.dirname(wrapperJar), { recursive: true });
  run(
    `curl -fsSL -o "${wrapperJar}" https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar`
  );
}

if (!existsSync(viteJs)) {
  console.error("Run npm install at the repo root first.");
  process.exit(1);
}

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.HOME || "", "Android", "Sdk");
if (!existsSync(sdk)) {
  console.error("Android SDK not found. Set ANDROID_HOME (GitHub Actions does this in the Release workflow).");
  process.exit(1);
}
writeFileSync(path.join(android, "local.properties"), `sdk.dir=${String(sdk).replace(/\\/g, "\\\\")}\n`);

mkdirSync(mipmap, { recursive: true });
const icon = path.join(root, "apps", "desktop", "build", "icon.png");
if (existsSync(icon)) cpSync(icon, path.join(mipmap, "ic_launcher.png"));

const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
  : "java";

mkdirSync(outDir, { recursive: true });

for (const app of APPS) {
  const appDir = path.join(root, app.folder);
  const dist = path.join(appDir, "dist");
  console.log(`\nBuilding ${app.name} (${app.id}.apk) …`);
  const ui = spawnSync(process.execPath, [viteJs, "build", "--base", "./"], { cwd: appDir, stdio: "inherit" });
  if (ui.status !== 0) process.exit(ui.status || 1);
  if (!existsSync(path.join(dist, "index.html"))) {
    throw new Error(`${app.folder}/dist/index.html missing`);
  }

  rmSync(assets, { recursive: true, force: true });
  mkdirSync(assets, { recursive: true });
  cpSync(dist, assets, { recursive: true });
  writeFileSync(path.join(assets, ".gitkeep"), "");

  const gradle = spawnSync(
    java,
    [
      "-classpath",
      wrapperJar,
      "org.gradle.wrapper.GradleWrapperMain",
      ":app:assembleRelease",
      `-PsuiteApp=${app.id}`,
      `-PsuiteName=${app.name}`,
    ],
    { cwd: android, stdio: "inherit", env: process.env }
  );
  if (gradle.status !== 0) process.exit(gradle.status || 1);

  const built = path.join(android, "app", "build", "outputs", "apk", "release", "app-release.apk");
  if (!existsSync(built)) throw new Error(`Gradle did not produce app-release.apk for ${app.id}`);
  const apkOut = path.join(outDir, `${app.id}.apk`);
  cpSync(built, apkOut);
  console.log("Wrote", apkOut);
}

console.log("\nAPKs:");
for (const app of APPS) console.log(`  release/${app.id}.apk`);

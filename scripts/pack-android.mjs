#!/usr/bin/env node
/** Build Localmod.apk (React UI in an Android WebView) into release/. */
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { execSync, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const android = path.join(root, "apps", "android");
const assets = path.join(android, "app", "src", "main", "assets");
const mipmap = path.join(android, "app", "src", "main", "res", "mipmap-xxxhdpi");
const dist = path.join(root, "apps", "desktop", "dist", "client");
const outDir = path.join(root, "release");
const apkOut = path.join(outDir, "Localmod.apk");
const wrapperJar = path.join(android, "gradle", "wrapper", "gradle-wrapper.jar");

function run(cmd, cwd = root) {
  execSync(cmd, { cwd, stdio: "inherit", env: { ...process.env, npm_config_update_notifier: "false" } });
}

if (!existsSync(wrapperJar)) {
  mkdirSync(path.dirname(wrapperJar), { recursive: true });
  run(
    `curl -fsSL -o "${wrapperJar}" https://raw.githubusercontent.com/gradle/gradle/v8.9.0/gradle/wrapper/gradle-wrapper.jar`
  );
}

console.log("Building React UI …");
run("npm --prefix apps/desktop run build");
if (!existsSync(path.join(dist, "index.html"))) {
  throw new Error("Desktop UI build missing apps/desktop/dist/client/index.html");
}

rmSync(assets, { recursive: true, force: true });
mkdirSync(assets, { recursive: true });
cpSync(dist, assets, { recursive: true });
writeFileSync(path.join(assets, ".gitkeep"), "");

mkdirSync(mipmap, { recursive: true });
const icon = path.join(root, "apps", "desktop", "build", "icon.png");
if (existsSync(icon)) cpSync(icon, path.join(mipmap, "ic_launcher.png"));

const sdk = process.env.ANDROID_HOME || process.env.ANDROID_SDK_ROOT || path.join(process.env.HOME || "", "Android", "Sdk");
if (!existsSync(sdk)) {
  console.error("Android SDK not found. Set ANDROID_HOME (GitHub Actions does this in the Release workflow).");
  process.exit(1);
}
writeFileSync(path.join(android, "local.properties"), `sdk.dir=${String(sdk).replace(/\\/g, "\\\\")}\n`);

console.log("Packaging Localmod.apk …");
const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, "bin", process.platform === "win32" ? "java.exe" : "java")
  : "java";
const gradle = spawnSync(
  java,
  ["-classpath", wrapperJar, "org.gradle.wrapper.GradleWrapperMain", ":app:assembleRelease", "--no-daemon"],
  { cwd: android, stdio: "inherit", env: process.env }
);
if (gradle.status !== 0) process.exit(gradle.status || 1);

const built = path.join(android, "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(built)) throw new Error("Gradle did not produce app-release.apk");
mkdirSync(outDir, { recursive: true });
cpSync(built, apkOut);
console.log("Wrote", apkOut);

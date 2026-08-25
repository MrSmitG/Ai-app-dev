import os from "node:os";
import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

async function nvidia() {
  try {
    const { stdout } = await execFileAsync(
      "nvidia-smi",
      ["--query-gpu=name,memory.total,memory.used", "--format=csv,noheader,nounits"],
      { timeout: 2500, windowsHide: true }
    );
    return stdout
      .trim()
      .split(/\n/)
      .filter(Boolean)
      .map((line) => {
        const [name, total, used] = line.split(",").map((s) => s.trim());
        return { name, vramTotalMb: Number(total), vramUsedMb: Number(used) };
      });
  } catch {
    return [];
  }
}

export async function hardwareSnapshot() {
  const gpus = await nvidia();
  const totalMb = Math.round(os.totalmem() / 1024 / 1024);
  const freeMb = Math.round(os.freemem() / 1024 / 1024);
  const vramTotal = gpus.reduce((a, g) => a + (g.vramTotalMb || 0), 0);
  return {
    platform: process.platform,
    arch: process.arch,
    cpus: os.cpus().length,
    cpuModel: os.cpus()[0]?.model || "CPU",
    ramTotalMb: totalMb,
    ramUsedMb: totalMb - freeMb,
    gpus,
    vramTotalMb: vramTotal,
    backendHint:
      process.platform === "darwin"
        ? process.arch === "arm64"
          ? "metal"
          : "cpu"
        : gpus.length
          ? "cuda"
          : process.platform === "linux"
            ? "vulkan"
            : "cpu",
    mlxAvailable: process.platform === "darwin" && process.arch === "arm64",
  };
}

export function fitEstimate({ fileSizeBytes, ramTotalMb, vramTotalMb, gpuLayers }) {
  const sizeMb = (fileSizeBytes || 0) / 1024 / 1024;
  const weightsMb = sizeMb * 1.05;
  const needRam = weightsMb + 512;
  const offload = Math.max(0, Math.min(1, (gpuLayers ?? 0) / 99));
  const needVram = vramTotalMb ? weightsMb * offload + 256 : 0;
  const ramOk = needRam < ramTotalMb * 0.85;
  const vramOk = !vramTotalMb || needVram < vramTotalMb * 0.9;
  return {
    sizeMb: Math.round(sizeMb),
    needRamMb: Math.round(needRam),
    needVramMb: Math.round(needVram),
    ramOk,
    vramOk,
    fits: ramOk && vramOk,
    note: vramTotalMb
      ? `Offload ${Math.round(offload * 100)}% of weights to GPU`
      : "CPU-only estimate (no NVIDIA SMI VRAM)",
  };
}

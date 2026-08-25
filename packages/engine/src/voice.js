import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn, execFileSync } from "node:child_process";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { getSettings } from "./settings.js";
import { dataDir } from "./paths.js";

const execFileAsync = promisify(execFile);

export const TRANSCRIBE_MODES = [
  {
    id: "webspeech",
    name: "Browser speech",
    blurb: "Web Speech API in Chrome/Edge. Fast; may need network.",
    local: false,
  },
  {
    id: "whisper",
    name: "Local Whisper (CLI)",
    blurb: "Runs whisper.cpp / whisper-cli on this PC. Fully offline.",
    local: true,
  },
];

export const OUTPUT_MODES = [
  { id: "fill", name: "Fill input", blurb: "Replace the chat box with the transcript." },
  { id: "append", name: "Append to input", blurb: "Add the transcript to the end of the chat box." },
  { id: "send", name: "Send as message", blurb: "Put transcript in chat and send immediately." },
  { id: "preview", name: "Preview only", blurb: "Show transcript first; you choose Fill / Append / Send." },
];

function whisperOnPath() {
  const names = process.platform === "win32" ? ["whisper-cli.exe", "whisper-cli"] : ["whisper-cli"];
  for (const name of names) {
    try {
      execFileSync(process.platform === "win32" ? "where" : "which", [name], {
        stdio: "ignore",
        windowsHide: true,
      });
      return name;
    } catch {
      /* try next */
    }
  }
  return "";
}

function resolveWhisperBin() {
  const s = getSettings();
  const candidates = [
    s.whisperCliPath,
    process.env.LOCALMOD_WHISPER,
    path.join(dataDir(), "bin", process.platform === "win32" ? "whisper-cli.exe" : "whisper-cli"),
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return whisperOnPath();
}

export function voiceStatus() {
  const s = getSettings();
  const bin = resolveWhisperBin();
  return {
    mode: s.voiceTranscribeMode || "webspeech",
    output: s.voiceOutputMode || "fill",
    lang: s.voiceLang || "en-US",
    whisperCliPath: s.whisperCliPath || "",
    whisperModel: s.whisperModel || "",
    modes: TRANSCRIBE_MODES,
    outputs: OUTPUT_MODES,
    whisperReady: Boolean(bin),
    whisperBin: bin || null,
  };
}

/**
 * Transcribe base64 audio with local Whisper CLI.
 * body: { audioBase64, mimeType?, language? }
 */
export async function transcribeWhisper(body) {
  const bin = resolveWhisperBin();
  if (!bin) {
    throw new Error("Whisper CLI not found. Set Options → Voice → whisper-cli path (whisper.cpp).");
  }
  const s = getSettings();
  const b64 = String(body.audioBase64 || "").replace(/^data:[^;]+;base64,/, "");
  if (!b64) throw new Error("No audio payload");
  const buf = Buffer.from(b64, "base64");
  const tmpDir = path.join(os.tmpdir(), "localmod-voice");
  fs.mkdirSync(tmpDir, { recursive: true });
  const ext = (body.mimeType || "").includes("webm")
    ? "webm"
    : (body.mimeType || "").includes("mp4") || (body.mimeType || "").includes("m4a")
      ? "mp4"
      : "wav";
  const inFile = path.join(tmpDir, `in-${Date.now()}.${ext}`);
  const outBase = path.join(tmpDir, `out-${Date.now()}`);
  fs.writeFileSync(inFile, buf);

  // Prefer WAV for whisper.cpp — try ffmpeg convert when browser sends webm
  let audioFile = inFile;
  if (ext === "webm" || ext === "mp4") {
    const wavFile = path.join(tmpDir, `in-${Date.now()}.wav`);
    try {
      await execFileAsync(
        "ffmpeg",
        ["-y", "-i", inFile, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavFile],
        { timeout: 60000, windowsHide: true }
      );
      if (fs.existsSync(wavFile)) audioFile = wavFile;
    } catch {
      /* keep original; may still work on some builds */
    }
  }

  const args = ["-f", audioFile, "-otxt", "-of", outBase];
  if (s.whisperModel && fs.existsSync(s.whisperModel)) {
    args.unshift("-m", s.whisperModel);
  }
  const lang = body.language || (s.voiceLang || "en").split("-")[0];
  if (lang) args.push("-l", lang);

  try {
    await execFileAsync(bin, args, { timeout: 180000, windowsHide: true, maxBuffer: 10 * 1024 * 1024 });
  } catch (err) {
    // Some builds use different flags; try minimal invoke
    if (!String(err.message || "").includes("ENOENT")) {
      try {
        await new Promise((resolve, reject) => {
          const child = spawn(bin, args, { windowsHide: true });
          let errOut = "";
          child.stderr?.on("data", (d) => {
            errOut += d.toString();
          });
          child.on("error", reject);
          child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(errOut || `whisper exit ${code}`))));
        });
      } catch (e2) {
        throw new Error(`Whisper failed: ${e2.message || err.message}`);
      }
    } else {
      throw new Error(`Whisper binary not runnable: ${bin}`);
    }
  }

  const txtFile = outBase + ".txt";
  if (!fs.existsSync(txtFile)) {
    // fallback: look for any txt next to outBase
    const dirFiles = fs.readdirSync(tmpDir).filter((f) => f.startsWith(path.basename(outBase)) && f.endsWith(".txt"));
    if (!dirFiles.length) {
      throw new Error(
        ext === "webm"
          ? "Whisper produced no transcript. Install ffmpeg on PATH (converts WebM→WAV), or use Browser speech for mic input."
          : "Whisper produced no transcript file. Check model path and audio format (wav works best)."
      );
    }
    const text = fs.readFileSync(path.join(tmpDir, dirFiles[0]), "utf8").trim();
    cleanup([inFile, ...dirFiles.map((f) => path.join(tmpDir, f))]);
    return { text, mode: "whisper", lang };
  }
  const text = fs.readFileSync(txtFile, "utf8").trim();
  cleanup([inFile, audioFile !== inFile ? audioFile : null, txtFile].filter(Boolean));
  return { text, mode: "whisper", lang };
}

function cleanup(files) {
  for (const f of files) {
    try {
      fs.unlinkSync(f);
    } catch {
      /* ignore */
    }
  }
}

import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { Icon, LabelWithTip, Tip } from "./ui";

type VoiceStatus = {
  mode: string;
  output: string;
  lang: string;
  modes: { id: string; name: string; blurb: string; local: boolean }[];
  outputs: { id: string; name: string; blurb: string }[];
  whisperReady?: boolean;
};

type Props = {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
  onTranscript: (text: string, outputMode: string) => void;
  setError: (s: string) => void;
  disabled?: boolean;
};

function getSpeechRecognition(): any {
  const w = window as any;
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function VoiceControls({ settings, patch, onTranscript, setError, disabled }: Props) {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [listening, setListening] = useState(false);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState(false);
  const recRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const mode = settings.voiceTranscribeMode || status?.mode || "webspeech";
  const output = settings.voiceOutputMode || status?.output || "fill";
  const lang = settings.voiceLang || status?.lang || "en-US";

  useEffect(() => {
    api<VoiceStatus>("/voice")
      .then(setStatus)
      .catch(() =>
        setStatus({
          mode: "webspeech",
          output: "fill",
          lang: "en-US",
          modes: [
            { id: "webspeech", name: "Browser speech", blurb: "Web Speech API", local: false },
            { id: "whisper", name: "Local Whisper (CLI)", blurb: "whisper.cpp", local: true },
          ],
          outputs: [
            { id: "fill", name: "Fill input", blurb: "" },
            { id: "append", name: "Append to input", blurb: "" },
            { id: "send", name: "Send as message", blurb: "" },
            { id: "preview", name: "Preview only", blurb: "" },
          ],
        })
      );
  }, [settings.voiceTranscribeMode, settings.voiceOutputMode, settings.whisperCliPath]);

  function deliver(text: string, forceOutput?: string) {
    const clean = text.trim();
    if (!clean) return;
    const out = forceOutput || output;
    if (out === "preview") {
      setPreview(clean);
      return;
    }
    setPreview("");
    onTranscript(clean, out);
  }

  function stopAll() {
    try {
      recRef.current?.stop?.();
    } catch {
      /* ignore */
    }
    recRef.current = null;
    if (mediaRef.current && mediaRef.current.state !== "inactive") {
      mediaRef.current.stop();
    }
    mediaRef.current = null;
    setListening(false);
  }

  async function startWebSpeech() {
    const SR = getSpeechRecognition();
    if (!SR) {
      setError("Browser speech is not supported here. Use Edge/Chrome or switch to Local Whisper.");
      return;
    }
    if (settings.airplane) {
      setError("Airplane mode is on — Browser speech often needs network. Use Local Whisper for offline.");
    }
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (ev: any) => {
      let interim = "";
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const t = ev.results[i][0].transcript;
        if (ev.results[i].isFinal) finalText += t;
        else interim += t;
      }
      setPreview((finalText + " " + interim).trim());
    };
    rec.onerror = (ev: any) => {
      setListening(false);
      setError(ev.error === "not-allowed" ? "Microphone permission denied." : `Speech error: ${ev.error}`);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) deliver(finalText);
    };
    recRef.current = rec;
    setPreview("");
    setListening(true);
    rec.start();
  }

  async function startWhisperRecord() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const rec = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size) chunksRef.current.push(e.data);
      };
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setListening(false);
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        if (!blob.size) {
          setError("No audio captured.");
          return;
        }
        setBusy(true);
        try {
          const audioBase64 = await blobToBase64(blob);
          const r = await api<{ text: string }>("/voice/transcribe", {
            method: "POST",
            body: JSON.stringify({
              audioBase64,
              mimeType: blob.type,
              language: lang,
            }),
          });
          deliver(r.text || "");
          if (!r.text) setError("Whisper returned empty text.");
        } catch (e: any) {
          setError(e.message || "Whisper transcription failed.");
        } finally {
          setBusy(false);
        }
      };
      mediaRef.current = rec;
      setPreview("Recording… click Stop when done");
      setListening(true);
      rec.start();
    } catch (e: any) {
      setError(e.message || "Microphone access failed.");
    }
  }

  async function toggleMic() {
    if (listening) {
      if (mode === "whisper" && mediaRef.current) mediaRef.current.stop();
      else stopAll();
      return;
    }
    setError("");
    if (mode === "whisper") await startWhisperRecord();
    else await startWebSpeech();
  }

  return (
    <div className="voice-bar">
      <div className="row voice-row">
        <label className="voice-select">
          <LabelWithTip tip="How audio becomes text. Browser speech is quick; Local Whisper stays offline.">Transcribe</LabelWithTip>
          <select
            value={mode}
            onChange={(e) => patch({ voiceTranscribeMode: e.target.value })}
            disabled={listening || busy}
          >
            {(status?.modes || []).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </label>
        <label className="voice-select">
          <LabelWithTip tip="What happens after transcription succeeds.">Output</LabelWithTip>
          <select value={output} onChange={(e) => patch({ voiceOutputMode: e.target.value })} disabled={listening || busy}>
            {(status?.outputs?.length
              ? status.outputs
              : [
                  { id: "fill", name: "Fill input", blurb: "" },
                  { id: "append", name: "Append to input", blurb: "" },
                  { id: "send", name: "Send as message", blurb: "" },
                  { id: "preview", name: "Preview only", blurb: "" },
                ]
            ).map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <label className="voice-select narrow">
          <LabelWithTip tip="Recognition language tag, e.g. en-US, hi-IN.">Lang</LabelWithTip>
          <input value={lang} onChange={(e) => patch({ voiceLang: e.target.value })} disabled={listening || busy} list="voice-langs" />
          <datalist id="voice-langs">
            {["en-US", "en-GB", "hi-IN", "mr-IN", "es-ES", "fr-FR", "de-DE", "ja-JP", "zh-CN"].map((l) => (
              <option key={l} value={l} />
            ))}
          </datalist>
        </label>
        <button
          className={`btn mic-btn ${listening ? "recording" : ""} ${busy ? "busy" : ""}`}
          disabled={disabled || busy}
          onClick={toggleMic}
          title={listening ? "Stop listening" : mode === "whisper" ? "Hold session: click to record, click again to stop & transcribe" : "Start voice input"}
        >
          <Icon name={listening ? "stop" : "mic"} />
          {busy ? "Transcribing…" : listening ? (mode === "whisper" ? "Stop & transcribe" : "Listening…") : "Voice"}
        </button>
        <Tip
          text={
            mode === "whisper"
              ? "Records audio, then runs local Whisper CLI. Set whisper-cli path and model under Options → Voice."
              : "Uses the browser Web Speech API. Best in Chrome/Edge. May need network unless your OS packs offline speech packs."
          }
        />
      </div>
      {(preview || listening || busy) && (
        <div className={`voice-preview ${listening ? "live" : ""}`}>
          <span className="section-label">Transcript</span>
          <div>{preview || (busy ? "Running Whisper…" : "…")}</div>
          {output === "preview" && preview && !listening && !busy && (
            <div className="row">
              <button className="btn" onClick={() => onTranscript(preview, "fill")}>
                Fill input
              </button>
              <button className="btn" onClick={() => onTranscript(preview, "append")}>
                Append
              </button>
              <button className="btn primary" onClick={() => onTranscript(preview, "send")}>
                Send
              </button>
              <button className="btn ghost" onClick={() => setPreview("")}>
                Clear
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read audio"));
    reader.readAsDataURL(blob);
  });
}

export function VoiceSettingsPanel({
  settings,
  patch,
}: {
  settings: any;
  patch: (p: Record<string, unknown>) => Promise<any>;
}) {
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  useEffect(() => {
    api<VoiceStatus>("/voice").then(setStatus).catch(() => setStatus(null));
  }, [settings.whisperCliPath, settings.whisperModel, settings.voiceTranscribeMode]);

  return (
    <div className="stack">
      <div className="panel">
        <div className="panel-title">
          <LabelWithTip tip="Default transcription engine for the Chat mic button.">Transcription mode</LabelWithTip>
        </div>
        <select value={settings.voiceTranscribeMode || "webspeech"} onChange={(e) => patch({ voiceTranscribeMode: e.target.value })}>
          {(status?.modes || [
            { id: "webspeech", name: "Browser speech" },
            { id: "whisper", name: "Local Whisper (CLI)" },
          ]).map((m: any) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>
        <div className="muted tiny">
          {(status?.modes || []).find((m) => m.id === (settings.voiceTranscribeMode || "webspeech"))?.blurb}
        </div>
      </div>
      <div className="panel">
        <div className="panel-title">
          <LabelWithTip tip="What Chat does with finished transcripts.">Output mode</LabelWithTip>
        </div>
        <select value={settings.voiceOutputMode || "fill"} onChange={(e) => patch({ voiceOutputMode: e.target.value })}>
          {(status?.outputs || []).map((o) => (
            <option key={o.id} value={o.id}>
              {o.name}
            </option>
          ))}
        </select>
        <div className="muted tiny">
          {(status?.outputs || []).find((o) => o.id === (settings.voiceOutputMode || "fill"))?.blurb}
        </div>
      </div>
      <label>
        <LabelWithTip tip="BCP-47 language, e.g. en-US or hi-IN.">Language</LabelWithTip>
        <input value={settings.voiceLang || "en-US"} onChange={(e) => patch({ voiceLang: e.target.value })} />
      </label>
      <label>
        <LabelWithTip tip="Path to whisper.cpp whisper-cli (or main) binary.">Whisper CLI path</LabelWithTip>
        <input
          value={settings.whisperCliPath || ""}
          onChange={(e) => patch({ whisperCliPath: e.target.value })}
          placeholder="C:\whisper.cpp\build\bin\whisper-cli.exe"
        />
      </label>
      <label>
        <LabelWithTip tip="Path to a ggml Whisper model file, e.g. ggml-base.en.bin">Whisper model file</LabelWithTip>
        <input
          value={settings.whisperModel || ""}
          onChange={(e) => patch({ whisperModel: e.target.value })}
          placeholder="C:\models\ggml-base.en.bin"
        />
      </label>
      <div className="muted">
        Whisper ready: {status?.whisperReady ? "yes (binary found)" : "set CLI path (and model) for offline mode"}
      </div>
    </div>
  );
}

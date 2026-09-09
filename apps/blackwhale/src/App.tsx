import { FormEvent, useEffect, useRef, useState } from "react";
import { api, streamChat } from "./engine";

type Msg = { role: "user" | "assistant"; content: string };

export default function App() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [engineOk, setEngineOk] = useState(true);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    document.title = "Blackwhale";
    const tick = async () => {
      try {
        setSettings(await api<Record<string, unknown>>("/settings"));
        setEngineOk(true);
      } catch {
        setEngineOk(false);
      }
    };
    tick();
    const t = setInterval(tick, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send(e?: FormEvent) {
    e?.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    const next: Msg[] = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
    setMessages(next);
    setInput("");
    setBusy(true);
    setSendErr("");
    try {
      await streamChat(
        {
          messages: next.filter((m) => m.content),
          provider: settings.provider || "llama",
          model: settings.loadedModel,
        },
        (tok) => {
          next[next.length - 1].content += tok;
          setMessages([...next]);
        }
      );
      await api("/chats", {
        method: "POST",
        body: JSON.stringify({
          threads: [{ id: "blackwhale", title: "Blackwhale", messages: next, main: true }],
        }),
      }).catch(() => {});
    } catch (err: unknown) {
      setSendErr(err instanceof Error ? err.message : "Blackwhale could not reach a model.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bw">
      <header className="bw-mark">
        <h1>Blackwhale</h1>
        <span>
          <i className={`bw-live ${engineOk ? "" : "off"}`} />
          {engineOk ? "sounding" : "engine dark"}
        </span>
      </header>
      <div className="bw-stream">
        {messages.length === 0 && <p className="bw-empty">The basin is still. Send the first ping.</p>}
        {messages.map((m, i) => (
          <article key={i} className={`bw-msg ${m.role}`}>
            <div className="bw-who">{m.role === "user" ? "Surface" : "Blackwhale"}</div>
            <div>{m.content || (busy && i === messages.length - 1 ? "…" : "")}</div>
          </article>
        ))}
        <div ref={end} />
      </div>
      {sendErr && <div className="bw-err">{sendErr}</div>}
      <div className="bw-dock">
        <form onSubmit={send}>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Speak into the dark…"
            aria-label="Message"
          />
          <button type="submit" disabled={busy}>
            {busy ? "Sounding" : "Send"}
          </button>
        </form>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from "react";
import { AppShell } from "@suite/shell";
import { api, streamChat } from "@suite/api";
import { useEngine } from "@suite/useEngine";

export default function App() {
  const { settings, err } = useEngine();
  const [messages, setMessages] = useState<{ role: string; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [sendErr, setSendErr] = useState("");
  const end = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    end.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, busy]);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    const next = [...messages, { role: "user", content: text }, { role: "assistant", content: "" }];
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
    } catch (e: any) {
      setSendErr(e.message || "Blackwhale could not reach a model.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell appId="blackwhale" error={err}>
      <section className="view flow-in">
        <div className="panel spotlight">
          <div className="hero-kicker">Blackwhale · chat only</div>
          <h2 className="owner-name">Deep-sea communication hub.</h2>
          <p className="muted">This React app’s only job is conversation. Keys, code, and CLI live in the other five apps.</p>
        </div>
        {sendErr && <div className="banner">{sendErr}</div>}
        <div className="panel blackwhale-stream">
          {messages.length === 0 && <p className="muted">The water is still. Send the first ping.</p>}
          {messages.map((m, i) => (
            <div key={i} className={`msg ${m.role}`}>
              <div className="suite-usage">{m.role === "user" ? "You" : "Blackwhale"}</div>
              <div>{m.content || (busy && i === messages.length - 1 ? "…" : "")}</div>
            </div>
          ))}
          <div ref={end} />
        </div>
        <div className="panel">
          <label>
            Message
            <div className="row">
              <input
                className="grow"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Speak into the dark…"
              />
              <button className="btn primary" disabled={busy} type="button" onClick={send}>
                {busy ? "Sounding…" : "Send"}
              </button>
            </div>
          </label>
        </div>
      </section>
    </AppShell>
  );
}

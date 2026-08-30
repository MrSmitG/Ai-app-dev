import { useMemo, useState } from "react";
import { Tip } from "./ui";
import {
  PRODUCT,
  WEB3,
  explorerAddressUrl,
  explorerTxUrl,
  getEthereum,
  isHexAddress,
  sendEth,
  shortAddr,
} from "../web3";

const PRESETS = ["0.001", "0.01", "0.05"];
const OUTBOX_KEY = "localmod.web3.outbox";

type OutboxItem = { hash: string; kind: "donate" | "message"; note: string; at: number };

function loadOutbox(): OutboxItem[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    const rows = raw ? JSON.parse(raw) : [];
    return Array.isArray(rows) ? rows.slice(0, 12) : [];
  } catch {
    return [];
  }
}

function saveOutbox(rows: OutboxItem[]) {
  localStorage.setItem(OUTBOX_KEY, JSON.stringify(rows.slice(0, 12)));
}

export function Web3Support({
  compact = false,
  onOpen,
}: {
  compact?: boolean;
  onOpen?: () => void;
}) {
  const to = WEB3.address;
  const ready = isHexAddress(to);
  const ens = WEB3.ens;
  const [amount, setAmount] = useState("0.01");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [outbox, setOutbox] = useState<OutboxItem[]>(() => loadOutbox());
  const hasWallet = useMemo(() => Boolean(getEthereum()), []);

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied.");
      setError("");
    } catch {
      setError("Could not copy.");
    }
  }

  async function run(kind: "donate" | "message") {
    setError("");
    setStatus("");
    if (!ready) {
      setError("The Localmod wallet is not published yet. Donate and messages unlock once the account address is set.");
      return;
    }
    const valueEth = kind === "donate" ? amount : "0";
    const data = note.trim();
    if (kind === "donate" && (!amount || Number(amount) <= 0)) {
      setError("Enter an ETH amount to donate.");
      return;
    }
    if (kind === "message" && !data) {
      setError("Write a short message to send on-chain.");
      return;
    }
    setBusy(true);
    try {
      const { hash } = await sendEth({
        to,
        valueEth,
        data: data || undefined,
      });
      const row: OutboxItem = { hash, kind, note: data || `${amount} ETH`, at: Date.now() };
      const next = [row, ...outbox].slice(0, 12);
      setOutbox(next);
      saveOutbox(next);
      setStatus(`${kind === "donate" ? "Donation" : "Message"} sent · ${shortAddr(hash)}`);
      if (kind === "message") setNote("");
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/wallet_switchEthereumChain|Unrecognized chain/i.test(msg)) {
        setError(`Switch your wallet to ${WEB3.networkName} and retry.`);
      } else {
        setError(msg);
      }
    } finally {
      setBusy(false);
    }
  }

  if (compact) {
    return (
      <div className="owner-card compact">
        <div className="section-label">Support</div>
        <div className="owner-name">Web3</div>
        <div className="muted tiny">{ready ? (ens || shortAddr(to)) : "Wallet account coming soon"}</div>
        <div className="owner-links">
          <button className="btn owner-link" type="button" onClick={onOpen}>
            Donate or message
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="panel owner-panel flow-in">
      <div className="owner-hero">
        <div className="owner-avatar" aria-hidden>
          Lm
        </div>
        <div>
          <div className="hero-kicker">
            About <Tip text="Product info only. Support uses a public Web3 wallet — no personal profile." />
          </div>
          <h2 className="owner-name">{PRODUCT.name}</h2>
          <div className="muted">Local-first studio</div>
          <div className="muted tiny">{WEB3.networkName} · donate & on-chain notes</div>
        </div>
      </div>
      <p className="owner-blurb">{PRODUCT.blurb}</p>

      <div className="web3-box">
        <div className="panel-title">Support via Web3</div>
        <p className="muted">
          Donate ETH or send a public on-chain message to the Localmod account. Messages are stored in the
          transaction data and are visible on the explorer — they are not private chat.
        </p>
        {ready ? (
          <div className="web3-addr">
            <div>
              <div className="muted tiny">{ens ? "ENS" : "Wallet"}</div>
              <div className="mono">{ens || to}</div>
              {ens && <div className="mono muted tiny">{shortAddr(to)}</div>}
            </div>
            <div className="owner-links">
              <button className="btn" type="button" onClick={() => copy(ens || to)}>
                Copy
              </button>
              <a className="btn" href={explorerAddressUrl(to)} target="_blank" rel="noreferrer">
                Explorer
              </a>
            </div>
          </div>
        ) : (
          <div className="banner">
            The Localmod wallet is not published yet. After you create the account, add its 0x address (and optional
            ENS) in the Web3 config. Donate and on-chain messages will then go to that account.
          </div>
        )}
        {WEB3.solana ? (
          <div className="muted tiny">
            Solana: <span className="mono">{WEB3.solana}</span>{" "}
            <button className="btn ghost" type="button" onClick={() => copy(WEB3.solana)}>
              Copy SOL
            </button>
          </div>
        ) : null}

        <div className="section-label">Donate</div>
        <div className="row wrap">
          {PRESETS.map((p) => (
            <button key={p} type="button" className={`btn ${amount === p ? "primary" : ""}`} onClick={() => setAmount(p)}>
              {p} ETH
            </button>
          ))}
          <label className="web3-amount">
            Custom
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.01" />
          </label>
        </div>
        <button className="btn primary" type="button" disabled={busy || !ready} onClick={() => run("donate")}>
          {busy ? "Waiting for wallet…" : hasWallet ? "Donate with wallet" : "Donate (needs a browser wallet)"}
        </button>

        <div className="section-label">Send a message</div>
        <textarea
          rows={3}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="A short public note sent with a 0 ETH transaction…"
          maxLength={500}
        />
        <div className="row wrap">
          <button className="btn" type="button" disabled={busy || !ready} onClick={() => run("message")}>
            {busy ? "Waiting for wallet…" : "Send on-chain message"}
          </button>
          <span className="muted tiny">{note.length}/500 · public on {WEB3.networkName}</span>
        </div>

        {!hasWallet && (
          <div className="muted tiny">
            No injected wallet detected. Install MetaMask, Rainbow, or Coinbase Wallet in this browser, or copy the
            address into any wallet app.
          </div>
        )}
        {status && <div className="muted tiny ok-text">{status}</div>}
        {error && <div className="banner error">{error}</div>}

        {!!outbox.length && (
          <div>
            <div className="section-label">Sent from this machine</div>
            <div className="event-list">
              {outbox.map((row) => (
                <div key={row.hash} className="event-row">
                  <span className="event-type">{row.kind}</span>
                  <a className="status-link" href={explorerTxUrl(row.hash)} target="_blank" rel="noreferrer">
                    {shortAddr(row.hash)}
                  </a>
                  <span className="muted">{row.note.slice(0, 80)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

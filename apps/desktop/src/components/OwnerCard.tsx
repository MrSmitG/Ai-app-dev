import { OWNER } from "../owner";
import { Tip } from "./ui";

export function OwnerCard({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <div className="owner-card compact">
        <div className="section-label">Creator</div>
        <div className="owner-name">{OWNER.name}</div>
        <div className="muted tiny">{OWNER.location}</div>
        <div className="owner-links">
          <a className="btn owner-link" href={OWNER.github.url} target="_blank" rel="noreferrer">
            GitHub
          </a>
          <a className="btn owner-link" href={OWNER.linkedin.url} target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="panel owner-panel flow-in">
      <div className="owner-hero">
        <div className="owner-avatar" aria-hidden>
          {OWNER.name
            .split(" ")
            .map((p) => p[0])
            .join("")
            .slice(0, 2)}
        </div>
        <div>
          <div className="hero-kicker">
            About <Tip text="Creator details and social links for Localmod." />
          </div>
          <h2 className="owner-name">{OWNER.name}</h2>
          <div className="muted">{OWNER.title}</div>
          <div className="muted tiny">{OWNER.location}</div>
        </div>
      </div>
      <p className="owner-blurb">{OWNER.blurb}</p>
      <div className="owner-links">
        <a className="btn primary owner-link" href={OWNER.linkedin.url} target="_blank" rel="noreferrer">
          Connect on LinkedIn
        </a>
        <a className="btn owner-link" href={OWNER.github.url} target="_blank" rel="noreferrer">
          Follow on GitHub
        </a>
        <a className="btn owner-link" href={OWNER.repo.url} target="_blank" rel="noreferrer">
          Project repo
        </a>
        <a className="btn ghost owner-link" href={`mailto:${OWNER.email}`}>
          Email
        </a>
      </div>
      <div className="mono muted tiny">@{OWNER.handle} · {OWNER.email}</div>
    </div>
  );
}

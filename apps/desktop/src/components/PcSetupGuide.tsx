import { PRODUCT, SUITE_PC, pcInstallSteps } from "../web3";

export function PcSetupGuide() {
  return (
    <div className="panel apk-guide">
      <div className="section-label">Independent Windows setups</div>
      <h2 className="owner-name">One Setup.exe per React app. This is PC, not phone.</h2>
      <p className="muted">
        <code className="mono">*.apk</code> is not the Windows installer. On a PC download{" "}
        <code className="mono">Blackwhale-Setup.exe</code>, <code className="mono">Nightweaver-Setup.exe</code>, and so
        on. Each setup is its own program and does not replace the others.
      </p>
      <div className="apk-step-grid">
        {SUITE_PC.map((app) => {
          const href = PRODUCT.downloads.pc[app.id];
          const steps = pcInstallSteps(app);
          return (
            <article key={app.id} className="apk-step-card">
              <div className="suite-usage">{app.usage}</div>
              <div className="suite-name">{app.name}</div>
              <ol className="apk-steps">
                {steps.map((step, i) => (
                  <li key={step}>
                    {i === 0 ? (
                      <>
                        <a className="status-link" href={href} download={app.setup}>
                          {app.setup}
                        </a>
                        {` — ${app.usage}. Windows installer, not a phone APK.`}
                      </>
                    ) : (
                      step
                    )}
                  </li>
                ))}
              </ol>
              <a className="btn primary" href={href} download={app.setup}>
                Step 1 · Download {app.setup}
              </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}

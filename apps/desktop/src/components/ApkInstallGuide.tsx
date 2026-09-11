import { PRODUCT, SUITE_APKS, apkInstallSteps } from "../web3";

export function ApkInstallGuide() {
  return (
    <div className="panel apk-guide">
      <div className="section-label">Independent Android APKs</div>
      <h2 className="owner-name">One APK, one app. Repeat for each.</h2>
      <p className="muted">
        These six files are separate phone apps. Install only the ones you want. Installing Nightweaver does not
        uninstall Blackwhale. <code className="mono">*.apk</code> will not install on a Windows PC.
      </p>
      <div className="apk-step-grid">
        {SUITE_APKS.map((app) => {
          const href = PRODUCT.downloads.apks[app.id];
          const steps = apkInstallSteps(app);
          return (
            <article key={app.id} className="apk-step-card">
              <div className="suite-usage">{app.usage}</div>
              <div className="suite-name">{app.name}</div>
              <ol className="apk-steps">
                {steps.map((step, i) => (
                  <li key={step}>
                    {i === 0 ? (
                      <>
                        <a className="status-link" href={href} download={app.file}>
                          {app.file}
                        </a>
                        {` — ${app.usage}. This file is for an Android phone, not Windows.`}
                      </>
                    ) : (
                      step
                    )}
                  </li>
                ))}
              </ol>
              <a className="btn primary" href={href} download={app.file}>
                Step 1 · Download {app.file}
              </a>
            </article>
          );
        })}
      </div>
    </div>
  );
}

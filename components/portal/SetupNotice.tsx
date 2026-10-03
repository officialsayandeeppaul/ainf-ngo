import { PortalShell } from "./PortalNav";

/**
 * Shown instead of a stack trace when a third-party integration has no keys.
 * Names the exact environment variables so setup is unambiguous.
 */
export function SetupNotice({
  feature,
  keys,
  hint,
}: {
  feature: string;
  keys: string[];
  hint?: string;
}) {
  return (
    <PortalShell role={null}>
      <main className="pt-main pt-main--narrow">
        <h1 className="pt-title">Setup required</h1>
        <p className="pt-subtitle">
          {feature} is not configured yet, so this page cannot load.
        </p>
        <div className="pt-card">
          <p className="pt-eyebrow">Add to .env.local</p>
          <ul className="pt-list">
            {keys.map((key) => (
              <li key={key} style={{ fontFamily: "var(--font-mono)", fontSize: 13 }}>
                {key}
              </li>
            ))}
          </ul>
          {hint ? <p className="pt-hint">{hint}</p> : null}
          <hr className="pt-divider" />
          <p className="pt-hint">
            Every key is documented in <code>.env.example</code>. Restart the dev server after
            editing environment files.
          </p>
        </div>
      </main>
    </PortalShell>
  );
}

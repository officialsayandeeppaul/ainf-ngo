"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function BootstrapForm({
  mfaEnabled,
  mfaRequired,
}: {
  mfaEnabled: boolean;
  mfaRequired: boolean;
}) {
  const router = useRouter();
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<
    | null
    | { kind: "error"; message: string }
    | { kind: "success"; message: string }
  >(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !key.trim()) return;
    setBusy(true);
    setResult(null);

    const response = await fetch("/api/admin/bootstrap", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ key }),
    });
    const payload = await response.json().catch(() => ({}));
    setBusy(false);
    // Clear the key from memory whether or not it worked.
    setKey("");

    if (response.ok) {
      setResult({ kind: "success", message: payload?.message ?? "Super admin access granted." });
      router.refresh();
      setTimeout(() => router.push("/admin"), 1200);
      return;
    }
    setResult({
      kind: "error",
      message: payload?.message ?? "That request was rejected.",
    });
  }

  return (
    <>
      {mfaRequired && !mfaEnabled ? (
        <div className="pt-alert pt-alert--warning">
          <p className="pt-alert__title">Two-factor authentication required</p>
          <p>
            Super admin access requires an authenticator app on your account. Open the account menu
            in the header, go to Security, and add two-step verification. Then return here.
          </p>
        </div>
      ) : null}

      {!mfaRequired ? (
        <div className="pt-alert pt-alert--info">
          <p className="pt-alert__title">Authenticator MFA is optional on this instance</p>
          <p>
            Clerk authenticator apps are a paid plan. Sign in, paste the bootstrap key, and you can
            become the first super admin without MFA. Set <code>SUPER_ADMIN_REQUIRE_MFA=true</code>{" "}
            when you upgrade.
          </p>
        </div>
      ) : null}

      {result?.kind === "error" ? (
        <div className="pt-alert pt-alert--error">
          <p>{result.message}</p>
        </div>
      ) : null}

      {result?.kind === "success" ? (
        <div className="pt-alert pt-alert--success">
          <p>{result.message} Redirecting…</p>
        </div>
      ) : null}

      <form onSubmit={submit}>
        <div className="pt-field">
          <label className="pt-label" htmlFor="bootstrap-key">
            Admin bootstrap key
          </label>
          <input
            id="bootstrap-key"
            className="pt-input pt-input--mono"
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={(mfaRequired && !mfaEnabled) || busy}
            placeholder="••••••••••••••••••••••••"
          />
          <p className="pt-hint">
            The value of <code>SUPER_ADMIN_BOOTSTRAP_KEY</code> from the server environment.
            Attempts are limited to five per hour and every one is logged.
          </p>
        </div>

        <button
          type="submit"
          className="pt-btn pt-btn--primary"
          disabled={(mfaRequired && !mfaEnabled) || busy || !key.trim()}
        >
          {busy ? (
            <>
              <span className="pt-spinner" aria-hidden="true" /> Verifying…
            </>
          ) : (
            "Request super admin access"
          )}
        </button>
      </form>
    </>
  );
}

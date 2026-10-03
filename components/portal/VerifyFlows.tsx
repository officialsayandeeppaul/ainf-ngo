"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { LockedArt } from "./VerifyArt";
type ApiError = { error: string; message?: string; retryable?: boolean; keys?: string[] };

async function postJson(url: string, body?: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, payload };
}

function Alert({ tone, children }: { tone: "error" | "success" | "warning"; children: React.ReactNode }) {
  return <div className={`pt-alert pt-alert--${tone}`}>{children}</div>;
}

export function LockedStep({
  title,
  body,
}: {
  title: string;
  body: string;
}) {
  return (
    <section className="pt-card pt-card--disabled" aria-disabled="true">
      <div className="pt-disabled">
        <LockedArt className="pt-disabled__art" />
        <div>
          <p className="pt-disabled__kicker">Currently disabled</p>
          <h2 className="pt-section-title" style={{ marginBottom: 8 }}>
            {title}
          </h2>
          <p className="pt-hint" style={{ margin: 0, maxWidth: "46ch" }}>
            {body}
          </p>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Didit document + selfie flow
// ---------------------------------------------------------------------------

export function DiditFlow({
  disabled,
  disabledReason,
  complete,
  nextHint,
}: {
  disabled?: boolean;
  disabledReason?: string;
  complete?: boolean;
  nextHint?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    const { ok, payload } = await postJson("/api/kyc/session");
    if (ok && payload?.url) {
      // Full navigation rather than a new tab: Didit redirects back to the
      // callback URL, and popup blockers make window.open unreliable on mobile.
      window.location.href = payload.url;
      return;
    }
    const err = payload as ApiError;
    setError(err?.message ?? "Could not start verification. Please try again.");
    setBusy(false);
  }

  return (
    <section className="pt-card">
      <h2 className="pt-section-title">Step 1 — Identity document</h2>
      <p className="pt-hint" style={{ marginTop: 0, marginBottom: 16 }}>
        You will be taken to our verification partner to photograph a government ID and take a
        selfie. Have your document ready and be somewhere well lit.
      </p>

      <ol className="pt-steps">
        <li>Photograph the front and back of your ID</li>
        <li>Take a short selfie so we can match it to the document</li>
        <li>You are returned here, and we email you the outcome</li>
      </ol>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {complete ? (
        <Alert tone="success">
          <p className="pt-alert__title">Identity document approved</p>
          <p>{nextHint ?? "Your identity is verified."}</p>
        </Alert>
      ) : disabled ? (
        <>
          <button type="button" className="pt-btn pt-btn--primary" disabled>
            Start verification
          </button>
          {disabledReason ? <p className="pt-hint">{disabledReason}</p> : null}
        </>
      ) : (
        <button type="button" className="pt-btn pt-btn--primary" onClick={start} disabled={busy}>
          {busy ? (
            <>
              <span className="pt-spinner" aria-hidden="true" /> Opening…
            </>
          ) : (
            "Start verification"
          )}
        </button>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// PAN flow
// ---------------------------------------------------------------------------

type PanState =
  | { kind: "idle" }
  | { kind: "error"; message: string; retryable?: boolean }
  | { kind: "done"; verified: boolean; message: string };

export function PanFlow({
  initialLast4,
  title = "Step 2 — PAN",
}: {
  initialLast4?: string | null;
  title?: string;
}) {
  const router = useRouter();
  const [state, setState] = useState<PanState>({ kind: "idle" });
  const [busy, setBusy] = useState(false);
  const [pan, setPan] = useState("");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");

  const panValid = /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan);
  const dobValid = /^\d{2}\/\d{2}\/\d{4}$/.test(dob);
  const ready = panValid && dobValid && name.trim().length >= 2;

  function onDobChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 8);
    if (digits.length <= 2) setDob(digits);
    else if (digits.length <= 4) setDob(`${digits.slice(0, 2)}/${digits.slice(2)}`);
    else setDob(`${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setState({ kind: "idle" });

    const { ok, status, payload } = await postJson("/api/kyc/pan", { pan, name, dob });
    setBusy(false);

    if (ok) {
      const verified = payload?.status === "VERIFIED";
      setState({
        kind: "done",
        verified,
        message: payload?.message ?? (verified ? "PAN verified." : "PAN did not match."),
      });
      // Clear the number from component state as soon as it is no longer needed.
      setPan("");
      router.refresh();
      return;
    }

    const err = payload as ApiError;
    setState({
      kind: "error",
      message:
        status === 429
          ? (err?.message ?? "You have used today's PAN checks. Try again tomorrow.")
          : (err?.message ?? "PAN verification failed."),
      retryable: status === 429 || Boolean(err?.retryable),
    });
  }

  if (initialLast4 && state.kind === "idle") {
    return (
      <section className="pt-card">
        <h2 className="pt-section-title">{title}</h2>
        <Alert tone="success">
          <p className="pt-alert__title">PAN on file</p>
          <p>Ending {initialLast4}. You do not need to submit it again.</p>
        </Alert>
      </section>
    );
  }

  return (
    <section className="pt-card">
      <h2 className="pt-section-title">{title}</h2>
      <p className="pt-hint" style={{ marginTop: 0, marginBottom: 16 }}>
        We check your PAN against the name and date of birth registered with it. We store only a
        one-way hash and the last four characters — never the full number.
      </p>

      {state.kind === "error" ? (
        <Alert tone={state.retryable ? "warning" : "error"}>
          <p>{state.message}</p>
        </Alert>
      ) : null}

      {state.kind === "done" ? (
        <Alert tone={state.verified ? "success" : "warning"}>
          <p className="pt-alert__title">{state.verified ? "PAN verified" : "PAN not matched"}</p>
          <p>{state.message}</p>
        </Alert>
      ) : null}

      <form onSubmit={submit} noValidate>
        <div className="pt-field">
          <label className="pt-label" htmlFor="pan">
            PAN number
          </label>
          <input
            id="pan"
            className="pt-input pt-input--mono"
            value={pan}
            onChange={(e) => setPan(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
            placeholder="ABCDE1234F"
            autoComplete="off"
            spellCheck={false}
            inputMode="text"
            maxLength={10}
            aria-invalid={pan.length === 10 && !panValid}
          />
          {pan.length === 10 && !panValid ? (
            <p className="pt-hint" style={{ color: "var(--danger)" }}>
              Five letters, four digits, then one letter.
            </p>
          ) : null}
        </div>

        <div className="pt-field">
          <label className="pt-label" htmlFor="pan-name">
            Full name as printed on the PAN card
          </label>
          <input
            id="pan-name"
            className="pt-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
          />
        </div>

        <div className="pt-field">
          <label className="pt-label" htmlFor="pan-dob">
            Date of birth
          </label>
          <input
            id="pan-dob"
            className="pt-input pt-input--mono"
            value={dob}
            onChange={(e) => onDobChange(e.target.value)}
            placeholder="DD/MM/YYYY"
            autoComplete="bday"
            inputMode="numeric"
            aria-invalid={dob.length === 10 && !dobValid}
          />
          <p className="pt-hint">Date of birth as DD/MM/YYYY, for example 04/09/1992.</p>
        </div>

        <button type="submit" className="pt-btn pt-btn--primary" disabled={!ready || busy}>
          {busy ? (
            <>
              <span className="pt-spinner" aria-hidden="true" /> Verifying…
            </>
          ) : (
            "Verify PAN"
          )}
        </button>
        <p className="pt-hint">
          Limited to three attempts per day. Each check is a paid lookup, so please make sure the
          details are correct before submitting.
        </p>
      </form>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Mobile OTP fallback (used when Didit and PAN are both off)
// ---------------------------------------------------------------------------

type OtpState =
  | { kind: "idle" }
  | { kind: "sent"; channel: string; last4?: string; message: string }
  | { kind: "error"; message: string }
  | { kind: "done"; message: string };

export function OtpFlow({ phoneHint }: { phoneHint?: string | null }) {
  const router = useRouter();
  const [phone, setPhone] = useState(phoneHint ?? "");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<OtpState>({ kind: "idle" });

  const phoneOk = /^[6-9]\d{9}$/.test(phone.replace(/\D/g, "").replace(/^91/, "").slice(-10));

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!phoneOk || busy) return;
    setBusy(true);
    setState({ kind: "idle" });
    const { ok, payload } = await postJson("/api/kyc/otp/send", { phone });
    setBusy(false);
    if (!ok) {
      setState({ kind: "error", message: payload?.message ?? "Could not send a code." });
      return;
    }
    setState({
      kind: "sent",
      channel: payload.channel,
      last4: payload.last4,
      message: payload.message,
    });
  }

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    if (code.length !== 6 || busy) return;
    setBusy(true);
    const { ok, payload } = await postJson("/api/kyc/otp/verify", { code });
    setBusy(false);
    if (!ok) {
      setState({ kind: "error", message: payload?.message ?? "That code is not correct." });
      return;
    }
    setState({ kind: "done", message: payload.message ?? "Verified." });
    router.refresh();
  }

  return (
    <section className="pt-card">
      <h2 className="pt-section-title">Verify with a mobile code</h2>
      <p className="pt-hint" style={{ marginTop: 0, marginBottom: 16 }}>
        Identity document and PAN checks are switched off on this instance. We send a one-time
        code to confirm the number belongs to you.
      </p>

      {state.kind === "error" ? <Alert tone="error">{state.message}</Alert> : null}
      {state.kind === "done" ? (
        <Alert tone="success">
          <p className="pt-alert__title">Verified</p>
          <p>{state.message}</p>
        </Alert>
      ) : null}
      {state.kind === "sent" ? <Alert tone="success">{state.message}</Alert> : null}

      {state.kind !== "done" ? (
        <>
          <form onSubmit={send}>
            <div className="pt-field">
              <label className="pt-label" htmlFor="otp-phone">
                Mobile number
              </label>
              <input
                id="otp-phone"
                className="pt-input pt-input--mono"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="9876543210"
                inputMode="numeric"
                autoComplete="tel"
              />
            </div>
            <button type="submit" className="pt-btn pt-btn--secondary" disabled={!phoneOk || busy}>
              {busy && state.kind !== "sent" ? "Sending…" : "Send code"}
            </button>
          </form>

          <form onSubmit={confirm} style={{ marginTop: 22 }}>
            <div className="pt-field">
              <label className="pt-label" htmlFor="otp-code">
                6-digit code
              </label>
              <input
                id="otp-code"
                className="pt-input pt-input--mono"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
              />
            </div>
            <button type="submit" className="pt-btn pt-btn--primary" disabled={code.length !== 6 || busy}>
              {busy ? "Checking…" : "Confirm"}
            </button>
          </form>
        </>
      ) : null}
    </section>
  );
}

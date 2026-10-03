"use client";

import { useClerk, useSignIn } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

function formatWait(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const parts: string[] = [];
  if (hours) parts.push(`${hours} hour${hours === 1 ? "" : "s"}`);
  if (minutes) parts.push(`${minutes} minute${minutes === 1 ? "" : "s"}`);
  if (!hours || seconds) parts.push(`${seconds} second${seconds === 1 ? "" : "s"}`);
  return parts.join(" ");
}

export function MobileAuth({
  mode,
  next,
  onSwitch,
}: {
  mode: "sign-in" | "sign-up";
  next: string;
  onSwitch: () => void;
}) {
  const router = useRouter();
  const clerk = useClerk();
  const { signIn } = useSignIn();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"phone" | "code" | "password">("phone");
  const [setupToken, setSetupToken] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [retryAt, setRetryAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!retryAt) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      if (current >= retryAt) {
        setRetryAt(null);
        setError("");
        return;
      }
      setNow(current);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [retryAt]);

  async function acceptTicket(ticket: string) {
    const started = Date.now();
    while (!clerk.loaded && Date.now() - started < 8000) {
      await new Promise((resolve) => window.setTimeout(resolve, 100));
    }
    if (!clerk.loaded || typeof signIn.ticket !== "function") {
      setError("The account is ready. Sign in with this mobile number and password.");
      return;
    }
    const startedTicket = await signIn.ticket({ ticket });
    if (startedTicket.error) {
      setError(startedTicket.error.longMessage || startedTicket.error.message || "The account is ready. Sign in with this mobile number and password.");
      return;
    }
    if (signIn.status === "complete") {
      const done = await signIn.finalize();
      if (done.error) {
        setError(done.error.longMessage || done.error.message || "The account is ready. Sign in with this mobile number and password.");
        return;
      }
    }
    router.push(next);
    router.refresh();
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setMessage("");
    setRetryAt(null);
    setBusy(true);
    try {
      if (mode === "sign-in") {
        const local = phone.replace(/\D/g, "").replace(/^0+/, "").replace(/^91(?=\d{10}$)/, "");
        if (!/^[6-9]\d{9}$/.test(local)) {
          setError("Enter a 10-digit Indian mobile number starting with 6–9.");
          return;
        }
        const response = await fetch("/api/auth/mobile/sign-in", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, password }),
        });
        const body = (await response.json()) as { message?: string; ticket?: string };
        if (!response.ok || !body.ticket) {
          setError(body.message || "Mobile number or password is wrong.");
          return;
        }
        await acceptTicket(body.ticket);
        return;
      }

      if (step === "phone") {
        const response = await fetch("/api/auth/mobile/register", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, firstName }),
        });
        const body = (await response.json()) as { message?: string; retryAfter?: number };
        if (!response.ok) {
          if (response.status === 429 && body.retryAfter) {
            setNow(Date.now());
            setRetryAt(Date.now() + body.retryAfter * 1000);
          }
          setError(body.message || "The code could not be sent.");
          return;
        }
        setStep("code");
        setMessage("Enter the 6-digit code sent to your mobile.");
        return;
      }

      if (step === "code") {
        const response = await fetch("/api/auth/mobile/verify", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ phone, code }),
        });
        const body = (await response.json()) as { message?: string; setupToken?: string; retryAfter?: number };
        if (!response.ok || !body.setupToken) {
          if (response.status === 429 && body.retryAfter) {
            setNow(Date.now());
            setRetryAt(Date.now() + body.retryAfter * 1000);
          }
          setError(body.message || "That code does not match.");
          return;
        }
        setSetupToken(body.setupToken);
        setStep("password");
        setMessage("Code accepted. Use at least 8 characters, with a letter and a number.");
        return;
      }

      if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        setError("Use at least 8 characters, with a letter and a number.");
        return;
      }

      const response = await fetch("/api/auth/mobile/password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ phone, setupToken, password }),
      });
      const body = (await response.json()) as { message?: string; ticket?: string };
      if (!response.ok || !body.ticket) {
        setError(body.message || "The password could not be saved.");
        return;
      }
      await acceptTicket(body.ticket);
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="pt-card" style={{ width: "100%", margin: 0 }}>
        <h2 className="pt-section-title" style={{ marginTop: 0 }}>
          {mode === "sign-in" ? "Sign in with mobile" : "Register with mobile"}
        </h2>
        {mode === "sign-up" ? (
          <p className="pt-hint" style={{ marginBottom: 0 }}>
            {step === "phone" ? "Step 1 of 3. Mobile number." : step === "code" ? "Step 2 of 3. Text code." : "Step 3 of 3. Password."}
          </p>
        ) : null}
        <p className="pt-hint">
          {mode === "sign-in"
            ? "Mobile number and the password you set when you registered. Sign-in does not send a text code."
            : "Mobile number, then the text code, then a password. The password step opens only after the code is accepted."}
        </p>
        <form noValidate onSubmit={onSubmit} className="pt-stack" style={{ display: "grid", gap: 12, marginTop: 14 }}>
          {mode === "sign-up" && step === "phone" ? (
            <label className="pt-label">
              Name
              <input className="pt-input" value={firstName} onChange={(event) => setFirstName(event.target.value)} autoComplete="name" />
            </label>
          ) : null}
          {(mode === "sign-in" || step === "phone") ? (
            <label className="pt-label">
              Mobile number
              <input
                className="pt-input"
                inputMode="numeric"
                autoComplete="tel"
                placeholder="10-digit mobile"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                required
              />
            </label>
          ) : null}
          {step === "code" ? (
            <label className="pt-label">
              Text code
              <input
                className="pt-input"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="6-digit code"
                value={code}
                onChange={(event) => setCode(event.target.value)}
                required
              />
            </label>
          ) : null}
          {(mode === "sign-in" || step === "password") ? (
            <label className="pt-label">
              Password
              <input
                className="pt-input"
                type="password"
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
            </label>
          ) : null}
          {message ? <p className="pt-hint">{message}</p> : null}
          {retryAt && retryAt > now ? (
            <p className="pt-alert pt-alert--error">You can send another code in {formatWait(retryAt - now)}.</p>
          ) : error ? (
            <p className="pt-alert pt-alert--error">{error}</p>
          ) : null}
          <button className="pt-btn pt-btn--primary" type="submit" disabled={busy || (retryAt !== null && retryAt > now)}>
            {busy
              ? "Please wait…"
              : mode === "sign-in"
                ? "Sign in"
                : step === "phone"
                  ? "Send code"
                  : step === "code"
                    ? "Confirm code"
                    : "Set password"}
          </button>
          <p className="pt-hint" style={{ margin: 0 }}>
            <button type="button" className="pt-auth-switch" onClick={onSwitch}>
              {mode === "sign-in" ? "New number? Create account" : "Already registered? Sign in"}
            </button>
          </p>
        </form>
    </section>
  );
}

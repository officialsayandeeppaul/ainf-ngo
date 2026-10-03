"use client";

import { useState } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { MobileAuth } from "@/components/portal/MobileAuth";

export function AuthMethod({
  initialMode,
  next,
}: {
  initialMode: "sign-in" | "sign-up";
  next: string;
}) {
  const [mode, setMode] = useState<"sign-in" | "sign-up">(initialMode);
  const [method, setMethod] = useState<"email" | "mobile">("email");

  function switchMode() {
    const nextMode = mode === "sign-in" ? "sign-up" : "sign-in";
    setMode(nextMode);
    const path = nextMode === "sign-in" ? "/sign-in" : "/sign-up";
    window.history.replaceState(null, "", `${path}?redirect_url=${encodeURIComponent(next)}`);
  }

  return (
    <>
      <div className="pt-segment pt-segment--block" role="group" aria-label={mode === "sign-in" ? "Sign-in method" : "Registration method"}>
        <button
          type="button"
          className={`pt-segment__btn${method === "email" ? " is-on" : ""}`}
          aria-pressed={method === "email"}
          onClick={() => setMethod("email")}
        >
          Email
        </button>
        <button
          type="button"
          className={`pt-segment__btn${method === "mobile" ? " is-on" : ""}`}
          aria-pressed={method === "mobile"}
          onClick={() => setMethod("mobile")}
        >
          Mobile
        </button>
      </div>
      {method === "email" ? (
        mode === "sign-in" ? (
          <SignIn
            routing="hash"
            fallbackRedirectUrl={next}
            forceRedirectUrl={next}
            signUpForceRedirectUrl={next}
          />
        ) : (
          <SignUp routing="hash" fallbackRedirectUrl={next} forceRedirectUrl={next} />
        )
      ) : (
        <MobileAuth key={mode} mode={mode} next={next} onSwitch={switchMode} />
      )}
      {method === "email" ? (
        <p className="pt-hint" style={{ margin: 0, textAlign: "center" }}>
          <button type="button" className="pt-auth-switch" onClick={switchMode}>
            {mode === "sign-in" ? "New number? Create account" : "Already registered? Sign in"}
          </button>
        </p>
      ) : null}
      {mode === "sign-up" ? (
        <p className="pt-hint" style={{ textAlign: "center", maxWidth: 400, margin: "18px auto 0" }}>
          A standard account lets you follow projects and manage your profile. Identity verification is required before a
          Field Sevak plan. A gift to AINF does not need an account.
        </p>
      ) : null}
    </>
  );
}

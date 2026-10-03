"use client";

import { useState } from "react";

export function MembershipIdCard({
  frontSvg,
  backSvg,
  regNo,
  verifyUrl,
  expiresLabel,
  compact = false,
}: {
  frontSvg: string;
  backSvg: string;
  regNo: string;
  verifyUrl: string;
  expiresLabel: string;
  compact?: boolean;
}) {
  const [face, setFace] = useState<"front" | "back">("front");

  function flip() {
    setFace((current) => (current === "front" ? "back" : "front"));
  }

  return (
    <section className={`pt-idcard${compact ? " pt-idcard--compact" : ""}`}>
      <div className="pt-idcard__head">
        <div>
          <h2 className="pt-section-title">Membership ID card</h2>
          <p className="pt-hint" style={{ marginTop: 0 }}>
            Official AINF passport-style card · {regNo} · valid until {expiresLabel}. Flip to read
            the rules, or scan the QR to verify a live member.
          </p>
        </div>
        <div className="pt-idcard__actions">
          <div className="pt-idcard__toggle" role="group" aria-label="Card face">
            <button
              type="button"
              className={face === "front" ? "is-on" : undefined}
              onClick={() => setFace("front")}
              aria-pressed={face === "front"}
            >
              Front
            </button>
            <button
              type="button"
              className={face === "back" ? "is-on" : undefined}
              onClick={() => setFace("back")}
              aria-pressed={face === "back"}
            >
              Back
            </button>
          </div>
          <a className="pt-btn pt-btn--secondary" href={verifyUrl} target="_blank" rel="noreferrer">
            Open scan check
          </a>
        </div>
      </div>

      <div className="pt-idcard__stage">
        <div className="pt-idcard__spin">
          <div
            className={`pt-idcard__flip${face === "back" ? " is-back" : ""}`}
            onClick={flip}
            role="button"
            tabIndex={0}
            aria-label={face === "front" ? "Show card back" : "Show card front"}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                flip();
              }
            }}
          >
            <figure className="pt-idcard__face pt-idcard__face--front">
              <div className="pt-idcard__svg" dangerouslySetInnerHTML={{ __html: frontSvg }} />
            </figure>
            <figure className="pt-idcard__face pt-idcard__face--back">
              <div className="pt-idcard__svg" dangerouslySetInnerHTML={{ __html: backSvg }} />
            </figure>
          </div>
        </div>
      </div>
      <p className="pt-idcard__caption">{face === "front" ? "Front" : "Back"} · click the card to flip</p>

      {!compact ? (
        <div className="pt-idcard__faces pt-idcard__faces--print" aria-hidden="true">
          <figure className="pt-idcard__face">
            <div className="pt-idcard__svg" dangerouslySetInnerHTML={{ __html: frontSvg }} />
            <figcaption>Front</figcaption>
          </figure>
          <figure className="pt-idcard__face">
            <div className="pt-idcard__svg" dangerouslySetInnerHTML={{ __html: backSvg }} />
            <figcaption>Back</figcaption>
          </figure>
        </div>
      ) : null}
    </section>
  );
}

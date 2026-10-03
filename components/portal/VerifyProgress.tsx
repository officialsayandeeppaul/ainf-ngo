export type ProgressStep = {
  id: string;
  label: string;
  caption: string;
  state: "complete" | "current" | "locked" | "upcoming";
};

export function VerifyProgress({ steps }: { steps: ProgressStep[] }) {
  if (steps.length === 0) return null;

  const completeCount = steps.filter((step) => step.state === "complete").length;
  const currentIndex = steps.findIndex((step) => step.state === "current");
  const percent =
    steps.length === 1
      ? completeCount === 1
        ? 100
        : currentIndex === 0
          ? 45
          : 0
      : Math.round(
          ((completeCount + (currentIndex >= 0 ? 0.45 : 0)) / steps.length) * 100
        );

  return (
    <section className="pt-progress" aria-label="Verification progress">
      <div className="pt-progress__meta">
        <span>Progress</span>
        <span>{Math.min(100, percent)}%</span>
      </div>
      <div
        className="pt-progress__track"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.min(100, percent)}
      >
        <div className="pt-progress__fill" style={{ width: `${Math.min(100, percent)}%` }} />
      </div>
      <ol className="pt-stepper">
        {steps.map((step, index) => (
          <li key={step.id} className={`pt-stepper__item pt-stepper__item--${step.state}`}>
            {index > 0 ? <span className="pt-stepper__line" aria-hidden="true" /> : null}
            <span className="pt-stepper__mark" aria-hidden="true">
              {step.state === "complete" ? (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path
                    d="M3 7.2l2.6 2.6L11 4.2"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              ) : step.state === "locked" ? (
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <rect x="5" y="11" width="14" height="10" rx="2" stroke="currentColor" strokeWidth="1.8" />
                  <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                index + 1
              )}
            </span>
            <span className="pt-stepper__copy">
              <span className="pt-stepper__label">{step.label}</span>
              <span className="pt-stepper__caption">{step.caption}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

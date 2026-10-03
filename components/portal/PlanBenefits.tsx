"use client";

import type { PlanBenefit } from "@/lib/plan-benefits";
import { catalogBenefits, emptyBenefit, mergeCatalog, PLAN_BENEFIT_LIMIT } from "@/lib/plan-benefits";
import { PortalSelect } from "@/components/portal/PortalSelect";

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.2 6.4 11 12.5 4.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CrossIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M4.2 4.2 11.8 11.8M11.8 4.2 4.2 11.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export function PlanBenefitStack({ benefits }: { benefits: PlanBenefit[] }) {
  if (benefits.length === 0) return null;
  return (
    <ul className="pt-benefit-list">
      {benefits.map((item, index) => (
        <li
          key={`${item.label}-${index}`}
          className={`pt-benefit ${item.included ? "pt-benefit--in" : "pt-benefit--out"}`}
        >
          <span className="pt-benefit__mark" aria-hidden="true">
            {item.included ? <CheckIcon /> : <CrossIcon />}
          </span>
          <span className="pt-benefit__label">{item.label}</span>
        </li>
      ))}
    </ul>
  );
}

export function PlanBenefitEditor({
  value,
  onChange,
  disabled = false,
}: {
  value: PlanBenefit[];
  onChange: (next: PlanBenefit[]) => void;
  disabled?: boolean;
}) {
  function patch(index: number, next: Partial<PlanBenefit>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...next } : row)));
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= value.length) return;
    const copy = [...value];
    const [row] = copy.splice(index, 1);
    copy.splice(target, 0, row!);
    onChange(copy);
  }

  return (
    <div className="pt-benefit-editor">
      <div className="pt-benefit-editor__head">
        <p className="pt-label" style={{ margin: 0 }}>
          What this plan includes
        </p>
        <div className="pt-btn-row">
          <button
            type="button"
            className="pt-btn pt-btn--ghost pt-btn--sm"
            disabled={disabled}
            onClick={() => onChange(value.length ? mergeCatalog(value) : catalogBenefits(false))}
          >
            {value.length ? "Add comparison set" : "Load comparison set"}
          </button>
        </div>
      </div>
      <p className="pt-hint" style={{ marginTop: 4 }}>
        Stacked on the membership card. Mark each line included or not included so people can compare
        plans.
      </p>
      {value.length === 0 ? (
        <p className="pt-hint">No benefits yet. Add lines or load the comparison set.</p>
      ) : (
        <ol className="pt-benefit-edit-list">
          {value.map((row, index) => (
            <li className="pt-benefit-edit" key={`benefit-${index}`}>
              <PortalSelect
                size="sm"
                ariaLabel={`Included on this plan, line ${index + 1}`}
                value={row.included ? "in" : "out"}
                disabled={disabled}
                options={[
                  { value: "in", label: "Included" },
                  { value: "out", label: "Not included" },
                ]}
                onChange={(next) => patch(index, { included: next === "in" })}
              />
              <input
                className="pt-input"
                value={row.label}
                disabled={disabled}
                maxLength={80}
                placeholder="e.g. Name on the public donor roll"
                onChange={(e) => patch(index, { label: e.target.value })}
                aria-label={`Benefit ${index + 1}`}
              />
              <div className="pt-benefit-edit__move">
                <button
                  type="button"
                  className="pt-btn pt-btn--ghost pt-btn--sm"
                  disabled={disabled || index === 0}
                  onClick={() => move(index, -1)}
                  aria-label="Move up"
                >
                  Up
                </button>
                <button
                  type="button"
                  className="pt-btn pt-btn--ghost pt-btn--sm"
                  disabled={disabled || index === value.length - 1}
                  onClick={() => move(index, 1)}
                  aria-label="Move down"
                >
                  Down
                </button>
                <button
                  type="button"
                  className="pt-btn pt-btn--ghost pt-btn--sm"
                  disabled={disabled}
                  onClick={() => onChange(value.filter((_, i) => i !== index))}
                  aria-label="Remove benefit"
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ol>
      )}
      <button
        type="button"
        className="pt-btn pt-btn--secondary pt-btn--sm"
        disabled={disabled || value.length >= PLAN_BENEFIT_LIMIT}
        onClick={() => onChange([...value, emptyBenefit(true)])}
      >
        Add benefit
      </button>
    </div>
  );
}

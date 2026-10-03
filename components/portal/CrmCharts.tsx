import { formatInr } from "@/lib/membership";

export function CrmStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="pt-crm-stat">
      <p className="pt-crm-stat__label">{label}</p>
      <p className="pt-crm-stat__value">{value}</p>
      {hint ? <p className="pt-crm-stat__hint">{hint}</p> : null}
    </div>
  );
}

export function CrmBars({
  items,
}: {
  items: Array<{ label: string; paise: number }>;
}) {
  if (items.length === 0) {
    return <p className="pt-hint">No paid memberships yet.</p>;
  }
  const max = Math.max(...items.map((item) => item.paise), 1);
  return (
    <ul className="pt-crm-bars">
      {items.map((item) => (
        <li className="pt-crm-bars__row" key={item.label}>
          <span className="pt-crm-bars__label">{item.label}</span>
          <span className="pt-crm-bars__track">
            <span
              className="pt-crm-bars__fill"
              style={{ width: `${Math.max(4, Math.round((item.paise / max) * 100))}%` }}
            />
          </span>
          <span className="pt-crm-bars__value">{formatInr(item.paise)}</span>
        </li>
      ))}
    </ul>
  );
}

export function CrmSpark({
  points,
}: {
  points: Array<{ label: string; paise: number }>;
}) {
  const max = Math.max(...points.map((point) => point.paise), 1);
  return (
    <div className="pt-crm-spark" role="img" aria-label="Paid by month">
      {points.map((point) => (
        <div className="pt-crm-spark__col" key={point.label}>
          <span className={`pt-crm-spark__value${point.paise > 0 ? "" : " is-empty"}`}>
            {point.paise > 0 ? formatInr(point.paise) : "No pay"}
          </span>
          <span
            className="pt-crm-spark__bar"
            style={{ height: `${Math.max(point.paise > 0 ? 12 : 4, Math.round((point.paise / max) * 88))}%` }}
          />
          <span className="pt-crm-spark__label">{point.label}</span>
        </div>
      ))}
    </div>
  );
}

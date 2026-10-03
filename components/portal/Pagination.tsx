import Link from "next/link";

export function Pagination({
  page,
  pages,
  hrefFor,
  total,
  pageSize,
}: {
  page: number;
  pages: number;
  hrefFor: (next: number) => string;
  total?: number;
  pageSize?: number;
}) {
  const showControls = pages > 1;
  const showRange = total != null && pageSize != null && total > 0;
  if (!showControls && !showRange) return null;

  const safePage = Math.min(Math.max(1, page), Math.max(1, pages));
  const from = showRange ? (safePage - 1) * pageSize + 1 : 0;
  const to = showRange ? Math.min(safePage * pageSize, total) : 0;
  const window = pageNumbers(safePage, pages);

  return (
    <nav className="pt-pager" aria-label="Pagination">
      {showControls ? (
        safePage > 1 ? (
          <Link className="pt-btn pt-btn--secondary pt-btn--sm" href={hrefFor(safePage - 1)}>
            Previous
          </Link>
        ) : (
          <span className="pt-btn pt-btn--secondary pt-btn--sm" aria-disabled="true">
            Previous
          </span>
        )
      ) : null}

      {showControls ? (
        <ol className="pt-pager__pages">
          {window.map((item, index) =>
            item === "…" ? (
              <li key={`e-${index}`} className="pt-pager__ellipsis">
                …
              </li>
            ) : (
              <li key={item}>
                <Link
                  href={hrefFor(item)}
                  className={`pt-pager__num${item === safePage ? " is-current" : ""}`}
                  aria-current={item === safePage ? "page" : undefined}
                >
                  {item}
                </Link>
              </li>
            )
          )}
        </ol>
      ) : null}

      <span className="pt-pager__meta">
        {showRange ? `Showing ${from}–${to} of ${total}` : `Page ${safePage} of ${pages}`}
      </span>

      {showControls ? (
        safePage < pages ? (
          <Link className="pt-btn pt-btn--secondary pt-btn--sm" href={hrefFor(safePage + 1)}>
            Next
          </Link>
        ) : (
          <span className="pt-btn pt-btn--secondary pt-btn--sm" aria-disabled="true">
            Next
          </span>
        )
      ) : null}
    </nav>
  );
}

function pageNumbers(page: number, pages: number): Array<number | "…"> {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const set = new Set([1, pages, page, page - 1, page + 1]);
  const nums = [...set].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);
  const out: Array<number | "…"> = [];
  for (const n of nums) {
    const prev = out[out.length - 1];
    if (typeof prev === "number" && n - prev > 1) out.push("…");
    out.push(n);
  }
  return out;
}

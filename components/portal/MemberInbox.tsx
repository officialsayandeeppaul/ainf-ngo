import { formatDayTime } from "@/lib/format-date";
import type { InboxItem } from "@/lib/member-inbox";

/** A member's messages with AINF: their own with the team's replies, and messages from the team. */
export function MemberInbox({ items, emptyHint }: { items: InboxItem[]; emptyHint: string }) {
  if (items.length === 0) {
    return (
      <p className="pt-hint" style={{ margin: 0 }}>
        {emptyHint}
      </p>
    );
  }
  return (
    <ul className="pt-inbox">
      {items.map((item) =>
        item.kind === "notice" ? (
          <li key={`n-${item.id}`} className={`pt-inbox__item pt-inbox__item--team${item.unread ? " is-unread" : ""}`}>
            <div className="pt-inbox__head">
              <span className="pt-inbox__from">Message from AINF</span>
              {item.unread ? <span className="pt-pill pt-inbox__new">New</span> : null}
              <time className="pt-inbox__when">{formatDayTime(item.at)}</time>
            </div>
            <p className="pt-inbox__body">{item.body}</p>
          </li>
        ) : (
          <li key={`t-${item.id}`} className="pt-inbox__item">
            <div className="pt-inbox__head">
              <span className="pt-inbox__from">You wrote</span>
              <time className="pt-inbox__when">{formatDayTime(item.at)}</time>
            </div>
            <p className="pt-inbox__body">{item.body}</p>
            {item.reply ? (
              <div className="pt-inbox__reply">
                <div className="pt-inbox__head">
                  <span className="pt-inbox__from">AINF replied</span>
                  <time className="pt-inbox__when">{formatDayTime(item.reply.at)}</time>
                </div>
                <p className="pt-inbox__body">{item.reply.body}</p>
              </div>
            ) : (
              <p className="pt-inbox__waiting">
                {item.status === "ARCHIVED"
                  ? "Closed by AINF without a written reply."
                  : "Waiting for a reply. It will appear here."}
              </p>
            )}
          </li>
        )
      )}
    </ul>
  );
}

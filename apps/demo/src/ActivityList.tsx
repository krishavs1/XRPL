import { timeAgo, type ActivityEntry } from "./activity";

/** Rows of past checks; click one to reopen it in the Review step. */
export function ActivityList({ items, onOpen }: { items: ActivityEntry[]; onOpen: (e: ActivityEntry) => void }) {
  return (
    <div className="list">
      {items.map((e) => {
        const tone = e.dangers ? "danger" : e.warns ? "warn" : "clean";
        const risk = e.dangers ? `${e.dangers} danger` : e.warns ? `${e.warns} warning${e.warns > 1 ? "s" : ""}` : "clean";
        return (
          <button key={e.id} className="list-row" onClick={() => onOpen(e)}>
            <span className={`tag ${tone}`}>{risk}</span>
            <span className="list-main">
              <span className="list-title">{e.source}</span>
              <span className="list-sub">{e.summary}</span>
            </span>
            <span className="list-meta">
              {e.signed ? (
                <span className={e.signed.result === "tesSUCCESS" ? "ok" : "bad"}>signed · {e.signed.result}</span>
              ) : e.simulated ? (
                <span className={e.simulated === "tesSUCCESS" ? "ok" : "bad"}>simulated · {e.simulated}</span>
              ) : (
                <span>reviewed</span>
              )}
              <span>{timeAgo(e.at)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

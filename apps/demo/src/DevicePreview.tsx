import { useEffect, useState } from "react";
import type { DeviceScreen } from "xrpl-clear-signing";

/**
 * The secure-screen sequence the spec's device profile produces for this
 * transaction, paged one screen at a time like a real device. The dots give
 * the whole sequence at a glance: a risky transaction starts red.
 */
export function DevicePreview({ screens }: { screens: DeviceScreen[] }) {
  const [page, setPage] = useState(0);
  const key = screens.map((s) => s.heading).join("|");
  useEffect(() => setPage(0), [key]);

  const s = screens[Math.min(page, screens.length - 1)];
  if (!s) return null;
  const tone = s.severity === "danger" ? "danger" : s.severity === "warn" ? "warn" : "";

  return (
    <div>
      <div className={`device-frame ${tone}`}>
        <div className="device-body">
          {s.kind === "warning" && <span className="device-icon">⚠</span>}
          <span className="device-heading">{s.heading}</span>
          <span className={`device-text ${s.kind}`}>{s.body}</span>
        </div>
        <div className="device-nav">
          <button onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous screen">
            ◀
          </button>
          <span>
            {page + 1} / {screens.length}
          </span>
          <button
            onClick={() => setPage(page + 1)}
            disabled={page === screens.length - 1}
            aria-label="Next screen"
          >
            ▶
          </button>
        </div>
      </div>
      <div className="device-dots" aria-hidden="true">
        {screens.map((d, i) => (
          <span
            key={i}
            className={`${d.severity ?? ""}${i === page ? " current" : ""}`}
            onClick={() => setPage(i)}
          />
        ))}
      </div>
    </div>
  );
}

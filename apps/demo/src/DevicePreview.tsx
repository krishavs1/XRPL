import { useEffect, useRef, useState } from "react";
import type { DeviceScreen } from "xrpl-clear-signing";

const HOLD_MS = 1100;

/**
 * The secure-screen sequence the spec's device profile produces, rendered to
 * look like the real Ledger Stax (white screen, field-per-page, Reject, page
 * counter, hold-to-sign) — but with the clear-signing warning screens a device
 * can't show today. This is what the left (real) device would display if it
 * consumed the metadata.
 */
export function DevicePreview({ screens }: { screens: DeviceScreen[] }) {
  const [page, setPage] = useState(0);
  const [hold, setHold] = useState(0); // 0..1 progress on the approve screen
  const [signed, setSigned] = useState(false);
  const raf = useRef<number | undefined>(undefined);
  const start = useRef(0);

  const key = screens.map((s) => s.heading).join("|");
  useEffect(() => {
    setPage(0);
    setSigned(false);
    setHold(0);
  }, [key]);

  const s = screens[Math.min(page, screens.length - 1)];
  if (!s) return null;
  const tone = s.severity === "danger" ? "danger" : s.severity === "warn" ? "warn" : "";
  const last = page === screens.length - 1;

  function stopHold() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = undefined;
    if (!signed) setHold(0);
  }
  function stepHold() {
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    setHold(p);
    if (p >= 1) {
      setSigned(true);
      return;
    }
    raf.current = requestAnimationFrame(stepHold);
  }
  function beginHold() {
    if (signed) return;
    start.current = performance.now();
    raf.current = requestAnimationFrame(stepHold);
  }

  return (
    <div>
      <div className="stax">
        <div className="stax-screen">
          {signed ? (
            <div className="stax-center">
              <span className="stax-check">✓</span>
              <span className="stax-title">Transaction signed</span>
            </div>
          ) : s.kind === "title" ? (
            <div className="stax-center">
              <svg width="34" height="34" viewBox="0 0 48 48" aria-hidden="true">
                <g fill="#141a1f">
                  <circle cx="24" cy="13" r="6" />
                  <circle cx="14" cy="31" r="6" />
                  <circle cx="34" cy="31" r="6" />
                </g>
              </svg>
              <span className="stax-title">{s.body}</span>
              <span className="stax-sub">Swipe to review</span>
            </div>
          ) : s.kind === "warning" ? (
            <div className={`stax-warn ${tone}`}>
              <span className="stax-warn-icon">⚠</span>
              <span className="stax-warn-code">{s.heading}</span>
              <span className="stax-warn-msg">{s.body}</span>
            </div>
          ) : s.kind === "approve" ? (
            <div className="stax-center">
              {tone === "danger" && <span className="stax-warn-icon">⚠</span>}
              <span className={`stax-title${tone === "danger" ? " danger" : ""}`}>{s.heading}</span>
              <button
                className={`stax-hold${tone === "danger" ? " danger" : ""}`}
                onPointerDown={beginHold}
                onPointerUp={stopHold}
                onPointerLeave={stopHold}
                onPointerCancel={stopHold}
              >
                <span className="stax-hold-fill" style={{ width: `${hold * 100}%` }} />
                <span className="stax-hold-label">Hold to sign</span>
              </button>
            </div>
          ) : (
            <div className="stax-field">
              <span className="stax-label">{s.heading}</span>
              <span className={`stax-value${tone ? ` ${tone}` : ""}`}>{s.body}</span>
            </div>
          )}
        </div>
        {!signed && (
          <div className="stax-bar">
            <button className="stax-reject" onClick={() => { setPage(0); }}>
              Reject
            </button>
            <span className="stax-count">
              {page + 1} of {screens.length}
            </span>
            <span className="stax-arrows">
              <button onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous">
                ‹
              </button>
              <button onClick={() => setPage(page + 1)} disabled={last} aria-label="Next">
                ›
              </button>
            </span>
          </div>
        )}
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

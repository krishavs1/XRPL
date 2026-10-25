import { useEffect, useMemo, useRef, useState } from "react";
import type { DeviceScreen } from "xrpl-clear-signing";

const HOLD_MS = 1100;

/**
 * The spec's device-profile screen sequence, rendered to match the real Ledger
 * Stax on the left (white screen, grouped field page, Reject + page counter +
 * hold-to-sign) - plus the clear-signing warning screens a device can't show
 * today. Consecutive field screens are grouped onto one page, the way a Stax
 * shows a transaction's fields together.
 */
export function DevicePreview({ screens }: { screens: DeviceScreen[] }) {
  // Group consecutive field screens into one page; everything else is its own page.
  const pages = useMemo(() => {
    const out: DeviceScreen[][] = [];
    for (const sc of screens) {
      const last = out[out.length - 1];
      if (sc.kind === "field" && last && last[0].kind === "field") last.push(sc);
      else out.push([sc]);
    }
    return out;
  }, [screens]);

  const [page, setPage] = useState(0);
  const [hold, setHold] = useState(0);
  const [signed, setSigned] = useState(false);
  const raf = useRef<number | undefined>(undefined);
  const startT = useRef(0);

  const key = screens.map((s) => s.heading).join("|");
  useEffect(() => {
    setPage(0);
    setSigned(false);
    setHold(0);
  }, [key]);

  const group = pages[Math.min(page, pages.length - 1)];
  if (!group) return null;
  const head = group[0];
  const tone = head.severity === "danger" ? "danger" : head.severity === "warn" ? "warn" : "";
  const last = page === pages.length - 1;

  function stopHold() {
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = undefined;
    if (!signed) setHold(0);
  }
  function stepHold() {
    const p = Math.min(1, (performance.now() - startT.current) / HOLD_MS);
    setHold(p);
    if (p >= 1) return setSigned(true);
    raf.current = requestAnimationFrame(stepHold);
  }
  function beginHold() {
    if (signed) return;
    startT.current = performance.now();
    raf.current = requestAnimationFrame(stepHold);
  }

  return (
    <div>
      <p className="device-hint">Tap ‹ › to review · hold to sign</p>
      <div className="stax">
        <div className="stax-screen">
          {signed ? (
            <div className="stax-center">
              <span className="stax-check">✓</span>
              <span className="stax-title">Transaction signed</span>
            </div>
          ) : head.kind === "title" ? (
            <div className="stax-center">
              <svg width="30" height="30" viewBox="0 0 48 48" aria-hidden="true">
                <g fill="#141a1f">
                  <circle cx="24" cy="13" r="6" />
                  <circle cx="14" cy="31" r="6" />
                  <circle cx="34" cy="31" r="6" />
                </g>
              </svg>
              <span className="stax-title">Review transaction</span>
              <span className="stax-sub">Swipe to review</span>
            </div>
          ) : head.kind === "warning" ? (
            <div className="stax-warn">
              <span className={`stax-warn-icon ${tone}`}>⚠</span>
              <span className={`stax-warn-code ${tone}`}>{head.heading}</span>
              <span className="stax-warn-msg">{head.body}</span>
            </div>
          ) : head.kind === "approve" ? (
            <div className="stax-center">
              {tone === "danger" && <span className="stax-warn-icon danger">⚠</span>}
              <span className={`stax-title${tone === "danger" ? " danger" : ""}`}>
                {tone === "danger" ? "Reject recommended" : "Sign transaction?"}
              </span>
              {tone === "danger" && <span className="stax-sub">{head.body}</span>}
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
            <div className="stax-fields">
              {group.map((f, i) => (
                <div className="stax-field" key={i}>
                  <span className="stax-label">{f.heading}</span>
                  <span className={`stax-value${f.severity ? ` ${f.severity}` : ""}`}>{f.body}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {!signed && (
          <div className="stax-bar">
            <button className="stax-reject" onClick={() => setPage(0)}>
              Reject
            </button>
            <span className="stax-nav">
              <button onClick={() => setPage(page - 1)} disabled={page === 0} aria-label="Previous">
                ‹
              </button>
              <span className="stax-count">
                {page + 1} of {pages.length}
              </span>
              <button onClick={() => setPage(page + 1)} disabled={last} aria-label="Next">
                ›
              </button>
            </span>
          </div>
        )}
      </div>
      <div className="device-dots" aria-hidden="true">
        {pages.map((p, i) => (
          <span
            key={i}
            className={`${p[0].severity ?? ""}${i === page ? " current" : ""}`}
            onClick={() => setPage(i)}
          />
        ))}
      </div>
    </div>
  );
}

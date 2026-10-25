import { useState } from "react";
import { DEFAULT_WSS } from "./xrplnet";

/** Header network pill; opens the one place the XRPL endpoint is set. */
export function Settings({ endpoint, onChange }: { endpoint: string; onChange: (url: string) => void }) {
  const [open, setOpen] = useState(false);
  const host = (() => {
    try {
      return new URL(endpoint).host;
    } catch {
      return endpoint;
    }
  })();

  return (
    <div className="settings">
      <button className="net-pill" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="dot" /><span className="net-label"> Testnet</span><span className="host"> · {host}</span>
      </button>
      {open && (
        <div className="settings-pop" role="dialog" aria-label="Network settings">
          <label htmlFor="endpoint">XRPL WebSocket endpoint</label>
          <input id="endpoint" value={endpoint} onChange={(e) => onChange(e.target.value)} />
          <p>Used for simulate, the live feed, autofill and submission. Point it at QuickNode here.</p>
          <div className="settings-actions">
            <button onClick={() => onChange(DEFAULT_WSS)} disabled={endpoint === DEFAULT_WSS}>
              Reset to public testnet
            </button>
            <button className="accent" onClick={() => setOpen(false)}>
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

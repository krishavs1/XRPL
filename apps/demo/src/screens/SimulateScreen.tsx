import { useState } from "react";
import { defaultRegistry, formatAccount, type DisplayIntent, type SimulationResult } from "xrpl-clear-signing";
import { simulateViaWs } from "../xrplnet";
import { PLACEHOLDER_ACCOUNT } from "../samples";

interface Props {
  intent: DisplayIntent | null;
  endpoint: string;
  /** Connected device account: replaces the fixtures' placeholder so the dry run uses a funded account */
  deviceAccount: string;
  sim: SimulationResult | null;
  onResult: (r: SimulationResult | null) => void;
}

/** Step 3: XLS-69 dry run against current ledger state. Nothing is signed or submitted. */
export function SimulateScreen({ intent, endpoint, deviceAccount, sim, onResult }: Props) {
  const [busy, setBusy] = useState(false);
  const [as, setAs] = useState("");

  async function run() {
    if (!intent) return;
    setBusy(true);
    onResult(null);
    setAs("");
    try {
      const tx = { ...(intent.raw as Record<string, unknown>) };
      if (deviceAccount && tx.Account === PLACEHOLDER_ACCOUNT) {
        tx.Account = deviceAccount;
        setAs(deviceAccount);
      }
      onResult(await simulateViaWs(endpoint, tx));
    } catch (e) {
      onResult({ engineResult: "request failed", message: (e as Error).message, raw: {} });
    } finally {
      setBusy(false);
    }
  }

  const ok = sim?.engineResult === "tesSUCCESS";
  const dangers = intent?.warnings.filter((w) => w.severity === "danger").length ?? 0;

  return (
    <section>
      <div className="screen-head">
        <h2>Simulate</h2>
        <p>
          A dry run against the live testnet (XLS-69 <code>simulate</code>): what the ledger would do with this
          transaction right now. Nothing is signed or submitted.
        </p>
      </div>

      <button className="accent" onClick={run} disabled={busy || !intent}>
        {busy ? "Simulating…" : sim ? "Run again" : "Run dry run"}
      </button>

      {sim && (
        <div className="block">
          <div className={`sim-outcome ${ok ? "ok" : "bad"}`}>
            <span className="sim-code">{sim.engineResult}</span>
            {sim.message && <span className="sim-msg">{sim.message}</span>}
          </div>
          {ok && dangers > 0 && (
            <p className="callout">
              The ledger accepts this transaction. A scam is a perfectly valid transaction: only the display
              metadata sees the {dangers} danger warning{dangers > 1 ? "s" : ""}.
            </p>
          )}
          {sim.engineResult === "srcActNotFound" && !as && (
            <p className="note">This scenario uses a placeholder account. Connect a device on the Sign step, then run again as a funded account.</p>
          )}
          {as && <p className="note">Simulated as the connected device account {as}.</p>}
          {sim.balanceChanges && sim.balanceChanges.length > 0 && (
            <>
              <h3 className="group-h">Projected balance changes</h3>
              <div className="rows">
                {sim.balanceChanges.map((bc) => (
                  <div key={bc.account} className="rowline">
                    <span className="k">{formatAccount(bc.account, defaultRegistry)}</span>
                    <span className="v">
                      {bc.balances.map((b) => `${Number(b.value) >= 0 ? "+" : ""}${b.value} ${b.currency}`).join(", ")}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

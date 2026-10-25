import { useState } from "react";
import { defaultRegistry, formatAccount, type DisplayIntent, type SimulationResult } from "xrpl-clear-signing";
import { simulateViaWs, simulationAccount } from "../xrplnet";
import { PLACEHOLDER_ACCOUNT } from "../samples";

interface Props {
  intent: DisplayIntent | null;
  endpoint: string;
  /** Connected device account: replaces the scenarios' placeholder account when present */
  deviceAccount: string;
  sim: SimulationResult | null;
  onResult: (r: SimulationResult | null) => void;
}

/** Results that come from testnet conditions rather than from the transaction itself. */
const TESTNET_NOTES: Record<string, string> = {
  tecPATH_DRY: "Testnet has no liquidity for this currency pair, so the payment finds no path.",
  terNO_AMM: "Testnet has no pool for this asset pair with the demo issuer.",
  tecTOO_SOON: "An account must be about 256 ledgers (~15 minutes) old before it can be deleted; the throwaway account is newer.",
};

/** Step 3: XLS-69 dry run against current ledger state. Nothing is signed or submitted. */
export function SimulateScreen({ intent, endpoint, deviceAccount, sim, onResult }: Props) {
  const [busy, setBusy] = useState("");
  const [as, setAs] = useState<{ address: string; throwaway: boolean } | null>(null);

  // rippled's simulate answers notImpl for Batch, even when well formed.
  const unsupported = intent?.txType === "Batch";

  async function run() {
    if (!intent) return;
    onResult(null);
    setAs(null);
    try {
      let tx = intent.raw as Record<string, unknown>;
      // simulate needs an existing source account but no signature: use the device's, or a throwaway faucet account.
      if (JSON.stringify(tx).includes(PLACEHOLDER_ACCOUNT)) {
        let address = deviceAccount;
        if (!address) {
          setBusy("Funding a throwaway testnet account…");
          address = await simulationAccount(endpoint);
        }
        tx = JSON.parse(JSON.stringify(tx).split(PLACEHOLDER_ACCOUNT).join(address));
        setAs({ address, throwaway: !deviceAccount });
      }
      setBusy("Simulating…");
      onResult(await simulateViaWs(endpoint, tx));
    } catch (e) {
      onResult({ engineResult: "request failed", message: (e as Error).message, raw: {} });
    } finally {
      setBusy("");
    }
  }

  const ok = sim?.engineResult === "tesSUCCESS";
  const dangers = intent?.warnings.filter((w) => w.severity === "danger").length ?? 0;
  const testnetNote = sim && as?.throwaway ? TESTNET_NOTES[sim.engineResult] : undefined;

  return (
    <section>
      <div className="screen-head">
        <h2>Simulate</h2>
        <p>
          A dry run against the live testnet (XLS-69 <code>simulate</code>): what the ledger would do with this
          transaction right now. Nothing is signed or submitted.
        </p>
      </div>

      {unsupported ? (
        <p className="callout">
          The ledger's <code>simulate</code> doesn't support Batch transactions yet. For a Batch, the static rendering
          on the Review step is the only preview there is, which is why the standard requires it to work offline.
        </p>
      ) : (
        <button className="accent" onClick={run} disabled={!!busy || !intent}>
          {busy || (sim ? "Run again" : "Run dry run")}
        </button>
      )}

      {sim && !unsupported && (
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
          {testnetNote && <p className="note">{testnetNote}</p>}
          {as && (
            <p className="note">
              Simulated as {as.throwaway ? "a throwaway testnet account" : "the connected device account"} {as.address}.
            </p>
          )}
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

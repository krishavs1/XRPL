import { useMemo, useState } from "react";
import {
  DEFAULT_TESTNET_RPC,
  explain,
  simulateTx,
  type DisplayIntent,
  type SimulationResult,
} from "xrpl-clear-signing";
import { samples } from "./samples";

function IntentCard({ intent, nested = false }: { intent: DisplayIntent; nested?: boolean }) {
  return (
    <div className={nested ? "card nested" : "card"}>
      <h2>{intent.title}</h2>
      <p className="summary">{intent.summary}</p>
      {intent.warnings.length > 0 && (
        <ul className="warnings">
          {intent.warnings.map((w, i) => (
            <li key={i} className={`warning ${w.severity}`}>
              <strong>{w.code}</strong> {w.message}
            </li>
          ))}
        </ul>
      )}
      <table>
        <tbody>
          {intent.fields.map((f, i) => (
            <tr key={i} className={f.risk ? `risk-${f.risk}` : ""}>
              <td className="label">{f.label}</td>
              <td>{f.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {intent.inner?.map((inner, i) => (
        <IntentCard key={i} intent={inner} nested />
      ))}
    </div>
  );
}

export function App() {
  const [input, setInput] = useState(JSON.stringify(samples[0].tx, null, 2));
  const [endpoint, setEndpoint] = useState(DEFAULT_TESTNET_RPC);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const result = useMemo(() => {
    try {
      return { intent: explain(input), error: null as string | null };
    } catch (e) {
      return { intent: null, error: (e as Error).message };
    }
  }, [input]);

  async function runSimulation() {
    if (!result.intent) return;
    setSimBusy(true);
    setSim(null);
    try {
      setSim(await simulateTx(result.intent.raw as Record<string, unknown>, endpoint));
    } catch (e) {
      setSim({ engineResult: "request failed", message: (e as Error).message, raw: {} });
    } finally {
      setSimBusy(false);
    }
  }

  return (
    <main>
      <header>
        <h1>XRPL Clear Signing</h1>
        <p>
          Paste a signing blob (hex) or transaction JSON. See what you are actually signing —
          decoded, risk-checked, and dry-run against the live ledger.
        </p>
      </header>
      <div className="columns">
        <section>
          <div className="samples">
            {samples.map((s) => (
              <button key={s.name} onClick={() => setInput(JSON.stringify(s.tx, null, 2))}>
                {s.name}
              </button>
            ))}
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            rows={22}
          />
          <div className="simulate">
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="JSON-RPC endpoint (QuickNode or public testnet)"
            />
            <button onClick={runSimulation} disabled={simBusy || !result.intent}>
              {simBusy ? "Simulating…" : "Simulate (XLS-69)"}
            </button>
          </div>
        </section>
        <section>
          {result.error && <div className="card error">Cannot parse input: {result.error}</div>}
          {result.intent && <IntentCard intent={result.intent} />}
          {sim && (
            <div className="card">
              <h2>Dry run (simulate)</h2>
              <p className="summary">
                Result: <strong>{sim.engineResult}</strong>
                {sim.message ? ` — ${sim.message}` : ""}
              </p>
              {sim.balanceChanges?.map((bc) => (
                <div key={bc.account}>
                  <p className="label">{bc.account}</p>
                  <ul>
                    {bc.balances.map((b, i) => (
                      <li key={i}>
                        {Number(b.value) >= 0 ? "+" : ""}
                        {b.value} {b.currency}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

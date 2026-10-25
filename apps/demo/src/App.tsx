import { useMemo, useState } from "react";
import { encode } from "xrpl";
import { explain, type DisplayIntent, type SimulationResult } from "xrpl-clear-signing";
import { DEFAULT_WSS, simulateViaWs } from "./xrplnet";
import { samples } from "./samples";
import { LedgerPanel } from "./LedgerPanel";

function IntentView({ intent, nested = false }: { intent: DisplayIntent; nested?: boolean }) {
  return (
    <div className={nested ? "inner" : undefined}>
      {!nested &&
        intent.warnings.map((w, i) => (
          <div key={i} className={`band ${w.severity}`}>
            <code>{w.code}</code> {w.message}
          </div>
        ))}
      <p className="intent-title">
        {intent.title}
        <span className="txtype">{intent.txType}</span>
      </p>
      <p className="intent-summary">{intent.summary}</p>
      {nested &&
        intent.warnings.map((w, i) => (
          <div key={i} className={`band ${w.severity}`}>
            <code>{w.code}</code> {w.message}
          </div>
        ))}
      <div className="rows">
        {intent.fields.map((f, i) => (
          <div key={i} className={`rowline${f.risk ? ` ${f.risk}` : ""}`}>
            <span className="k">{f.label}</span>
            <span className="v">{f.value}</span>
          </div>
        ))}
      </div>
      {intent.inner?.map((inner, i) => (
        <IntentView key={i} intent={inner} nested />
      ))}
    </div>
  );
}

export function App() {
  const [input, setInput] = useState(JSON.stringify(samples[0].tx, null, 2));
  const [endpoint, setEndpoint] = useState(DEFAULT_WSS);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);

  const result = useMemo(() => {
    try {
      return { intent: explain(input), error: null as string | null };
    } catch (e) {
      return { intent: null, error: (e as Error).message };
    }
  }, [input]);

  const inputIsHex = !input.trim().startsWith("{");
  const hex = useMemo(() => {
    if (!result.intent) return null;
    if (inputIsHex) return input.trim();
    try {
      return encode(result.intent.raw as any);
    } catch {
      return null; // partial tx (missing required fields) — fine before autofill
    }
  }, [result.intent, input, inputIsHex]);

  async function runSimulation() {
    if (!result.intent) return;
    setSimBusy(true);
    setSim(null);
    try {
      setSim(await simulateViaWs(endpoint, result.intent.raw as Record<string, unknown>));
    } catch (e) {
      setSim({ engineResult: "request failed", message: (e as Error).message, raw: {} });
    } finally {
      setSimBusy(false);
    }
  }

  return (
    <>
      <header>
        <h1>xrpl-clear-signing</h1>
        <span className="meta">transaction display metadata for XRPL · draft spec + reference parser · testnet</span>
      </header>
      <main>
        <section className="pane left">
          <div className="toolbar">
            <select
              value=""
              onChange={(e) => {
                const s = samples.find((x) => x.name === e.target.value);
                if (s) {
                  setInput(JSON.stringify(s.tx, null, 2));
                  setSim(null);
                }
              }}
            >
              <option value="" disabled>
                Load fixture…
              </option>
              {samples.map((s) => (
                <option key={s.name} value={s.name}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            spellCheck={false}
            aria-label="Transaction JSON or signing blob hex"
          />
          <p className="input-meta">
            {inputIsHex
              ? `input: signing blob · ${Math.floor(input.trim().length / 2)} bytes`
              : `input: tx JSON${hex ? ` · serializes to ${hex.length / 2} bytes` : " · not yet serializable (pre-autofill)"}`}
          </p>
          {hex && !inputIsHex && (
            <details className="hexview">
              <summary>serialized hex</summary>
              <pre>{hex}</pre>
            </details>
          )}
        </section>
        <section className="pane">
          {result.error && <div className="error-inline">cannot parse input: {result.error}</div>}
          {result.intent && <IntentView intent={result.intent} />}

          <div className="section">
            <h2>Dry run — simulate (XLS-69)</h2>
            <div className="controls">
              <input
                value={endpoint}
                onChange={(e) => setEndpoint(e.target.value)}
                aria-label="JSON-RPC endpoint"
              />
              <button onClick={runSimulation} disabled={simBusy || !result.intent}>
                {simBusy ? "simulating…" : "simulate"}
              </button>
            </div>
            {sim && (
              <div className="simresult">
                <span className={sim.engineResult === "tesSUCCESS" ? "ok" : "bad"}>
                  {sim.engineResult}
                </span>
                {sim.message ? ` — ${sim.message}` : ""}
                {sim.balanceChanges?.map((bc) => (
                  <div key={bc.account}>
                    {bc.account}:{" "}
                    {bc.balances
                      .map((b) => `${Number(b.value) >= 0 ? "+" : ""}${b.value} ${b.currency}`)
                      .join(", ")}
                  </div>
                ))}
              </div>
            )}
          </div>

          <LedgerPanel
            tx={(result.intent?.raw as Record<string, unknown>) ?? null}
            onPrepared={(tx) => setInput(JSON.stringify(tx, null, 2))}
          />
        </section>
      </main>
    </>
  );
}

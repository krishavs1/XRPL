import { useMemo, useState } from "react";
import { explain } from "xrpl-clear-signing";
import { samples } from "../samples";
import { FeedPanel } from "../FeedPanel";
import type { Source } from "../App";

type Tab = "scenarios" | "feed" | "paste";

interface Props {
  source: Source;
  input: string;
  endpoint: string;
  onPick: (tx: Record<string, unknown> | string, source: Source) => void;
}

/** Step 1: pick a transaction from a scenario, the live ledger, or paste one. */
export function ChooseScreen({ source, input, endpoint, onPick }: Props) {
  const [tab, setTab] = useState<Tab>("scenarios");
  const [draft, setDraft] = useState("");
  const [draftError, setDraftError] = useState("");

  // Severity tags come from the parser itself, never hand-written per fixture.
  const cards = useMemo(
    () =>
      samples.map((s) => {
        const w = explain(s.tx).warnings;
        const tone = w.some((x) => x.severity === "danger") ? "danger" : w.some((x) => x.severity === "warn") ? "warn" : "clean";
        return { ...s, tone };
      }),
    []
  );
  const groups = [
    { title: "Scams & risks", items: cards.filter((c) => c.tone !== "clean") },
    { title: "Safe", items: cards.filter((c) => c.tone === "clean") },
  ];

  function reviewDraft() {
    const text = draft.trim();
    try {
      explain(text);
      setDraftError("");
      onPick(text, { id: "paste", label: "Pasted transaction" });
    } catch (e) {
      setDraftError((e as Error).message);
    }
  }

  return (
    <section>
      <div className="screen-head">
        <h2>Choose a transaction</h2>
        <p>Pick a scenario, grab one off the live ledger, or paste your own JSON or signing blob.</p>
      </div>

      <div className="segmented" role="tablist">
        {(["scenarios", "feed", "paste"] as Tab[]).map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? "on" : ""} onClick={() => setTab(t)}>
            {t === "scenarios" ? "Scenarios" : t === "feed" ? "Live ledger" : "Paste"}
          </button>
        ))}
      </div>

      {tab === "scenarios" &&
        groups.map((g) => (
          <div key={g.title}>
            <h3 className="group-h">{g.title}</h3>
            <div className="cards">
              {g.items.map((c) => (
                <button
                  key={c.id}
                  className={`card${source.id === c.id ? " selected" : ""}`}
                  onClick={() => onPick(c.tx, { id: c.id, label: c.title })}
                >
                  <span className={`tag ${c.tone}`}>{c.tone}</span>
                  <span className="card-title">{c.title}</span>
                  <span className="card-blurb">{c.blurb}</span>
                </button>
              ))}
            </div>
          </div>
        ))}

      {tab === "feed" && (
        <div className="tab-body">
          <FeedPanel endpoint={endpoint} onPick={(tx) => onPick(tx, { id: "feed", label: `Live: ${tx.TransactionType}` })} />
        </div>
      )}

      {tab === "paste" && (
        <div className="tab-body">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder='{"TransactionType": "Payment", …}  or  1200002280000000…'
            spellCheck={false}
            aria-label="Transaction JSON or signing blob hex"
          />
          <div className="controls">
            <button className="accent" onClick={reviewDraft} disabled={!draft.trim()}>
              Review this transaction
            </button>
            {source.id !== "paste" && (
              <button onClick={() => setDraft(input)}>Start from the current transaction</button>
            )}
          </div>
          {draftError && <p className="error-inline">Can't read this: {draftError}</p>}
        </div>
      )}
    </section>
  );
}

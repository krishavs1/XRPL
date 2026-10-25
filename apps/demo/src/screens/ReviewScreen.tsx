import { useMemo } from "react";
import { encode } from "xrpl";
import type { DisplayIntent } from "xrpl-clear-signing";

function Warnings({ intent }: { intent: DisplayIntent }) {
  return (
    <>
      {intent.warnings.map((w, i) => (
        <div key={i} className={`band ${w.severity}`}>
          <code>{w.code}</code> {w.message}
        </div>
      ))}
    </>
  );
}

function Fields({ intent }: { intent: DisplayIntent }) {
  return (
    <div className="rows">
      {intent.fields.map((f, i) => (
        <div key={i} className={`rowline${f.risk ? ` ${f.risk}` : ""}`}>
          <span className="k">{f.label}</span>
          <span className="v">{f.value}</span>
        </div>
      ))}
    </div>
  );
}

/** Step 2: the decoded intent: verdict, warnings, then the fields. */
export function ReviewScreen({ intent, error, input }: { intent: DisplayIntent | null; error: string | null; input: string }) {
  const inputIsHex = !input.trim().startsWith("{");
  const hex = useMemo(() => {
    if (!intent) return null;
    if (inputIsHex) return input.trim();
    try {
      return encode(intent.raw as any);
    } catch {
      return null; // partial tx (missing required fields): fine before autofill
    }
  }, [intent, input, inputIsHex]);

  if (!intent) {
    return (
      <section>
        <div className="screen-head">
          <h2>Review</h2>
        </div>
        <p className="error-inline">Can't parse the transaction: {error}</p>
      </section>
    );
  }

  const dangers = intent.warnings.filter((w) => w.severity === "danger").length;
  const others = intent.warnings.length - dangers;
  const verdict = dangers
    ? { tone: "danger", text: `${dangers} danger warning${dangers > 1 ? "s" : ""}: rejecting is recommended` }
    : others
      ? { tone: "warn", text: `${others} warning${others > 1 ? "s" : ""} to check` }
      : { tone: "clean", text: "No warnings" };
  // A Batch's bubbled-up inner warnings and "#1 Payment" summary rows are shown
  // once, inside each inner transaction's own block below.
  const hasInner = !!intent.inner?.length;
  const outer = {
    ...intent,
    warnings: hasInner ? intent.warnings.filter((w) => !w.message.startsWith("[inner ")) : intent.warnings,
    fields: hasInner ? intent.fields.filter((f) => !/^#\d+ /.test(f.label)) : intent.fields,
  };

  return (
    <section>
      <div className="screen-head">
        <span className="eyebrow">{intent.txType}</span>
        <h2>{intent.title}</h2>
        <p className="summary">{intent.summary}</p>
        <span className={`verdict ${verdict.tone}`}>{verdict.text}</span>
      </div>

      {outer.warnings.length > 0 && (
        <div className="block">
          <h3 className="group-h">Warnings</h3>
          <Warnings intent={outer} />
        </div>
      )}

      <div className="block">
        <h3 className="group-h">Details</h3>
        <Fields intent={outer} />
      </div>

      {intent.inner?.map((inner, i) => (
        <div key={i} className="block inner">
          <h3 className="group-h">
            Inner transaction {i + 1} of {intent.inner!.length}
          </h3>
          <p className="intent-title">{inner.title}</p>
          <p className="summary">{inner.summary}</p>
          <Warnings intent={inner} />
          <Fields intent={inner} />
        </div>
      ))}

      <details className="hexview block">
        <summary>Raw transaction{hex ? ` · ${hex.length / 2} bytes` : ""}</summary>
        <pre>{JSON.stringify(intent.raw, null, 2)}</pre>
        {hex ? <pre>{hex}</pre> : <p className="input-meta">Not serializable yet: autofill adds the missing fields at signing.</p>}
      </details>
    </section>
  );
}

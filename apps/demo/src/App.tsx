import { useEffect, useMemo, useState } from "react";
import { explain, type SimulationResult } from "xrpl-clear-signing";
import { DEFAULT_WSS } from "./xrplnet";
import { samples } from "./samples";
import { Nav, type NavStep } from "./Nav";
import { Settings } from "./Settings";
import { ChooseScreen } from "./screens/ChooseScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SimulateScreen } from "./screens/SimulateScreen";
import { SignScreen } from "./screens/SignScreen";

const STEPS = ["choose", "review", "simulate", "sign"] as const;
type Step = (typeof STEPS)[number];
const LABELS: Record<Step, string> = { choose: "Choose", review: "Review", simulate: "Simulate", sign: "Sign" };

/** The current step lives in the URL hash, so a refresh mid-demo keeps your place. */
function useStep(): [Step, (s: Step) => void] {
  const read = (): Step => {
    const h = window.location.hash.replace(/^#\/?/, "") as Step;
    return STEPS.includes(h) ? h : "choose";
  };
  const [step, setStep] = useState<Step>(read);
  useEffect(() => {
    const onHash = () => setStep(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (s: Step) => {
    window.location.hash = `/${s}`;
    window.scrollTo(0, 0);
  };
  return [step, go];
}

/** sessionStorage can throw (private mode, blocked storage); the demo works without it. */
function load(key: string): string | null {
  try {
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}
function save(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value);
  } catch {}
}

export interface Source {
  /** Scenario id, or "paste" / "feed" */
  id: string;
  label: string;
}

export function App() {
  const [step, go] = useStep();
  const [input, setInput] = useState(() => load("cs.input") ?? JSON.stringify(samples[0].tx, null, 2));
  const [source, setSource] = useState<Source>(() => {
    try {
      return JSON.parse(load("cs.source") ?? "") as Source;
    } catch {
      return { id: samples[0].id, label: samples[0].title };
    }
  });
  const [endpoint, setEndpoint] = useState(DEFAULT_WSS);
  const [sim, setSim] = useState<SimulationResult | null>(null);
  const [deviceAccount, setDeviceAccount] = useState("");
  const [signStatus, setSignStatus] = useState("not connected");

  useEffect(() => save("cs.input", input), [input]);
  useEffect(() => save("cs.source", JSON.stringify(source)), [source]);

  const result = useMemo(() => {
    try {
      return { intent: explain(input), error: null as string | null };
    } catch (e) {
      return { intent: null, error: (e as Error).message };
    }
  }, [input]);
  const intent = result.intent;

  function pick(tx: Record<string, unknown> | string, src: Source) {
    setInput(typeof tx === "string" ? tx : JSON.stringify(tx, null, 2));
    setSource(src);
    setSim(null);
    go("review");
  }

  const dangers = intent?.warnings.filter((w) => w.severity === "danger").length ?? 0;
  const warns = intent?.warnings.filter((w) => w.severity === "warn").length ?? 0;
  const status: Record<Step, Pick<NavStep, "status" | "tone">> = {
    choose: { status: source.label },
    review: !intent
      ? { status: "nothing to review" }
      : dangers
        ? { status: `${dangers} danger${warns ? ` · ${warns} warning${warns > 1 ? "s" : ""}` : ""}`, tone: "danger" }
        : warns
          ? { status: `${warns} warning${warns > 1 ? "s" : ""}`, tone: "warn" }
          : { status: "no warnings", tone: "ok" },
    simulate: sim ? { status: sim.engineResult, tone: sim.engineResult === "tesSUCCESS" ? "ok" : "danger" } : { status: "not run" },
    sign: { status: signStatus },
  };
  const navSteps: NavStep[] = STEPS.map((s) => ({ id: s, label: LABELS[s], ...status[s] }));

  const i = STEPS.indexOf(step);
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];

  return (
    <>
      <header>
        <div className="brand">
          <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
            <g fill="#006aff">
              <circle cx="24" cy="13" r="6.5" />
              <circle cx="14" cy="31" r="6.5" />
              <circle cx="34" cy="31" r="6.5" />
            </g>
          </svg>
          <h1>XRPL Clear Signing</h1>
        </div>
        <Settings endpoint={endpoint} onChange={setEndpoint} />
      </header>
      <div className="shell">
        <Nav steps={navSteps} current={step} onGo={(s) => go(s as Step)} />
        <main className="content">
          {/* Every screen stays mounted so the device connection and feed survive navigation. */}
          <div hidden={step !== "choose"}>
            <ChooseScreen source={source} input={input} endpoint={endpoint} onPick={pick} />
          </div>
          <div hidden={step !== "review"}>
            <ReviewScreen intent={intent} error={result.error} input={input} />
          </div>
          <div hidden={step !== "simulate"}>
            <SimulateScreen
              intent={intent}
              endpoint={endpoint}
              deviceAccount={deviceAccount}
              sim={sim}
              onResult={setSim}
            />
          </div>
          <div hidden={step !== "sign"}>
            <SignScreen
              intent={intent}
              endpoint={endpoint}
              onPrepared={(tx) => setInput(JSON.stringify(tx, null, 2))}
              onAddress={setDeviceAccount}
              onStatus={setSignStatus}
            />
          </div>
          <footer className="step-footer">
            {prev ? <button onClick={() => go(prev)}>← {LABELS[prev]}</button> : <span />}
            {next && (
              <button className="accent" onClick={() => go(next)} disabled={!intent}>
                {LABELS[next]} →
              </button>
            )}
          </footer>
        </main>
      </div>
    </>
  );
}

import { useEffect, useMemo, useRef, useState } from "react";
import { explain, type SimulationResult } from "xrpl-clear-signing";
import { DEFAULT_WSS } from "./xrplnet";
import { samples } from "./samples";
import { loadActivity, recordOpened, saveActivity, updateEntry, type ActivityEntry } from "./activity";
import { Nav, type NavStep } from "./Nav";
import { Settings } from "./Settings";
import { HomeScreen } from "./screens/HomeScreen";
import { HistoryScreen } from "./screens/HistoryScreen";
import { ChooseScreen } from "./screens/ChooseScreen";
import { ReviewScreen } from "./screens/ReviewScreen";
import { SimulateScreen } from "./screens/SimulateScreen";
import { SignScreen } from "./screens/SignScreen";

const STEPS = ["choose", "review", "simulate", "sign"] as const;
type Step = (typeof STEPS)[number];
type Route = "home" | "history" | Step;
const LABELS: Record<Step, string> = { choose: "Choose", review: "Review", simulate: "Simulate", sign: "Sign" };
const isStep = (r: Route): r is Step => (STEPS as readonly string[]).includes(r);

/** The current page lives in the URL hash, so a refresh mid-demo keeps your place. */
function useRoute(): [Route, (r: Route) => void] {
  const read = (): Route => {
    const h = window.location.hash.replace(/^#\/?/, "") as Route;
    return h === "history" || isStep(h) ? h : "home";
  };
  const [route, setRoute] = useState<Route>(read);
  useEffect(() => {
    const onHash = () => setRoute(read());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const go = (r: Route) => {
    window.location.hash = r === "home" ? "/" : `/${r}`;
    window.scrollTo(0, 0);
  };
  return [route, go];
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
  /** Scenario id, or "paste" / "feed" / "ledger" / "activity" */
  id: string;
  label: string;
}

export function App() {
  const [route, go] = useRoute();
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
  const [activity, setActivity] = useState<ActivityEntry[]>(loadActivity);
  /** The activity entry for the transaction currently in the check flow */
  const entryId = useRef<string | null>(load("cs.entry"));
  const lastStep = useRef<Step>("choose");

  useEffect(() => save("cs.input", input), [input]);
  useEffect(() => save("cs.source", JSON.stringify(source)), [source]);
  useEffect(() => saveActivity(activity), [activity]);
  if (isStep(route)) lastStep.current = route;

  const result = useMemo(() => {
    try {
      return { intent: explain(input), error: null as string | null };
    } catch (e) {
      return { intent: null, error: (e as Error).message };
    }
  }, [input]);
  const intent = result.intent;

  function pick(tx: Record<string, unknown> | string, src: Source) {
    const text = typeof tx === "string" ? tx : JSON.stringify(tx, null, 2);
    setInput(text);
    setSource(src);
    setSim(null);
    try {
      const [list, id] = recordOpened(activity, text, src.label, explain(text));
      setActivity(list);
      entryId.current = id;
      save("cs.entry", id);
    } catch {}
    go("review");
  }

  function patchEntry(patch: Partial<ActivityEntry>) {
    const id = entryId.current;
    if (id) setActivity((list) => updateEntry(list, id, patch));
  }

  const openEntry = (e: ActivityEntry) => pick(e.input, { id: "activity", label: e.source });

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

  const inFlow = isStep(route);
  const i = inFlow ? STEPS.indexOf(route) : -1;
  const prev = STEPS[i - 1];
  const next = STEPS[i + 1];

  return (
    <>
      <header>
        <button className="brand" onClick={() => go("home")} aria-label="Home">
          <svg width="26" height="26" viewBox="0 0 48 48" aria-hidden="true">
            <g fill="#006aff">
              <circle cx="24" cy="13" r="6.5" />
              <circle cx="14" cy="31" r="6.5" />
              <circle cx="34" cy="31" r="6.5" />
            </g>
          </svg>
          <h1>XRPL Clear Signing</h1>
        </button>
        <nav className="topnav" aria-label="Main">
          <button className={route === "home" ? "on" : ""} onClick={() => go("home")}>
            Home
          </button>
          <button className={inFlow ? "on" : ""} onClick={() => go(lastStep.current)}>
            Check
          </button>
          <button className={route === "history" ? "on" : ""} onClick={() => go("history")}>
            History
          </button>
        </nav>
        <Settings endpoint={endpoint} onChange={setEndpoint} />
      </header>
      <div className={`shell${inFlow ? "" : " solo"}`}>
        {inFlow && <Nav steps={navSteps} current={route} onGo={(s) => go(s as Step)} />}
        <main className="content">
          <div hidden={route !== "home"}>
            <HomeScreen activity={activity} onStart={() => go("choose")} onOpen={openEntry} onHistory={() => go("history")} />
          </div>
          <div hidden={route !== "history"}>
            <HistoryScreen
              activity={activity}
              onOpen={openEntry}
              onClear={() => setActivity([])}
              endpoint={endpoint}
              deviceAccount={deviceAccount}
              onOpenTx={(tx, label) => pick(tx, { id: "ledger", label })}
            />
          </div>
          {/* Every check screen stays mounted so the device connection and feed survive navigation. */}
          <div hidden={route !== "choose"}>
            <ChooseScreen source={source} input={input} endpoint={endpoint} onPick={pick} />
          </div>
          <div hidden={route !== "review"}>
            <ReviewScreen intent={intent} error={result.error} input={input} />
          </div>
          <div hidden={route !== "simulate"}>
            <SimulateScreen
              intent={intent}
              endpoint={endpoint}
              deviceAccount={deviceAccount}
              sim={sim}
              onResult={(r) => {
                setSim(r);
                if (r) patchEntry({ simulated: r.engineResult });
              }}
            />
          </div>
          <div hidden={route !== "sign"}>
            <SignScreen
              intent={intent}
              endpoint={endpoint}
              onPrepared={(tx) => setInput(JSON.stringify(tx, null, 2))}
              onAddress={setDeviceAccount}
              onStatus={setSignStatus}
              onSigned={(r) => patchEntry({ signed: r })}
            />
          </div>
          {inFlow && (
            <footer className="step-footer">
              {prev ? <button onClick={() => go(prev)}>← {LABELS[prev]}</button> : <span />}
              {next && (
                <button className="accent" onClick={() => go(next)} disabled={!intent}>
                  {LABELS[next]} →
                </button>
              )}
            </footer>
          )}
        </main>
      </div>
    </>
  );
}

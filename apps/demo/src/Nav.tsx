export interface NavStep {
  id: string;
  label: string;
  /** One line under the label: what this step currently holds */
  status?: string;
  tone?: "danger" | "warn" | "ok";
}

/** Sidebar stepper: the demo's steps in order, each one clickable. */
export function Nav({ steps, current, onGo }: { steps: NavStep[]; current: string; onGo: (id: string) => void }) {
  const at = steps.findIndex((s) => s.id === current);
  return (
    <nav className="nav" aria-label="Steps">
      <ol>
        {steps.map((s, i) => (
          <li key={s.id} className={`nav-step${s.id === current ? " current" : ""}${i < at ? " done" : ""}`}>
            <button onClick={() => onGo(s.id)} aria-current={s.id === current ? "step" : undefined}>
              <span className="num">{i + 1}</span>
              <span className="text">
                <span className="label">{s.label}</span>
                {s.status && <span className={`status${s.tone ? ` ${s.tone}` : ""}`}>{s.status}</span>}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}

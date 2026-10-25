import type { ActivityEntry } from "../activity";
import { ActivityList } from "../ActivityList";
import { HeroScene } from "../HeroScene";

interface Props {
  activity: ActivityEntry[];
  onStart: () => void;
  onOpen: (e: ActivityEntry) => void;
  onHistory: () => void;
}

const HOW = [
  { n: "1", title: "Decode", text: "Paste any XRPL transaction, or pick a scenario. It becomes one plain-English sentence with standard risk warnings." },
  { n: "2", title: "Simulate", text: "Dry-run it against the live ledger to see what would actually happen, before anything is signed." },
  { n: "3", title: "Sign safely", text: "Compare today's Ledger screen with the clear-signing one, and sign only after acknowledging any danger." },
];

/** Landing: the pitch, a way in, and your recent checks. */
export function HomeScreen({ activity, onStart, onOpen, onHistory }: Props) {
  return (
    <section className="home">
      <div className="hero">
        <div>
          <span className="tagline">XRPL clear signing</span>
          <h2>Stop blind-signing.</h2>
          <p>
            See what an XRP Ledger transaction really does before you sign it: in plain English, with the same risk
            warnings in every wallet, down to a hardware wallet's screen.
          </p>
          <button className="accent big" onClick={onStart}>
            ▼ Check a transaction ▼
          </button>
        </div>
        <HeroScene />
      </div>

      <div className="how">
        {HOW.map((h) => (
          <div key={h.n} className="how-step">
            <span className="num">{h.n}</span>
            <span className="how-title">{h.title}</span>
            <span className="how-text">{h.text}</span>
          </div>
        ))}
      </div>

      {activity.length > 0 && (
        <div className="block">
          <div className="row-head">
            <h3 className="group-h">Recent activity</h3>
            <button className="link" onClick={onHistory}>
              See all history →
            </button>
          </div>
          <ActivityList items={activity.slice(0, 4)} onOpen={onOpen} />
        </div>
      )}
    </section>
  );
}

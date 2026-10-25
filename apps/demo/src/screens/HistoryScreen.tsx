import { useEffect, useState } from "react";
import { isValidClassicAddress } from "xrpl";
import { explain, type DisplayIntent } from "xrpl-clear-signing";
import type { ActivityEntry } from "../activity";
import { ActivityList } from "../ActivityList";
import { accountHistory, type LedgerTx } from "../xrplnet";

type Tab = "mine" | "address";

interface Props {
  activity: ActivityEntry[];
  onOpen: (e: ActivityEntry) => void;
  onClear: () => void;
  endpoint: string;
  /** Connected device account, offered as the default address to look up */
  deviceAccount: string;
  onOpenTx: (tx: Record<string, unknown>, label: string) => void;
}

interface Row extends LedgerTx {
  intent: DisplayIntent | null;
}

/** Your checks in this browser, and any address's real on-ledger history, decoded. */
export function HistoryScreen({ activity, onOpen, onClear, endpoint, deviceAccount, onOpenTx }: Props) {
  const [tab, setTab] = useState<Tab>("mine");
  const [address, setAddress] = useState(deviceAccount);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [looked, setLooked] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (deviceAccount && !address) setAddress(deviceAccount);
  }, [deviceAccount]);

  async function lookUp() {
    const a = address.trim();
    if (!isValidClassicAddress(a)) return setError("That isn't a valid XRPL address (r…).");
    setBusy(true);
    setError("");
    setRows(null);
    try {
      const txs = await accountHistory(endpoint, a);
      setRows(
        txs.map((t) => {
          try {
            return { ...t, intent: explain(t.tx) };
          } catch {
            return { ...t, intent: null };
          }
        })
      );
      setLooked(a);
    } catch (e: any) {
      setError(e?.data?.error === "actNotFound" ? "No such account on this network." : (e?.message ?? String(e)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="screen-head">
        <h2>History</h2>
        <p>What you've checked in this browser, and the decoded on-ledger history of any address.</p>
      </div>

      <div className="segmented" role="tablist">
        <button role="tab" aria-selected={tab === "mine"} className={tab === "mine" ? "on" : ""} onClick={() => setTab("mine")}>
          My activity
        </button>
        <button role="tab" aria-selected={tab === "address"} className={tab === "address" ? "on" : ""} onClick={() => setTab("address")}>
          Address history
        </button>
      </div>

      {tab === "mine" && (
        <div className="tab-body">
          {activity.length ? (
            <>
              <ActivityList items={activity} onOpen={onOpen} />
              <div className="row-head">
                <p className="note">Saved only in this browser. Nothing is uploaded.</p>
                <button className="link" onClick={() => confirm("Clear your activity in this browser?") && onClear()}>
                  Clear activity
                </button>
              </div>
            </>
          ) : (
            <p className="empty">Nothing yet. Transactions you check show up here.</p>
          )}
        </div>
      )}

      {tab === "address" && (
        <div className="tab-body">
          <div className="controls">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && lookUp()}
              placeholder="r… address"
              aria-label="XRPL address"
              spellCheck={false}
            />
            <button className="accent" onClick={lookUp} disabled={busy || !address.trim()}>
              {busy ? "Loading…" : "Look up"}
            </button>
          </div>
          {error && <p className="error-inline">{error}</p>}
          {rows && rows.length === 0 && <p className="empty">No transactions for this account yet.</p>}
          {rows && rows.length > 0 && (
            <div className="list">
              {rows.map((r) => {
                const w = r.intent?.warnings ?? [];
                const d = w.filter((x) => x.severity === "danger").length;
                const wn = w.filter((x) => x.severity === "warn").length;
                const tone = d ? "danger" : wn ? "warn" : "clean";
                const incoming = r.tx.Account !== looked;
                return (
                  <button
                    key={r.hash}
                    className="list-row"
                    onClick={() => onOpenTx(r.tx, `Ledger: ${r.intent?.title ?? r.tx.TransactionType}`)}
                  >
                    <span className={`tag ${tone}`}>{d ? `${d} danger` : wn ? `${wn} warning${wn > 1 ? "s" : ""}` : "clean"}</span>
                    <span className="list-main">
                      <span className="list-title">
                        {r.intent?.title ?? r.tx.TransactionType}
                        {incoming && <span className="pill">incoming</span>}
                      </span>
                      <span className="list-sub">{r.intent?.summary ?? "Could not decode this transaction."}</span>
                    </span>
                    <span className="list-meta">
                      {r.result && <span className={r.result === "tesSUCCESS" ? "ok" : "bad"}>{r.result}</span>}
                      {r.date && <span>{new Date(r.date).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <p className="note">Read from the network set in the header (testnet by default). Click a row to review it.</p>
        </div>
      )}
    </section>
  );
}

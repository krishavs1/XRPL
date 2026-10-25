import { useEffect, useRef, useState } from "react";

interface FeedTx {
  hash: string;
  type: string;
  account: string;
  destination?: string;
  time: string;
  tx: Record<string, unknown>;
}

interface Props {
  endpoint: string;
  /** Load a transaction from the feed into the preview. */
  onPick: (tx: Record<string, unknown>) => void;
}

/**
 * Live validated-transaction stream over WebSocket (rippled `subscribe`,
 * transactions stream). Click a row to run it through the preview.
 */
export function FeedPanel({ endpoint, onPick }: Props) {
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<FeedTx[]>([]);
  const [error, setError] = useState("");
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!running) {
      ws.current?.close();
      ws.current = null;
      return;
    }
    setError("");
    const socket = new WebSocket(endpoint);
    ws.current = socket;
    socket.onopen = () =>
      socket.send(JSON.stringify({ id: "feed", command: "subscribe", streams: ["transactions"] }));
    socket.onmessage = (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.type !== "transaction") return;
      const tx = (msg.tx_json ?? msg.transaction) as Record<string, any> | undefined;
      if (!tx) return;
      const row: FeedTx = {
        hash: msg.hash ?? tx.hash ?? "",
        type: String(tx.TransactionType ?? "?"),
        account: String(tx.Account ?? "?"),
        destination: tx.Destination ? String(tx.Destination) : undefined,
        time: new Date().toLocaleTimeString("en-US", { hour12: false }),
        tx,
      };
      setRows((prev) => [row, ...prev].slice(0, 14));
    };
    socket.onerror = () => setError(`websocket error (${endpoint})`);
    socket.onclose = () => {
      if (ws.current === socket) setRunning(false);
    };
    return () => socket.close();
  }, [running, endpoint]);

  return (
    <div className="section">
      <h2>Live ledger feed</h2>
      <div className="controls">
        <button onClick={() => setRunning((r) => !r)}>{running ? "stop" : "stream validated transactions"}</button>
        <span className="statusline" style={{ margin: 0 }}>
          {running ? `streaming via ${endpoint.replace(/^wss:\/\//, "")} — click a row to decode it` : ""}
        </span>
      </div>
      {error && <p className="error-inline">{error}</p>}
      {rows.length > 0 && (
        <div className="feed">
          {rows.map((r) => (
            <button key={r.hash || r.time + r.account} className="feedrow" onClick={() => onPick(r.tx)}>
              <span className="t">{r.time}</span>
              <span className="ty">{r.type}</span>
              <span className="a">
                {r.account.slice(0, 10)}…{r.destination ? ` → ${r.destination.slice(0, 10)}…` : ""}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

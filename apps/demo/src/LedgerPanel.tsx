import { useState } from "react";
import type { SignerXrp } from "@ledgerhq/device-signer-kit-xrp";
import { SPECULOS_URL, connectDevice, getDeviceAddress, signOnDevice, type TransportChoice } from "./ledger";
import { SpeculosScreen } from "./SpeculosScreen";
import {
  DEFAULT_WSS,
  fundFromFaucet,
  getBalanceOrNull,
  prepareForDevice,
  encodeUnsigned,
  submitSigned,
} from "./xrplnet";

type Stage = "idle" | "preparing" | "awaiting approval" | "signed" | "submitted";
const STAGES: Stage[] = ["idle", "preparing", "awaiting approval", "signed", "submitted"];

interface Props {
  tx: Record<string, unknown> | null;
  /** Called with the autofilled tx so the preview shows exactly what the device signs. */
  onPrepared: (tx: Record<string, unknown>) => void;
}

export function LedgerPanel({ tx, onPrepared }: Props) {
  const [transport, setTransport] = useState<TransportChoice>("speculos");
  const [wss, setWss] = useState(DEFAULT_WSS);
  const [signer, setSigner] = useState<SignerXrp | null>(null);
  const [address, setAddress] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ hash: string; result: string } | null>(null);

  const host = (() => {
    try {
      return new URL(wss).host;
    } catch {
      return wss;
    }
  })();

  async function connect() {
    setBusy(true);
    setError("");
    try {
      const s = await connectDevice(transport);
      setSigner(s);
      const addr = await getDeviceAddress(s);
      setAddress(addr.address);
      setPublicKey(addr.publicKey);
      setBalance(await getBalanceOrNull(wss, addr.address));
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function faucet() {
    setBusy(true);
    setError("");
    try {
      setBalance(await fundFromFaucet(wss, address));
    } catch (e) {
      setError((e as Error).message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    if (!signer || !tx) return;
    setBusy(true);
    setError("");
    setResult(null);
    try {
      setStage("preparing");
      const prepared = await prepareForDevice(wss, tx as Record<string, any>, address, publicKey);
      onPrepared(prepared);
      setStage("awaiting approval");
      const sig = await signOnDevice(signer, encodeUnsigned(prepared));
      setStage("signed");
      const res = await submitSigned(wss, prepared, sig);
      setResult(res);
      setStage("submitted");
    } catch (e) {
      setError((e as Error).message ?? String(e));
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="section">
      <h2>Sign on device</h2>
      <div className="controls">
        <select value={transport} onChange={(e) => setTransport(e.target.value as TransportChoice)}>
          <option value="speculos">Speculos (emulator)</option>
          <option value="usb">USB (real device)</option>
        </select>
        <input value={wss} onChange={(e) => setWss(e.target.value)} aria-label="XRPL WebSocket endpoint" />
        <button onClick={connect} disabled={busy}>
          {signer ? "reconnect" : "connect"}
        </button>
        <button className="accent" onClick={sign} disabled={busy || !signer || !tx || balance === null}>
          sign on device
        </button>
      </div>
      <p className="statusline">
        {signer ? (
          <>
            Connected: Ledger ({transport === "speculos" ? "Speculos emulator" : "USB"}) ·{" "}
            <strong>{address}</strong> ·{" "}
            {balance === null ? (
              <>
                unfunded — <button onClick={faucet} disabled={busy}>get test XRP</button>
              </>
            ) : (
              `${balance} XRP`
            )}{" "}
            · testnet via {host}
          </>
        ) : (
          "Not connected."
        )}
      </p>
      <p className="stages">
        {STAGES.map((s, i) => (
          <span key={s}>
            {i > 0 && " → "}
            <span className={s === stage ? "active" : STAGES.indexOf(stage) > i ? "done" : ""}>{s}</span>
          </span>
        ))}
      </p>
      {result && (
        <p className="statusline">
          <strong>{result.result}</strong> ·{" "}
          <a href={`https://testnet.xrpl.org/transactions/${result.hash}`} target="_blank" rel="noreferrer">
            testnet.xrpl.org/transactions/{result.hash.slice(0, 12)}…
          </a>
        </p>
      )}
      {error && <p className="error-inline">{error}</p>}
      {transport === "speculos" && <SpeculosScreen url={SPECULOS_URL} />}
    </div>
  );
}

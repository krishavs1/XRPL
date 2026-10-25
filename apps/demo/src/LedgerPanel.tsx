import { useEffect, useMemo, useState } from "react";
import type { SignerXrp } from "@ledgerhq/device-signer-kit-xrp";
import { defaultRegistry, toDeviceScreens, type DisplayIntent } from "xrpl-clear-signing";
import { DevicePreview } from "./DevicePreview";
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
  /** The previewed intent: drives the device-profile preview and the danger gate. */
  intent: DisplayIntent | null;
  /** Called with the autofilled tx so the preview shows exactly what the device signs. */
  onPrepared: (tx: Record<string, unknown>) => void;
  /** Called when a device connects, so the rest of the app can use its account. */
  onAddress?: (address: string) => void;
}

export function LedgerPanel({ tx, intent, onPrepared, onAddress }: Props) {
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
  const [acknowledged, setAcknowledged] = useState(false);

  const screens = useMemo(() => (intent ? toDeviceScreens(intent, defaultRegistry) : []), [intent]);
  const dangerCodes = intent?.warnings.filter((w) => w.severity === "danger").map((w) => w.code) ?? [];
  const blocked = dangerCodes.length > 0 && !acknowledged;

  // A new transaction needs a fresh acknowledgement, never a carried-over one.
  const txKey = JSON.stringify(tx);
  useEffect(() => setAcknowledged(false), [txKey]);

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
      onAddress?.(addr.address);
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
        <button
          className={dangerCodes.length ? "danger" : "accent"}
          onClick={sign}
          disabled={busy || !signer || !tx || balance === null || blocked}
        >
          {dangerCodes.length ? "sign anyway" : "sign on device"}
        </button>
      </div>
      {signer && dangerCodes.length > 0 && (
        <label className="ack">
          <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
          <span>
            This transaction has {dangerCodes.length} danger warning{dangerCodes.length === 1 ? "" : "s"} (
            <code>{dangerCodes.join(", ")}</code>). I understand the risk and want to sign it anyway.
          </span>
        </label>
      )}
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
      <div className="device-compare">
        <figure>
          <figcaption>
            <strong>Today</strong> · Ledger XRP app
          </figcaption>
          {transport === "speculos" ? (
            <SpeculosScreen url={SPECULOS_URL} />
          ) : (
            <div className="device-frame off">Look at your connected device.</div>
          )}
        </figure>
        <figure>
          <figcaption>
            <strong>With this standard</strong> · device profile
          </figcaption>
          {screens.length ? <DevicePreview screens={screens} /> : <div className="device-frame off">No transaction loaded.</div>}
        </figure>
      </div>
    </div>
  );
}

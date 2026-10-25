import { useEffect, useMemo, useState } from "react";
import type { SignerXrp } from "@ledgerhq/device-signer-kit-xrp";
import { defaultRegistry, toDeviceScreens, type DisplayIntent } from "xrpl-clear";
import { DevicePreview } from "../DevicePreview";
import { SPECULOS_URL, connectDevice, getDeviceAddress, signOnDevice, type TransportChoice } from "../ledger";
import { SpeculosScreen } from "../SpeculosScreen";
import { fundFromFaucet, getBalanceOrNull, prepareForDevice, encodeUnsigned, submitSigned } from "../xrplnet";

type Stage = "idle" | "preparing" | "awaiting approval" | "signed" | "submitted";
const STAGES: Stage[] = ["idle", "preparing", "awaiting approval", "signed", "submitted"];

interface Props {
  /** The previewed intent: its raw tx is what gets signed; it drives the device preview and the danger gate. */
  intent: DisplayIntent | null;
  endpoint: string;
  /** Called with the autofilled tx so the preview shows exactly what the device signs. */
  onPrepared: (tx: Record<string, unknown>) => void;
  /** Called when a device connects, so the rest of the app can use its account. */
  onAddress?: (address: string) => void;
  /** One-line status for the sidebar */
  onStatus?: (status: string) => void;
  /** Called with the ledger result once a signed transaction is submitted */
  onSigned?: (r: { hash: string; result: string }) => void;
}

/** Step 4: today's Ledger screen next to the clear-signing device profile, then sign. */
export function SignScreen({ intent, endpoint, onPrepared, onAddress, onStatus, onSigned }: Props) {
  const [transport, setTransport] = useState<TransportChoice>("speculos");
  const [signer, setSigner] = useState<SignerXrp | null>(null);
  const [address, setAddress] = useState("");
  const [publicKey, setPublicKey] = useState("");
  const [balance, setBalance] = useState<number | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ hash: string; result: string } | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);

  const tx = (intent?.raw as Record<string, unknown>) ?? null;
  const screens = useMemo(() => (intent ? toDeviceScreens(intent, defaultRegistry) : []), [intent]);
  const dangers = intent?.warnings.filter((w) => w.severity === "danger").length ?? 0;
  const blocked = dangers > 0 && !acknowledged;

  // A Batch replayed from the live feed carries OTHER accounts' inner
  // transactions; signing those needs their BatchSigners, which we can't
  // produce. Viewing and simulating stay available; signing is foreign.
  const foreignBatch =
    tx?.TransactionType === "Batch" &&
    Array.isArray((tx as any).RawTransactions) &&
    (tx as any).RawTransactions.some(
      (w: any) => (w?.RawTransaction ?? w)?.Account && (w?.RawTransaction ?? w).Account !== address
    );

  // A new transaction needs a fresh acknowledgement, never a carried-over one.
  const txKey = JSON.stringify(tx);
  useEffect(() => setAcknowledged(false), [txKey]);

  useEffect(() => {
    onStatus?.(result ? result.result : stage !== "idle" ? stage : signer ? "connected" : "not connected");
  }, [result, stage, signer]);

  async function connect() {
    setBusy(true);
    setError("");
    // Clear any stale identity first, so a failed connect never leaves a
    // "connected but no address" state that then signs with an empty Account.
    setSigner(null);
    setAddress("");
    setBalance(null);
    try {
      const s = await connectDevice(transport);
      const addr = await getDeviceAddress(s);
      if (!addr?.address) throw new Error("Device returned no address - reconnect (restart Speculos if it persists).");
      setSigner(s);
      setAddress(addr.address);
      setPublicKey(addr.publicKey);
      onAddress?.(addr.address);
      setBalance(await getBalanceOrNull(endpoint, addr.address));
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
      setBalance(await fundFromFaucet(endpoint, address));
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
      const prepared = await prepareForDevice(endpoint, tx as Record<string, any>, address, publicKey);
      onPrepared(prepared);
      setStage("awaiting approval");
      const sig = await signOnDevice(signer, encodeUnsigned(prepared));
      setStage("signed");
      const res = await submitSigned(endpoint, prepared, sig);
      setResult(res);
      onSigned?.(res);
      setStage("submitted");
    } catch (e) {
      setError((e as Error).message ?? String(e));
      setStage("idle");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section>
      <div className="screen-head">
        <h2>Sign on device</h2>
        <p>The same transaction on today's Ledger XRP app and on a device following the clear-signing profile.</p>
      </div>

      <div className="connect-bar">
        <select value={transport} onChange={(e) => setTransport(e.target.value as TransportChoice)} aria-label="Device">
          <option value="speculos">Speculos (emulator)</option>
          <option value="usb">USB (real device)</option>
        </select>
        <button onClick={connect} disabled={busy}>
          {signer ? "Reconnect" : "Connect"}
        </button>
        <span className="statusline">
          {signer ? (
            <>
              <strong>{address}</strong> ·{" "}
              {balance === null ? (
                <>
                  unfunded · <button onClick={faucet} disabled={busy || !address}>Get test XRP</button>
                </>
              ) : (
                `${balance} XRP`
              )}
            </>
          ) : (
            "Not connected"
          )}
        </span>
      </div>

      <div className="device-compare">
        <figure>
          <figcaption>
            <strong>Real firmware</strong> · Ledger XRP app, our fork (stock shows no warnings)
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

      <div className="sign-bar">
        {signer && dangers > 0 && (
          <label className="ack">
            <input type="checkbox" checked={acknowledged} onChange={(e) => setAcknowledged(e.target.checked)} />
            <span>
              I've reviewed the {dangers} danger warning{dangers === 1 ? "" : "s"} and want to sign anyway.
            </span>
          </label>
        )}
        <div className="controls">
          <button
            className={dangers ? "danger" : "accent"}
            onClick={sign}
            disabled={busy || !signer || !address || !tx || blocked || foreignBatch}
            title={foreignBatch ? "This Batch contains other accounts' inner transactions; signing it requires their BatchSigners. Load the Batch fixture to sign one of your own." : undefined}
          >
            {dangers ? "Sign anyway" : "Sign on device"}
          </button>
          <span className="stages">
            {STAGES.map((s, i) => (
              <span key={s}>
                {i > 0 && " → "}
                <span className={s === stage ? "active" : STAGES.indexOf(stage) > i ? "done" : ""}>{s}</span>
              </span>
            ))}
          </span>
        </div>
        {result && (
          <p className="statusline">
            <strong>{result.result}</strong> ·{" "}
            <a href={`https://testnet.xrpl.org/transactions/${result.hash}`} target="_blank" rel="noreferrer">
              testnet.xrpl.org/transactions/{result.hash.slice(0, 12)}…
            </a>
          </p>
        )}
        {error && <p className="error-inline">{error}</p>}
      </div>
    </section>
  );
}

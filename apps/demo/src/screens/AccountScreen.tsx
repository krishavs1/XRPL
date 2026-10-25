import { useEffect, useState } from "react";
import { isValidClassicAddress } from "xrpl";
import { setWallets, signInWithEmail, signInWithGoogle, signOut, type Account, type LinkedWallet } from "../account";
import { enabledProviders } from "../supabase";

interface Props {
  account: Account;
  /** Address of the Ledger connected on the Sign step, if any */
  deviceAccount: string;
  /** Open a wallet's on-ledger history */
  onViewHistory: (address: string) => void;
}

/** Sign in (email magic link or Google); once signed in, manage linked XRPL wallets. */
export function AccountScreen({ account, deviceAccount, onViewHistory }: Props) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Only offer Google once it's switched on in Supabase; otherwise the redirect lands on a raw error page.
  const [google, setGoogle] = useState(false);
  useEffect(() => {
    if (account.enabled) enabledProviders().then((p) => setGoogle(!!p.google)).catch(() => {});
  }, [account.enabled]);

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  const link = (addr: string, source: LinkedWallet["source"]) =>
    run(async () => {
      if (!isValidClassicAddress(addr)) throw new Error("That isn't a valid XRPL address (r…).");
      if (account.wallets.some((w) => w.address === addr)) throw new Error("That wallet is already linked.");
      await setWallets([...account.wallets, { address: addr, source, addedAt: Date.now() }]);
      setAddress("");
    });

  if (!account.enabled) {
    return (
      <section>
        <div className="screen-head">
          <h2>Account</h2>
          <p>Accounts aren't configured on this deployment, so your activity stays in this browser.</p>
        </div>
      </section>
    );
  }

  if (!account.session) {
    return (
      <section className="auth">
        <div className="screen-head">
          <h2>Sign in</h2>
          <p>Save your checks to your account and see them on any device. Link your XRPL wallets to follow their history.</p>
        </div>
        <div className="auth-box">
          {google && (
            <>
              <button className="accent" onClick={() => run(signInWithGoogle)} disabled={busy}>
                Continue with Google
              </button>
              <div className="or">or</div>
            </>
          )}
          {sent ? (
            <p className="note">
              Check <strong>{email}</strong> for a sign-in link. Open it in this browser.
            </p>
          ) : (
            <form
              className="controls"
              onSubmit={(e) => {
                e.preventDefault();
                run(async () => {
                  await signInWithEmail(email.trim());
                  setSent(true);
                });
              }}
            >
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" aria-label="Email" />
              <button type="submit" className={google ? undefined : "accent"} disabled={busy || !email.trim()}>
                Email me a link
              </button>
            </form>
          )}
          {error && <p className="error-inline">{error}</p>}
          <p className="note">No password. We store your email, the transactions you check, and the wallets you link.</p>
        </div>
      </section>
    );
  }

  return (
    <section>
      <div className="screen-head">
        <h2>Account</h2>
        <p>
          Signed in as <strong>{account.email}</strong>. Your activity is saved to this account.
        </p>
      </div>

      <h3 className="group-h">My wallets</h3>
      {account.wallets.length ? (
        <div className="list">
          {account.wallets.map((w) => (
            <div key={w.address} className="list-row static">
              <span className={`tag ${w.source === "ledger" ? "clean" : "warn"}`}>{w.source === "ledger" ? "ledger" : "manual"}</span>
              <span className="list-main">
                <span className="list-sub mono">{w.address}</span>
                <span className="list-sub">{w.source === "ledger" ? "Linked from a connected Ledger" : "Added by hand: ownership not proven"}</span>
              </span>
              <span className="row-actions">
                <button className="link" onClick={() => onViewHistory(w.address)}>
                  History
                </button>
                <button className="link" onClick={() => run(() => setWallets(account.wallets.filter((x) => x.address !== w.address)))}>
                  Remove
                </button>
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="empty">No wallets linked yet.</p>
      )}

      <div className="controls block">
        {deviceAccount && !account.wallets.some((w) => w.address === deviceAccount) && (
          <button className="accent" onClick={() => link(deviceAccount, "ledger")} disabled={busy}>
            Link connected Ledger
          </button>
        )}
        <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="r… address" aria-label="XRPL address" spellCheck={false} />
        <button onClick={() => link(address.trim(), "manual")} disabled={busy || !address.trim()}>
          Add address
        </button>
      </div>
      {!deviceAccount && <p className="note">Connect a Ledger on the Sign step to link it with proof of ownership.</p>}
      {error && <p className="error-inline">{error}</p>}

      <div className="step-footer">
        <span />
        <button onClick={() => run(signOut)} disabled={busy}>
          Sign out
        </button>
      </div>
      <p className="note">Signing out clears this browser's copy of your activity. It stays saved in your account.</p>
    </section>
  );
}

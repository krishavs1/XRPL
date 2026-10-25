import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, redirectTo } from "./supabase";

/** An XRPL address linked to the account. */
export interface LinkedWallet {
  address: string;
  label?: string;
  /** "ledger": read off a connected device in this app; "manual": typed in, not proven */
  source: "ledger" | "manual";
  addedAt: number;
}

export interface Account {
  enabled: boolean;
  session: Session | null;
  email: string;
  wallets: LinkedWallet[];
}

/** The signed-in session (if accounts are configured), kept in sync with Supabase. */
export function useAccount(): Account {
  const [session, setSession] = useState<Session | null>(null);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => data.subscription.unsubscribe();
  }, []);
  const meta = (session?.user.user_metadata ?? {}) as { wallets?: LinkedWallet[] };
  return {
    enabled: !!supabase,
    session,
    email: session?.user.email ?? "",
    wallets: Array.isArray(meta.wallets) ? meta.wallets : [],
  };
}

export async function signInWithEmail(email: string) {
  const { error } = await supabase!.auth.signInWithOtp({ email, options: { emailRedirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signInWithGoogle() {
  const { error } = await supabase!.auth.signInWithOAuth({ provider: "google", options: { redirectTo: redirectTo() } });
  if (error) throw error;
}

export async function signOut() {
  await supabase!.auth.signOut();
}

/** Linked wallets live in the user's own metadata: only that user can change them. */
export async function setWallets(wallets: LinkedWallet[]) {
  const { error } = await supabase!.auth.updateUser({ data: { wallets } });
  if (error) throw error;
}

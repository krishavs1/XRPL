import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Accounts are optional: with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY unset
 * (apps/demo/.env.local, or the hosting provider's env settings) the app runs
 * exactly as before, browser-only, and sign-in is hidden.
 *
 * The anon key is public by design; row-level security in supabase/schema.sql
 * is what keeps each user's rows private.
 */
const env = (import.meta as any).env ?? {};
const url = env.VITE_SUPABASE_URL as string | undefined;
const anonKey = env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabase: SupabaseClient | null =
  url && anonKey
    ? createClient(url, anonKey, {
        // PKCE returns ?code=… instead of #access_token=…, which would collide with our hash routes.
        auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true },
      })
    : null;

/** Where auth emails and OAuth send the user back: this page, without a hash route. */
export const redirectTo = () => window.location.origin + window.location.pathname;

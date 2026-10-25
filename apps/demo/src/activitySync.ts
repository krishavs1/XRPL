import { supabase } from "./supabase";
import type { ActivityEntry } from "./activity";

/**
 * Account copy of "My activity": one row per entry in the `activity` table
 * (supabase/schema.sql). Row-level security limits every query to the signed-in user.
 */
export async function fetchRemoteActivity(): Promise<ActivityEntry[]> {
  const { data, error } = await supabase!.from("activity").select("data").order("updated_at", { ascending: false }).limit(50);
  if (error) throw error;
  return (data ?? []).map((r) => r.data as ActivityEntry);
}

export async function pushActivity(userId: string, entries: ActivityEntry[]) {
  if (!entries.length) return;
  const rows = entries.map((e) => ({ user_id: userId, entry_id: e.id, data: e, updated_at: new Date().toISOString() }));
  const { error } = await supabase!.from("activity").upsert(rows, { onConflict: "user_id,entry_id" });
  if (error) throw error;
}

export async function clearRemoteActivity(userId: string) {
  const { error } = await supabase!.from("activity").delete().eq("user_id", userId);
  if (error) throw error;
}

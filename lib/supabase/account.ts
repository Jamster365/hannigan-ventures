import "server-only";
import { createSupabaseServerClient } from "./server";

export async function updateDisplayName(userId: string, name: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("profiles").update({ display_name: name }).eq("user_id", userId);
  if (error) return { ok: false, error: "Could not save your name." };
  return { ok: true };
}

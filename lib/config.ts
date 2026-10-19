/** Server-side configuration helpers. Never import secrets into client code. */

export function isSupabaseConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

export function dataMode(): "demo" | "supabase" {
  if (process.env.DEAL_ROOM_DATA_MODE === "demo") return "demo";
  return isSupabaseConfigured() ? "supabase" : "demo";
}

export function isResearchConfigured(): boolean {
  return Boolean(process.env.OPENAI_API_KEY) && dataMode() === "supabase";
}

export const APP_NAME = "The Deal Room";
export const APP_TAGLINE = "Family investment intelligence";

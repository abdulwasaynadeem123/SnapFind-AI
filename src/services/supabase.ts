import { createClient, SupabaseClient } from "@supabase/supabase-js";

const rawUrl = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) || (typeof process !== "undefined" && process.env?.VITE_SUPABASE_URL);
const rawKey = (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) || (typeof process !== "undefined" && process.env?.VITE_SUPABASE_ANON_KEY);

function isValidUrl(urlStr: string | undefined): boolean {
  if (!urlStr || typeof urlStr !== "string") return false;
  try {
    const parsed = new URL(urlStr);
    return (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      !parsed.hostname.includes("placeholder") &&
      !parsed.hostname.includes("your-project");
  } catch {
    return false;
  }
}

const hasValidUrl = Boolean(rawUrl && isValidUrl(rawUrl));
const hasValidKey = Boolean(
  rawKey &&
  typeof rawKey === "string" &&
  rawKey.trim().length > 20 &&
  !rawKey.includes("placeholder") &&
  !rawKey.includes("your-anon-key") &&
  !rawKey.includes("supabase_anon_key")
);

// Never silently connect to a hardcoded third-party project.
// The loopback URL is inert and is used only so imports remain safe when
// Supabase environment variables have not been configured.
export const isSupabaseConfigured = hasValidUrl && hasValidKey;
export const supabaseUrl = isSupabaseConfigured ? rawUrl! : "http://127.0.0.1:54321";
export const supabaseAnonKey = isSupabaseConfigured ? rawKey! : "missing-supabase-configuration";

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

/**
 * Retrieve the active Supabase session as an Authorization header.
 */
export async function getAuthBearerHeader(): Promise<Record<string, string>> {
  if (!isSupabaseConfigured) return {};
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return { Authorization: `Bearer ${data.session.access_token}` };
    }
  } catch (err) {
    console.warn("[Auth] Failed to retrieve session for bearer header:", err);
  }
  return {};
}

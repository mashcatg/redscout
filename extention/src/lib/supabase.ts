import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "./config";

// chrome.storage.local-backed storage adapter (works in service worker + popup).
const chromeStorage = {
  getItem: async (key: string): Promise<string | null> => {
    const r = await chrome.storage.local.get(key);
    return (r[key] as string) ?? null;
  },
  setItem: async (key: string, value: string): Promise<void> => {
    await chrome.storage.local.set({ [key]: value });
  },
  removeItem: async (key: string): Promise<void> => {
    await chrome.storage.local.remove(key);
  },
};

let _client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_client) return _client;
  _client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      // MV3 service workers are frequently suspended; avoid background refresh loops
      // that trigger _recoverAndRefresh / context invalidation noise.
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: chromeStorage as any,
      storageKey: "redreach.auth",
    },
  });
  return _client;
}

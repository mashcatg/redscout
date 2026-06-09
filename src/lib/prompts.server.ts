// Server-only helper to read prompts (overrides) with code-default fallback.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { PROMPT_REGISTRY, interpolate, type PromptDef } from "./prompt-registry";

const cache = new Map<string, { content: string; at: number }>();
const TTL = 30_000;

export async function getPrompt(key: string): Promise<string> {
  const def = PROMPT_REGISTRY.find((p) => p.key === key);
  const fallback = def?.defaultContent ?? "";
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.content;
  try {
    const { data } = await supabaseAdmin
      .from("admin_prompts")
      .select("content")
      .eq("key", key)
      .maybeSingle();
    const content = data?.content?.trim() ? data.content : fallback;
    cache.set(key, { content, at: Date.now() });
    return content;
  } catch {
    return fallback;
  }
}

export function fillPrompt(template: string, vars: Record<string, string | number | null | undefined>) {
  return interpolate(template, vars);
}

export function listRegistry(): PromptDef[] {
  return PROMPT_REGISTRY;
}

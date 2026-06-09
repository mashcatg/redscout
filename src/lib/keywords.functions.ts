import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listKeywords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("keywords")
      .select("id, keyword, created_at, last_serp_scan_at, last_reddit_scan_at, next_serp_scan_at, next_reddit_scan_at, is_paused")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // plan limits
    const { data: me } = await supabase.from("users").select("plan").single();
    const plan = me?.plan ?? "starter";
    const { data: limits } = await supabase.rpc("plan_limits", { _plan: plan });
    const max = (limits as Array<{ max_keywords: number }> | null)?.[0]?.max_keywords ?? 10;
    return { keywords: rows ?? [], max, plan };
  });

export const addKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ orgId: z.string().uuid(), keyword: z.string().min(1).max(120) }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const keyword = data.keyword.trim();
    if (!keyword) throw new Error("Keyword required");

    // plan limit check
    const { data: me } = await supabase.from("users").select("plan").single();
    const plan = me?.plan ?? "starter";
    const { data: limits } = await supabase.rpc("plan_limits", { _plan: plan });
    const max = (limits as Array<{ max_keywords: number }> | null)?.[0]?.max_keywords ?? 10;
    const { count } = await supabase
      .from("keywords").select("id", { count: "exact", head: true }).eq("org_id", data.orgId);
    if ((count ?? 0) >= max) throw new Error(`Plan ${plan} allows ${max} keywords`);

    // Find next scheduled run for existing keyword jobs in this org so the
    // new keyword joins the next regular cycle (no immediate extra scan).
    const { data: nextJob } = await supabase
      .from("scan_jobs")
      .select("next_run_at")
      .eq("org_id", data.orgId)
      .in("job_type", ["keyword_reddit", "keyword_serp"])
      .order("next_run_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    // Default cadence: align to 24h reddit / 10d serp from now if no existing jobs
    const fallbackReddit = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const fallbackSerp = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();
    const nextRun = nextJob?.next_run_at ?? null;

    const { data: ins, error: insErr } = await supabase
      .from("keywords")
      .insert({ org_id: data.orgId, keyword })
      .select("id")
      .single();
    if (insErr) throw new Error(insErr.message);

    await supabase.from("scan_jobs").insert([
      {
        org_id: data.orgId,
        job_type: "keyword_reddit",
        entity_id: ins.id,
        next_run_at: nextRun ?? fallbackReddit,
      },
    ]);
    void fallbackSerp;

    return { id: ins.id };
  });

export const removeKeyword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ orgId: z.string().uuid(), keywordId: z.string().uuid() }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    // Remove future scans only; keep historical inbox_items
    await supabase
      .from("scan_jobs")
      .delete()
      .eq("org_id", data.orgId)
      .eq("entity_id", data.keywordId)
      .in("job_type", ["keyword_reddit", "keyword_serp"]);
    const { error } = await supabase
      .from("keywords")
      .delete()
      .eq("id", data.keywordId)
      .eq("org_id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

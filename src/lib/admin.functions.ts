import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PROMPT_REGISTRY } from "./prompt-registry";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error || !data) throw new Error("Forbidden");
}

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const [users, orgs, keywords, competitors, inbox, jobs] = await Promise.all([
      supabase.from("users").select("id", { count: "exact", head: true }),
      supabase.from("organizations").select("id", { count: "exact", head: true }),
      supabase.from("keywords").select("id", { count: "exact", head: true }),
      supabase.from("competitors").select("id", { count: "exact", head: true }),
      supabase.from("inbox_items").select("id", { count: "exact", head: true }),
      supabase.from("scan_jobs").select("status"),
    ]);
    const jobBuckets: Record<string, number> = {};
    for (const j of (jobs.data ?? []) as Array<{ status: string }>) {
      jobBuckets[j.status] = (jobBuckets[j.status] ?? 0) + 1;
    }
    const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const { data: recent } = await supabase
      .from("inbox_items").select("created_at").gte("created_at", since);
    const byDay: Record<string, number> = {};
    for (const r of (recent ?? []) as Array<{ created_at: string }>) {
      const d = r.created_at.slice(0, 10);
      byDay[d] = (byDay[d] ?? 0) + 1;
    }
    const series = Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b))
      .map(([date, count]) => ({ date, count }));
    return {
      users: users.count ?? 0,
      orgs: orgs.count ?? 0,
      keywords: keywords.count ?? 0,
      competitors: competitors.count ?? 0,
      inbox: inbox.count ?? 0,
      jobs: jobBuckets,
      series,
    };
  });

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const { data: users } = await supabase
      .from("users").select("id, email, name, plan, created_at").order("created_at", { ascending: false });
    const { data: members } = await supabase.from("org_members").select("user_id, org_id");
    const { data: roles } = await supabase.from("user_roles").select("user_id, role");
    const orgCounts = new Map<string, number>();
    for (const m of (members ?? []) as Array<{ user_id: string }>) {
      orgCounts.set(m.user_id, (orgCounts.get(m.user_id) ?? 0) + 1);
    }
    const rolesByUser = new Map<string, string[]>();
    for (const r of (roles ?? []) as Array<{ user_id: string; role: string }>) {
      const arr = rolesByUser.get(r.user_id) ?? [];
      arr.push(r.role);
      rolesByUser.set(r.user_id, arr);
    }
    return (users ?? []).map((u: { id: string; email: string; name: string | null; plan: string; created_at: string }) => ({
      ...u,
      org_count: orgCounts.get(u.id) ?? 0,
      roles: rolesByUser.get(u.id) ?? [],
    }));
  });

export const listAllOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);
    const { data: orgs, error } = await supabase
      .from("organizations")
      .select("id, name, owner_id, created_at")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return orgs ?? [];
  });

export const listApiCallLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({
      userId: z.string().uuid().optional(),
      orgId: z.string().uuid().optional(),
      apiPlatform: z.enum(["brightdata", "sociavault", "deepseek", "claude", "firecrawl", "other"]).optional(),
      feature: z.string().min(1).max(80).optional(),
      operation: z.string().min(1).max(120).optional(),
      model: z.string().min(1).max(120).optional(),
      status: z.enum(["ok", "error"]).optional(),
      q: z.string().max(120).optional(),
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
      limit: z.number().int().min(1).max(500).optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    await assertAdmin(supabase, context.userId);

    let q = (supabase as any)
      .from("api_call_logs")
      .select("id, created_at, user_id, org_id, api_platform, feature, operation, endpoint, model, ok, status_code, latency_ms, input_tokens, output_tokens, total_tokens, cost_usd, error_message, request_meta, response_meta")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 200);

    if (data.userId) q = q.eq("user_id", data.userId);
    if (data.orgId) q = q.eq("org_id", data.orgId);
    if (data.apiPlatform) q = q.eq("api_platform", data.apiPlatform);
    if (data.feature) q = q.ilike("feature", `%${data.feature}%`);
    if (data.operation) q = q.ilike("operation", `%${data.operation}%`);
    if (data.model) q = q.ilike("model", `%${data.model}%`);
    if (data.status) q = q.eq("ok", data.status === "ok");
    if (data.from) q = q.gte("created_at", data.from);
    if (data.to) q = q.lte("created_at", data.to);
    if (data.q) {
      const search = data.q.replace(/[%_]/g, "\\$&");
      q = q.or([
        `operation.ilike.%${search}%`,
        `feature.ilike.%${search}%`,
        `model.ilike.%${search}%`,
        `endpoint.ilike.%${search}%`,
        `error_message.ilike.%${search}%`,
      ].join(","));
    }

    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const listPrompts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    // Use context.supabase (RLS admin policy) so this works without service role
    const { data: rows, error } = await context.supabase
      .from("admin_prompts").select("key, content, updated_at");
    if (error) throw new Error(error.message);
    const byKey = new Map<string, { content: string; updated_at: string }>();
    for (const r of (rows ?? []) as Array<{ key: string; content: string; updated_at: string }>) {
      byKey.set(r.key, { content: r.content, updated_at: r.updated_at });
    }
    return PROMPT_REGISTRY.map((p) => {
      const o = byKey.get(p.key);
      return {
        key: p.key,
        label: p.label,
        description: p.description,
        variables: p.variables,
        defaultContent: p.defaultContent,
        content: o?.content ?? p.defaultContent,
        isOverridden: !!o,
        updated_at: o?.updated_at ?? null,
      };
    });
  });

export const upsertPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      key: z.string().min(1).max(100),
      label: z.string().min(1).max(200),
      content: z.string().min(1).max(20000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase
      .from("admin_prompts")
      .upsert({ ...data, updated_at: new Date().toISOString(), updated_by: context.userId });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resetPrompt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ key: z.string().min(1).max(100) }).parse(i))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("admin_prompts").delete().eq("key", data.key);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const urlish = z.preprocess(
  (v) => {
    if (v == null || v === "") return null;
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  },
  z.string().url().nullable().optional()
);

const CreateOrgInput = z.object({
  name: z.string().min(1).max(120),
  website_url: urlish,
  favicon_url: urlish,
  product_name: z.string().min(1).max(120),
  product_description: z.string().min(1).max(2000),
  competitors: z.array(z.object({
    name: z.string().min(1).max(120),
    website_url: urlish,
    description: z.string().optional().nullable(),
  })).max(20),
  keywords: z.array(z.string().min(1).max(120)).max(100),
});

export const createOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => CreateOrgInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: orgId, error } = await supabase.rpc("create_org_with_seed", {
      _payload: data as never,
    });
    if (error) throw new Error(`Org create failed: ${error.message}`);
    if (!orgId) throw new Error("Org create failed: no id returned");
    console.log(`[createOrganization] org=${orgId}`);
    return { orgId: orgId as string };
  });

export const listOrganizations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("org_members")
      .select("org_id, organizations(id, name, favicon_url, product_name)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    type Row = { org_id: string; organizations: { id: string; name: string; favicon_url: string | null; product_name: string | null } | null };
    return (data as Row[] | null ?? [])
      .map(r => r.organizations)
      .filter((o): o is NonNullable<Row["organizations"]> => o !== null);
  });

export const getOrganization = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orgId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: org, error } = await supabase
      .from("organizations").select("*").eq("id", data.orgId).single();
    if (error) throw new Error(error.message);
    return org;
  });

export const getCurrentUser = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("users").select("id,email,name,avatar_url,plan").eq("id", userId).single();
    if (error) throw new Error(error.message);
    return data;
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      name: z.string().min(1).max(120).optional(),
      avatar_url: urlish,
    }).parse(i)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: { name?: string; avatar_url?: string | null } = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.avatar_url !== undefined) patch.avatar_url = data.avatar_url ?? null;
    const { error } = await supabase.from("users").update(patch).eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getPlanUsage = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data: me } = await supabase
      .from("users")
      .select("plan, access_until, subscription_status, pass_type, delete_at")
      .eq("id", userId)
      .single();
    const plan = (me?.plan ?? "starter") as string;
    const meAny = (me ?? {}) as {
      access_until?: string | null;
      subscription_status?: string | null;
      pass_type?: string | null;
      delete_at?: string | null;
    };
    const accessUntil = meAny.access_until ?? null;
    const subscriptionStatus = meAny.subscription_status ?? "inactive";
    const passType = meAny.pass_type ?? null;
    const deleteAt = meAny.delete_at ?? null;
    const now = Date.now();
    const accessUntilMs = accessUntil ? new Date(accessUntil).getTime() : 0;
    // Active while we're still within the paid window — even after cancellation.
    const isActive = accessUntilMs > now
      || (!accessUntil && subscriptionStatus === "active");
    // In grace = paid window over, but data not yet purged.
    const inGrace = !isActive && !!deleteAt && new Date(deleteAt).getTime() > now;

    const { data: limits } = await supabase.rpc("plan_limits", { _plan: plan });
    const lim = (limits as Array<{ max_keywords: number; max_competitors: number; max_orgs: number }> | null)?.[0]
      ?? { max_keywords: 10, max_competitors: 3, max_orgs: 1 };

    const { data: memberships } = await supabase
      .from("org_members").select("org_id").eq("user_id", userId);
    const orgIds = (memberships ?? []).map((m: { org_id: string }) => m.org_id);

    let keywordsUsed = 0;
    let competitorsUsed = 0;
    if (orgIds.length) {
      const { count: kCount } = await supabase
        .from("keywords").select("id", { count: "exact", head: true }).in("org_id", orgIds);
      const { count: cCount } = await supabase
        .from("competitors").select("id", { count: "exact", head: true }).in("org_id", orgIds);
      keywordsUsed = kCount ?? 0;
      competitorsUsed = cCount ?? 0;
    }

    const order = ["starter", "growth", "agency"];
    const idx = order.indexOf(plan);
    const nextPlan = idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null;

    return {
      plan,
      nextPlan,
      accessUntil,
      deleteAt,
      subscriptionStatus,
      passType,
      isActive,
      inGrace,
      orgs: { used: orgIds.length, max: lim.max_orgs },
      keywords: { used: keywordsUsed, max: lim.max_keywords },
      competitors: { used: competitorsUsed, max: lim.max_competitors },
    };
  });



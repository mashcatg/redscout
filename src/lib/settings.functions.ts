import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const urlish = z.preprocess(
  (v) => {
    if (v == null || v === "") return null;
    if (typeof v !== "string") return v;
    const t = v.trim();
    if (!t) return null;
    return /^https?:\/\//i.test(t) ? t : `https://${t}`;
  },
  z.string().url().nullable().optional(),
);

export const updateOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      name: z.string().min(1).max(120).optional(),
      website_url: urlish,
      favicon_url: urlish,
      product_name: z.string().min(1).max(120).optional(),
      product_description: z.string().max(4000).optional().nullable(),
      training_notes: z.string().max(8000).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { orgId, ...rest } = data;
    const patch: {
      name?: string;
      website_url?: string | null;
      favicon_url?: string | null;
      product_name?: string;
      product_description?: string | null;
      training_notes?: string | null;
    } = {};
    if (rest.name !== undefined) patch.name = rest.name;
    if (rest.website_url !== undefined) patch.website_url = rest.website_url ?? null;
    if (rest.favicon_url !== undefined) patch.favicon_url = rest.favicon_url ?? null;
    if (rest.product_name !== undefined) patch.product_name = rest.product_name;
    if (rest.product_description !== undefined) patch.product_description = rest.product_description ?? null;
    if (rest.training_notes !== undefined) patch.training_notes = rest.training_notes ?? null;
    const { error } = await supabase.from("organizations").update(patch).eq("id", orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteOrganization = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ orgId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: org, error: oErr } = await supabase
      .from("organizations").select("owner_id").eq("id", data.orgId).single();
    if (oErr || !org) throw new Error("Org not found");
    if (org.owner_id !== userId) throw new Error("Only the owner can delete this org");
    // Cascade manually for tables without FK cascades
    await supabaseAdmin.from("inbox_items").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("scan_jobs").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("keywords").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("competitors").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("comment_personalities").delete().eq("org_id", data.orgId);
    await supabaseAdmin.from("org_members").delete().eq("org_id", data.orgId);
    const { error } = await supabaseAdmin.from("organizations").delete().eq("id", data.orgId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    // Find owned orgs and cascade-delete each
    const { data: owned } = await supabaseAdmin
      .from("organizations").select("id").eq("owner_id", userId);
    for (const o of owned ?? []) {
      await supabaseAdmin.from("inbox_items").delete().eq("org_id", o.id);
      await supabaseAdmin.from("scan_jobs").delete().eq("org_id", o.id);
      await supabaseAdmin.from("keywords").delete().eq("org_id", o.id);
      await supabaseAdmin.from("competitors").delete().eq("org_id", o.id);
      await supabaseAdmin.from("comment_personalities").delete().eq("org_id", o.id);
      await supabaseAdmin.from("org_members").delete().eq("org_id", o.id);
      await supabaseAdmin.from("organizations").delete().eq("id", o.id);
    }
    await supabaseAdmin.from("org_members").delete().eq("user_id", userId);
    await supabaseAdmin.from("user_roles").delete().eq("user_id", userId);
    await supabaseAdmin.from("users").delete().eq("id", userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listPersonalities = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) => z.object({ orgId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("comment_personalities")
      .select("id, slug, label, description, instructions, created_at")
      .eq("org_id", data.orgId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const upsertPersonality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      orgId: z.string().uuid(),
      id: z.string().uuid().optional(),
      slug: z.string().min(1).max(40).regex(/^[a-z0-9_-]+$/, "lowercase letters, numbers, - or _"),
      label: z.string().min(1).max(60),
      description: z.string().max(200).optional().nullable(),
      instructions: z.string().min(5).max(2000),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const payload = {
      org_id: data.orgId,
      slug: data.slug,
      label: data.label,
      description: data.description ?? null,
      instructions: data.instructions,
    };
    if (data.id) {
      const { error } = await supabase.from("comment_personalities").update(payload).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("comment_personalities").insert(payload);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const deletePersonality = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({ id: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("comment_personalities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

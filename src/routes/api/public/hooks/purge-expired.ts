import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Cron-callable endpoint. Authenticated via Supabase anon key in the
// `apikey` header — matches the project's other public hooks.
//
// Schedule example (pg_cron, hourly):
//   select cron.schedule('purge-expired-workspaces', '0 * * * *', $$
//     select net.http_post(
//       url := 'https://reddit-spark-search.lovable.app/api/public/hooks/purge-expired',
//       headers := jsonb_build_object('Content-Type','application/json','apikey','<ANON_KEY>'),
//       body := '{}'::jsonb
//     );
//   $$);

export const Route = createFileRoute("/api/public/hooks/purge-expired")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const db = supabaseAdmin as any;

          // Find users whose grace window has elapsed.
          const { data: expiredUsers, error } = await db
            .from("users")
            .select("id")
            .lte("delete_at", new Date().toISOString())
            .not("delete_at", "is", null);
          if (error) throw error;

          const userIds: string[] = (expiredUsers ?? []).map((u: { id: string }) => u.id);
          if (!userIds.length) {
            return Response.json({ ok: true, purged: 0 });
          }

          // Find all orgs owned by / shared with these users.
          const { data: orgRows } = await db
            .from("organizations")
            .select("id")
            .in("owner_id", userIds);
          const orgIds: string[] = (orgRows ?? []).map((o: { id: string }) => o.id);

          // Tables that scope by org_id — wipe first.
          const orgScoped = [
            "inbox_items",
            "keywords",
            "competitors",
            "scan_jobs",
            "dm_message_logs",
            "dm_leads",
            "dm_campaigns",
            "warmup_engagements",
            "user_warmup_selections",
            "comment_personalities",
            "seo_hidden_keywords",
            "seo_keyword_schedule",
            "org_members",
          ];
          if (orgIds.length) {
            for (const t of orgScoped) {
              await db.from(t).delete().in("org_id", orgIds);
            }
            await db.from("organizations").delete().in("id", orgIds);
          }

          // Reset the user's plan state — keep the account itself.
          await db
            .from("users")
            .update({
              access_until: null,
              delete_at: null,
              pass_type: null,
              subscription_status: "inactive",
              plan: "starter",
            })
            .in("id", userIds);

          return Response.json({ ok: true, purged: userIds.length, orgs: orgIds.length });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), {
            status: 500,
            headers: { "content-type": "application/json" },
          });
        }
      },
    },
  },
});

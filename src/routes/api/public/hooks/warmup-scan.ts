import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { runDailyWarmupScans } from "@/lib/warmup.functions";

export const Route = createFileRoute("/api/public/hooks/warmup-scan")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const results = await runDailyWarmupScans();
          return Response.json({ ok: true, results });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500 });
        }
      },
    },
  },
});

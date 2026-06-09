import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { runSeoRotateAll } from "@/lib/seo.functions";

export const Route = createFileRoute("/api/public/hooks/seo-rotate")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const results = await runSeoRotateAll();
          return Response.json({ ok: true, results });
        } catch (e) {
          return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), { status: 500 });
        }
      },
    },
  },
});

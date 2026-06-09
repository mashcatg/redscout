import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";
import { featurePages, featureOrder } from "@/lib/feature-pages";

const BASE_URL = "https://redscout.tech";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const staticPaths = [
          { path: "/", changefreq: "weekly", priority: "1.0" },
          { path: "/pricing", changefreq: "weekly", priority: "0.9" },
          { path: "/features", changefreq: "weekly", priority: "0.9" },
          { path: "/reviews", changefreq: "monthly", priority: "0.7" },
          { path: "/login", changefreq: "yearly", priority: "0.3" },
          { path: "/signup", changefreq: "yearly", priority: "0.5" },
        ];
        const featurePaths = featureOrder.map((k) => ({
          path: `/features/${featurePages[k].slug}`,
          changefreq: "monthly" as const,
          priority: "0.8",
        }));
        const entries = [...staticPaths, ...featurePaths];

        const urls = entries
          .map(
            (e) =>
              `  <url>\n    <loc>${BASE_URL}${e.path}</loc>\n    <changefreq>${e.changefreq}</changefreq>\n    <priority>${e.priority}</priority>\n  </url>`,
          )
          .join("\n");

        const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>`;

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});

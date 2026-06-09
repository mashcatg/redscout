import { createFileRoute } from "@tanstack/react-router";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { featurePages } from "@/lib/feature-pages";


export const Route = createFileRoute("/reviews")({
  component: Reviews,
  head: () => ({
    meta: [
      { title: "Reviews — redScout" },
      { name: "description", content: "Real quotes from founders and operators using redScout to turn Reddit conversations into customers." },
    ],
  }),
});

function Reviews() {
  const all = Object.values(featurePages).flatMap((p) => (p.reviews ?? []).map((r) => ({ ...r, label: p.reviewLabel })));
  return (
    <div className="min-h-screen bg-background text-foreground">
      <MarketingHeader />

      <main className="mx-auto max-w-6xl px-6 py-20">
        <h1 className="text-4xl font-bold">Customer reviews</h1>
        <p className="mt-3 text-muted-foreground">Real feedback from founders using redScout to generate qualified conversations.</p>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {all.map((r, i) => (
            <blockquote key={i} className="rounded-xl border p-6">
              <div className="text-sm text-primary">{r.label}</div>
              <p className="mt-3 text-lg">“{r.quote}”</p>
              <div className="mt-4 text-sm font-semibold">{r.name} • {r.role}</div>
            </blockquote>
          ))}
        </div>
      </main>
      <MarketingFooter />
    </div>

  );
}

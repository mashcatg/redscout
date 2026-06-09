import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, Sparkles } from "lucide-react";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";
import { featureOrder, featurePages } from "@/lib/feature-pages";


const SITE_URL = "https://redscout.tech";

const GROUPS: { title: string; description: string; keys: typeof featureOrder[number][] }[] = [
  {
    title: "Inbound monitoring",
    description: "Catch every Reddit thread that matches your buyer.",
    keys: ["redditMonitoring", "keywordAnalysis", "aiScoring", "highEngagingPosts", "subredditIntelligence"],
  },
  {
    title: "Competitive intelligence",
    description: "See where competitors are being mentioned — and steal the room.",
    keys: ["competitorAnalysis", "competitorMentions"],
  },
  {
    title: "Outbound + warmup",
    description: "Send relevant DMs safely, without burning accounts.",
    keys: ["dmOutreach", "warmup", "extensionAutomation"],
  },
  {
    title: "Analytics + growth",
    description: "Track what works and compound it daily.",
    keys: ["analytics", "simulationForecasts", "gamification", "streakTracking", "seoLlm"],
  },
];

export const Route = createFileRoute("/features/")({
  component: FeaturesHub,
  head: () => {
    const itemList = {
      "@context": "https://schema.org",
      "@type": "ItemList",
      itemListElement: featureOrder.map((k, i) => ({
        "@type": "ListItem",
        position: i + 1,
        name: `${featurePages[k].title} ${featurePages[k].highlight}`,
        url: `${SITE_URL}/features/${featurePages[k].slug}`,
      })),
    };
    return {
      meta: [
        { title: "redScout Features | Reddit monitoring, SEO, DM outreach, warmup, analytics" },
        { name: "description", content: "Explore redScout's full Reddit growth system: real-time monitoring, AI scoring, competitor mentions, warmup, DM outreach, analytics, gamification, and LLM visibility." },
        { property: "og:title", content: "redScout Features — every feature in one Reddit growth system" },
        { property: "og:description", content: "Monitoring, AI scoring, competitor mentions, warmup, DM outreach, analytics, and SEO/LLM visibility — all in one." },
        { property: "og:url", content: `${SITE_URL}/features` },
        { property: "og:type", content: "website" },
        { property: "og:site_name", content: "redScout" },
      ],
      links: [{ rel: "canonical", href: `${SITE_URL}/features` }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(itemList) }],
    };
  },
});

function FeaturesHub() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,95,45,0.14),_transparent_30%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_42%,#fff8f2_100%)] text-foreground">
      <MarketingHeader />

      <main className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-primary">
            <Sparkles className="h-3.5 w-3.5" /> Every feature, organised
          </span>
          <h1 className="mt-6 text-5xl font-bold tracking-tight md:text-7xl">Every feature. One system.</h1>
          <p className="mx-auto mt-5 max-w-3xl text-lg leading-8 text-muted-foreground">
            Explore redScout's full Reddit growth system across monitoring, SEO, competitor analysis, warmup, DM outreach, analytics, gamification, and LLM visibility.
          </p>
        </div>

        <div className="mt-16 space-y-14">
          {GROUPS.map((group) => (
            <section key={group.title}>
              <div className="flex items-end justify-between gap-6 border-b border-border/60 pb-3">
                <div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">{group.title}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{group.description}</p>
                </div>
                <span className="hidden md:inline text-xs font-bold uppercase tracking-[0.22em] text-muted-foreground">{group.keys.length} pages</span>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {group.keys.map((key) => {
                  const page = featurePages[key];
                  return (
                    <Link key={page.slug} to={`/features/${page.slug}`} className="group rounded-[1.75rem] border border-border/70 bg-white/80 p-6 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-primary/40">
                      <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{page.eyebrow}</p>
                      <h3 className="mt-3 text-xl font-bold tracking-tight">{page.title} <span className="text-primary">{page.highlight}</span></h3>
                      <p className="mt-3 text-sm leading-7 text-muted-foreground line-clamp-3">{page.description}</p>
                      <div className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-foreground transition group-hover:text-primary">
                        Explore <ArrowRight className="h-4 w-4" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-20 rounded-[2rem] border border-border/70 bg-foreground text-background p-10 md:p-14 text-center">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">Ready to put Reddit on autopilot?</h2>
          <p className="mt-4 text-sm md:text-base text-background/70 max-w-2xl mx-auto">Start free, or grab the 3-Day Pass for $5 and try every inbound feature instantly.</p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-background text-foreground px-5 py-3 text-sm font-bold uppercase tracking-wider hover:opacity-90">Start free <ArrowRight className="h-4 w-4" /></Link>
            <Link to="/pricing" className="inline-flex items-center gap-2 rounded-full border border-background/40 px-5 py-3 text-sm font-bold uppercase tracking-wider hover:bg-background/10">See pricing</Link>
          </div>
        </div>
      </main>
      <MarketingFooter />
    </div>
  );
}


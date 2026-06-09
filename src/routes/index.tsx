import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, ArrowUpRight, Check, Inbox, Search, Sparkles, Target, Zap, Quote, Bot, TrendingUp, Globe, Star, ChevronLeft, ChevronRight } from "lucide-react";
import BrandIcon from "@/components/BrandIcon";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import { HeroVideoDialog } from "@/registry/magicui/hero-video-dialog";
import { AnimatedBeam } from "@/registry/magicui/animated-beam";
import { forwardRef, useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { cn } from "@/lib/utils";
import { BILLING_PLANS, type BillingPlan, THREE_DAY_PASS, getDiscountedPriceLabel, getProjectLimitLabel, getYearlyPriceLabel } from "@/lib/billing.config";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "redScout — Turn Reddit conversations into paying customers" },
      { name: "description", content: "Find people already asking about products like yours on Reddit and Google. RedScout brings the right conversations to one inbox so you can reply, build trust, and grow — without ads." },
    ],
  }),
});

function Landing() {
  return (
    <div className="relative min-h-screen overflow-x-clip text-foreground bg-[radial-gradient(circle_at_top,_rgba(255,95,45,0.16),_transparent_28%),radial-gradient(circle_at_80%_20%,_rgba(15,23,42,0.05),_transparent_26%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_48%,#fff8f2_100%)]">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-32 left-1/2 h-[38rem] w-[38rem] -translate-x-1/2 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute top-[18rem] -left-24 h-72 w-72 rounded-full bg-foreground/5 blur-3xl" />
        <div className="absolute bottom-0 right-[-6rem] h-[26rem] w-[26rem] rounded-full bg-primary/10 blur-3xl" />
      </div>
      <MarketingHeader />

      <main>
        <Hero />
        <DashboardMock />
        <LogoStrip />
        <BentoTools />
        <RankOnGoogle />
        <ResultsCarousel />
        <AboutStats />
        <AutomationPhilosophy />
        <FinanceSplit />
        <ScopeSplit />
        <InterestSection />
        <ROISection />
        <Testimonials />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}



/* ---------------- Reveal helper (CSS-only) ---------------- */

function Reveal({ children, delay = 0, className = "" }: { children: ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) { setSeen(true); io.disconnect(); }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={`${className} transition-all duration-700 ease-out ${seen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}

const Circle = forwardRef<HTMLDivElement, { className?: string; children?: ReactNode }>(
  ({ className, children }, ref) => (
    <div
      ref={ref}
      className={cn(
        "z-10 flex size-12 items-center justify-center rounded-full border-2 bg-white p-3 shadow-[0_0_20px_-12px_rgba(0,0,0,0.8)]",
        className,
      )}
    >
      {children}
    </div>
  ),
);
Circle.displayName = "Circle";

const logos = [
  { name: "chatgpt", src: "/chatgpt.png" },
  { name: "google", src: "/google.png" },
  { name: "gemini", src: "/gemini.png" },
  { name: "claude", src: "/claude.png" },
  { name: "perplexity", src: "/perplexity.png" },
];

function AnimatedBeamMultipleOutputDemo({ className }: { className?: string }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const redditRef = useRef<HTMLDivElement>(null);
  const redscoutRef = useRef<HTMLDivElement>(null);
  const outputRefs = [
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
    useRef<HTMLDivElement>(null),
  ];

  return (
    <div
      ref={containerRef}
      className={cn(
        "relative flex h-96 w-full items-center justify-center overflow-hidden rounded-2xl bg-slate-950/95 p-8 shadow-[0_40px_100px_-60px_rgba(255,108,46,0.45)]",
        className,
      )}
    >
      <div className="flex h-full w-full max-w-3xl items-stretch justify-between gap-6">
        <div className="flex flex-col justify-center">
          <Circle ref={redscoutRef} className="size-10">
            <img src="/redscout_logo_icon.png" alt="redScout" className="h-8 w-8 rounded-full object-contain" />
          </Circle>
        </div>

        <div className="flex flex-col justify-center">
          <Circle ref={redditRef} className="size-12 bg-white">
            <img src="/reddit.png" alt="reddit" className="h-10 w-10 rounded-full object-contain" />
          </Circle>
        </div>

        <div className="flex flex-col justify-center gap-1">
          {logos.map((logo, index) => (
            <Circle key={logo.name} ref={outputRefs[index]} className="size-10">
              <img src={logo.src} alt={logo.name} className="h-8 w-8 rounded-full object-contain" />
            </Circle>
          ))}
        </div>
      </div>

      {/* Beam from redscout to reddit */}
      <AnimatedBeam 
        containerRef={containerRef} 
        fromRef={redscoutRef} 
        toRef={redditRef} 
        index={0}
        pathWidth={1}
        timings={[1.2, 0.8, 0.8, 0.8, 0.8, 0.8]}
      />
      
      {/* Beams from reddit to output icons */}
      <AnimatedBeam 
        containerRef={containerRef} 
        fromRef={redditRef} 
        toRef={outputRefs[0]} 
        index={1}
        pathWidth={1}
        timings={[1.2, 0.8, 0.8, 0.8, 0.8, 0.8]}
      />
      <AnimatedBeam 
        containerRef={containerRef} 
        fromRef={redditRef} 
        toRef={outputRefs[1]} 
        index={2}
        pathWidth={1}
        timings={[1.2, 0.8, 0.8, 0.8, 0.8, 0.8]}
      />
      <AnimatedBeam 
        containerRef={containerRef} 
        fromRef={redditRef} 
        toRef={outputRefs[2]} 
        index={3}
        pathWidth={1}
        timings={[1.2, 0.8, 0.8, 0.8, 0.8, 0.8]}
      />
      <AnimatedBeam 
        containerRef={containerRef} 
        fromRef={redditRef} 
        toRef={outputRefs[3]} 
        index={4}
        pathWidth={1}
        timings={[1.2, 0.8, 0.8, 0.8, 0.8, 0.8]}
      />
      <AnimatedBeam 
        containerRef={containerRef} 
        fromRef={redditRef} 
        toRef={outputRefs[4]} 
        index={5}
        pathWidth={1}
        timings={[1.2, 0.8, 0.8, 0.8, 0.8, 0.8]}
      />
    </div>
  );
}

/* ---------------- Hero ---------------- */

function Hero() {
  return (
    <section className="relative border-b border-border/70">
      <DashedFrame />
      <div className="mx-auto grid max-w-7xl gap-12 px-6 pb-20 pt-20 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:pb-24 lg:pt-24">
        <div className="relative z-10">
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-primary shadow-sm">
              <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              Where modern buyers ask before they buy
            </span>
          </Reveal>
          <Reveal delay={0}>
            <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight leading-[0.92] text-balance sm:text-6xl lg:text-7xl xl:text-8xl">
                Win the customers <span className="text-primary">already looking</span> for what you sell.
            </h1>
          </Reveal>
          <Reveal delay={200}>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">
              Every day, thousands of people ask Reddit and Google for product recommendations. RedScout finds the ones that match what you offer and puts them in one simple inbox — so you can show up, help, and turn questions into sales.
            </p>
          </Reveal>
          <Reveal delay={300}>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-background transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-foreground/10">
                Grab 3-Day Pass Now <ArrowRight className="h-4 w-4" />
              </Link>
              <a href="#tools" className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-foreground transition hover:border-primary/40 hover:bg-primary/6">
                See how it works
              </a>
            </div>
          </Reveal>
          <Reveal delay={400}>
            <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
              {[
                { v: "60s", l: "to first warm lead" },
                { v: "100%", l: "buyer-intent matches" },
                { v: "One", l: "inbox, zero noise" },
              ].map((stat) => (
                <div key={stat.l} className="rounded-2xl border border-border/80 bg-white/70 px-4 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
                  <p className="text-2xl font-bold tracking-tight text-foreground">{stat.v}</p>
                  <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{stat.l}</p>
                </div>
              ))}
            </div>
          </Reveal>
        </div>
        <Reveal delay={150} className="relative">
          <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl" />
          <img
            src="/redscout_system_ss_1.jpeg"
            alt="redScout dashboard interface"
            className="w-full h-auto rounded-[2rem] border border-border/80 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)]"
          />
        </Reveal>
      </div>
    </section>
  );
}

function InterestSection() {
  const cards = [
    {
      title: "Without RedScout",
      subtitle: "Chasing strangers and burning hours",
      points: [
        "Pour money into ads that reach people who've never heard of you.",
        "Spend hours each day scrolling Reddit hoping to find the right thread.",
        "Send cold pitches to people who never asked for your help.",
        "Miss the conversations where your future customers are deciding right now.",
      ],
      highlighted: false,
    },
    {
      title: "With RedScout",
      subtitle: "Warm conversations, faster wins",
      points: [
        "Wake up to a clean inbox of people already asking about products like yours.",
        "Get set up in minutes — just add your website and you're done.",
        "Reply with helpful, on-brand suggestions in one click.",
        "Show up in the conversations buyers trust, and let that compound.",
      ],
      highlighted: true,
    },
  ];

  return (
    <section className="border-b border-border bg-[radial-gradient(circle_at_top_left,_rgba(255,139,78,0.1),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.05),transparent_40%)]">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <div className="text-center">
          <p className="label-eyebrow text-primary">A smarter way to grow</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">Stop chasing. Start showing up where buyers already are.</h2>
          <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
            RedScout turns the conversations happening right now into a steady, predictable flow of new customers — without ads, cold outreach, or wasted hours.
          </p>
        </div>

        <div className="mt-14 grid gap-6 lg:grid-cols-2">
          {cards.map((card) => (
            <div
              key={card.title}
              className={`overflow-hidden rounded-[2rem] border border-border/70 p-8 shadow-[0_24px_70px_-48px_rgba(15,23,42,0.35)] ${card.highlighted ? "bg-gradient-to-br from-primary/95 via-primary/80 to-primary/75 text-white" : "bg-white/90 text-foreground"}`}
            >
              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <div className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold uppercase tracking-[0.2em] ${card.highlighted ? "bg-white/15 text-white" : "bg-slate-100 text-slate-700"}`}>
                    <span className={`h-2 w-2 rounded-full ${card.highlighted ? "bg-white" : "bg-slate-400"}`} />
                    {card.title}
                  </div>
                  <p className={`text-xl font-semibold ${card.highlighted ? "text-white" : "text-foreground"}`}>{card.subtitle}</p>
                </div>

                <div className="space-y-4 text-sm leading-7">
                  {card.points.map((point) => (
                    <div key={point} className="flex gap-3">
                      <span className={`mt-1.5 flex h-2.5 w-2.5 rounded-full ${card.highlighted ? "bg-white" : "bg-muted-foreground"}`} />
                      <p className={card.highlighted ? "text-white/85" : "text-muted-foreground"}>{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ROISection() {
  return (
    <section className="border-b border-border bg-[radial-gradient(circle_at_top,_rgba(255,139,78,0.1),transparent_30%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.05),transparent_40%)]">
      <div className="mx-auto max-w-7xl px-6 py-28">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_0.95fr] lg:items-center">
          <div>
            <p className="label-eyebrow text-primary">The numbers behind it</p>
            <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight text-foreground">
              One real conversation can pay for redScout for a year
            </h2>
            <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
              This isn't marketing fluff. It's what happens when you stop chasing strangers and start helping people who are already asking about products like yours.
            </p>

            <div className="mt-10 grid gap-4 sm:grid-cols-3">
              {[
                { label: "Warm conversations a week", value: "50+", note: "Real questions from people interested in what you sell." },
                { label: "Turn into customers", value: "5%", note: "Average win rate when you reply with a helpful, honest answer." },
                { label: "Worth per customer", value: "$500+", note: "Typical revenue from a single customer you met on Reddit." },
              ].map((stat) => (
                <div key={stat.label} className="rounded-[2rem] border border-border/70 bg-white/90 p-6 shadow-[0_18px_45px_-28px_rgba(15,23,42,0.2)]">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted-foreground">{stat.label}</p>
                  <p className="mt-4 text-3xl font-bold tracking-tight text-foreground">{stat.value}</p>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{stat.note}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[2rem] border border-border/70 bg-slate-950/95 p-8 shadow-[0_30px_100px_-50px_rgba(15,23,42,0.22)] text-white">
            <div className="rounded-[2rem] bg-gradient-to-br from-slate-900/95 via-slate-950 to-slate-900/80 p-8 ring-1 ring-white/10">
              <p className="text-sm uppercase tracking-[0.24em] text-primary">Simple growth math</p>
              <div className="mt-6 space-y-5">
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">1. Conversations we bring you</p>
                  <p className="mt-3 text-3xl font-bold">50+ a week</p>
                  <p className="mt-2 text-sm text-muted-foreground">Real buyer questions, picked from Reddit and Google.</p>
                </div>
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">2. Replies that turn into sales</p>
                  <p className="mt-3 text-3xl font-bold">5%</p>
                  <p className="mt-2 text-sm text-muted-foreground">A normal close rate when you actually help, not pitch.</p>
                </div>
                <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5">
                  <p className="text-xs uppercase tracking-[0.22em] text-muted-foreground">3. Value of one new customer</p>
                  <p className="mt-3 text-3xl font-bold">$500+</p>
                  <p className="mt-2 text-sm text-muted-foreground">What an average customer spends with you.</p>
                </div>
              </div>

              <div className="mt-8 rounded-[2rem] bg-gradient-to-r from-primary/15 via-white/10 to-primary/15 p-6 ring-1 ring-primary/20">
                <p className="text-xs uppercase tracking-[0.24em] text-primary">New revenue every month</p>
                <p className="mt-4 text-5xl font-bold">$1,250</p>
                <p className="mt-2 text-sm text-muted-foreground">50 conversations × 5% close rate × $500 each</p>
              </div>

      
            </div>

            <p className="mt-8 text-sm leading-6 text-slate-300">
              Built on the real growth math behind community-led sales — volume, conversion, and customer value. One good week pays for itself.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function DashedFrame() {
  return (
    <div className="absolute inset-x-6 top-6 bottom-0 border border-dashed border-border/40 pointer-events-none rounded-[2rem]" />
  );
}

/* ---------------- Dashboard mock ---------------- */

function HeroVideoDialogDemo() {
  return (
    <div className="relative">
      <HeroVideoDialog
        className="block dark:hidden"
        animationStyle="from-center"
        videoSrc="https://www.youtube.com/embed/qh3NGpYRG3I?si=4rb-zSdDkVK9qxxb"
        thumbnailSrc="https://startup-template-sage.vercel.app/hero-light.png"
        thumbnailAlt="Hero Video"
      />
      <HeroVideoDialog
        className="hidden dark:block"
        animationStyle="from-center"
        videoSrc="https://www.youtube.com/embed/qh3NGpYRG3I?si=4rb-zSdDkVK9qxxb"
        thumbnailSrc="https://startup-template-sage.vercel.app/hero-dark.png"
        thumbnailAlt="Hero Video"
      />
    </div>
  );
}

function DashboardMock() {
  return (
    <section className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <Reveal>
          <div className="border border-border bg-card p-4 md:p-6">
            <div className="flex items-center gap-2 pb-4 border-b border-border">
              <span className="h-2.5 w-2.5 bg-primary" />
              <span className="h-2.5 w-2.5 bg-foreground/30" />
              <span className="h-2.5 w-2.5 bg-foreground/30" />
              <div className="ml-4 flex-1">
                <HeroVideoDialogDemo />
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Logo strip ---------------- */

function LogoStrip() {
  return (
    <section className="border-b border-border/70">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <Reveal>
          <div className="rounded-[2rem] border border-border/70 bg-white/75 p-6 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.45)] backdrop-blur">
            <div className="grid gap-6 lg:grid-cols-[.9fr_1.1fr] lg:items-center">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">What our users say</p>
                <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">Loved by founders who want customers, not dashboards.</h2>
                <p className="mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
                  RedScout is for solo founders and small teams who want a steady stream of real conversations — not another tool to manage or a dashboard to stare at.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { n: "2.4k+", l: "founders using redScout" },
                  { n: "60s", l: "to first warm lead" },
                  { n: "5.0", l: "avg satisfaction" },
                ].map((item) => (
                  <div key={item.l} className="rounded-2xl border border-border/70 bg-background/85 p-4">
                    <p className="text-3xl font-bold tracking-tight text-foreground">{item.n}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.l}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-6 opacity-70">
              {["LUMITRIX", "BIOPLEX", "ZENITHIA", "NEXIFLOW", "VORTEXIA", "OPALCORE"].map((b) => (
                <span key={b} className="text-sm font-bold tracking-[0.28em] text-muted-foreground">{b}</span>
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Bento ---------------- */

function BentoTools() {
  const tiles = [
    {
      icon: Search, title: "We find the buyers, you skip the search",
      d: "RedScout listens to Reddit and Google all day, and only surfaces conversations where someone is actually looking for what you sell.",
      href: "/features/ai-scoring",
      span: "md:col-span-7",
    },
    { icon: Inbox, title: "One simple inbox", d: "Every warm lead lands in one place. Mark as replied, dismiss noise, or generate a reply in a click.", href: "/features/reddit-monitoring", span: "md:col-span-5" },
    { icon: Sparkles, title: "Replies that sound human", d: "Get on-brand reply suggestions that match the tone of each community — never spammy, never pushy.", href: "/features/dm-outreach", span: "md:col-span-4" },
    { icon: Zap, title: "Live in minutes", d: "Add your website and a few competitors. You'll see your first real opportunities the same day.", href: "/features/competitor-analysis", span: "md:col-span-4" },
    { icon: Target, title: "Daily wins, real momentum", d: "Small daily goals and streaks keep you replying — and the pipeline keeps compounding.", href: "/features/gamification", span: "md:col-span-4" },
  ];
  return (
    <section id="tools" className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0),rgba(255,250,245,0.9))]">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <Reveal>
          <div className="text-center mb-12">
            <p className="label-eyebrow text-primary">What you get</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Everything you need to grow without spending on ads</h2>
            <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">A simple inbox of warm conversations, helpful reply ideas, and a daily routine that quietly builds your brand where buyers hang out.</p>
          </div>
        </Reveal>
        <div className="grid gap-4 md:grid-cols-12">
          {tiles.map((t, i) => (
            <Reveal key={t.title} delay={i * 80} className={t.span ?? ""}>
              <Link to={t.href} className="group block h-full rounded-[1.75rem] border border-border/70 bg-white/80 p-6 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-primary/40 hover:shadow-[0_24px_70px_-36px_rgba(15,23,42,0.5)]">
                <div className="overflow-hidden rounded-2xl border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,247,241,0.9))] p-4">
                  <img src="/redscout_logo_icon.png" alt="redScout placeholder" className="mx-auto h-20 w-20 object-contain transition duration-300 group-hover:scale-105" />
                </div>
                <span className="mt-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-background transition group-hover:border-primary/30 group-hover:bg-primary group-hover:text-primary-foreground">
                  <t.icon className="h-5 w-5" strokeWidth={2} />
                </span>
                <h3 className="mt-5 text-xl font-bold">{t.title}</h3>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t.d}</p>
                <div className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">
                  Learn more <ArrowUpRight className="h-3.5 w-3.5" />
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- About + stats ---------------- */

function AboutStats() {
  const chips = [
    { l: "Warm leads daily", c: "bg-primary/15 text-primary" },
    { l: "No ads needed", c: "bg-foreground/10" },
    { l: "On-brand replies", c: "bg-primary/25 text-primary" },
    { l: "One simple inbox", c: "bg-foreground/15" },
    { l: "Built for founders", c: "bg-primary/10 text-primary" },
  ];
  return (
    <section id="about" className="border-b border-border/70">
      <div className="mx-auto grid max-w-7xl gap-10 px-6 py-24 md:grid-cols-12 md:items-center">
        <Reveal className="md:col-span-7">
          <span className="inline-flex items-center gap-2 border border-border px-3 py-1 text-xs font-bold uppercase tracking-wider">
            <Target className="h-3.5 w-3.5 text-primary" /> About redScout
          </span>
          <h2 className="mt-5 max-w-3xl text-3xl font-bold leading-tight tracking-tight md:text-5xl">
            We help <span className="text-primary">founders</span> show up where their next customers are already asking.
          </h2>
          <p className="mt-5 max-w-2xl text-base text-muted-foreground md:text-lg">
            redScout is built for solo founders and small teams who can't waste a day scrolling. Tell us what you sell, and we'll bring the right conversations to you — every day, on autopilot.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4">
            {[{ n: "25+", l: "brands growing" }, { n: "24/7", l: "always listening" }, { n: "60s", l: "to first lead" }].map((s) => (
              <div key={s.n} className="rounded-2xl border border-border/70 bg-white/75 p-4 shadow-[0_16px_40px_-34px_rgba(15,23,42,0.45)]">
                <p className="text-3xl font-bold tracking-tight">{s.n}</p>
                <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{s.l}</p>
              </div>
            ))}
          </div>
        </Reveal>
        <Reveal className="md:col-span-5" delay={150}>
          <div className="relative min-h-[340px] rounded-[2rem] border border-border/70 bg-white/75 p-6 shadow-[0_24px_70px_-42px_rgba(15,23,42,0.45)] backdrop-blur">
            {chips.map((c, i) => (
              <span
                key={c.l}
                className={`absolute ${c.c} rounded-full px-4 py-2 text-sm font-bold border border-border/70 shadow-sm`}
                style={{
                  top: `${10 + i * 18}%`,
                  left: `${(i % 2 === 0 ? 8 : 38) + (i * 4)}%`,
                  transform: `rotate(${(i % 2 === 0 ? -6 : 6) + i}deg)`,
                  animation: `floatChip 4s ease-in-out ${i * 0.3}s infinite`,
                }}
              >
                {c.l}
              </span>
            ))}
            <style>{`@keyframes floatChip { 0%,100% { transform: translateY(0) rotate(var(--r,0deg)); } 50% { transform: translateY(-6px) rotate(var(--r,0deg)); } }`}</style>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Finance-style split ---------------- */

function FinanceSplit() {
  return (
    <section className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,250,245,0.7),rgba(255,255,255,0.3))]">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <Reveal>
          <div className="text-center">
            <p className="label-eyebrow text-primary">How it works</p>
            <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">Get more customers in 3 simple steps</h2>
            <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">
              Tell us about your product. We'll watch the internet for buyer questions 24/7 and deliver the best ones to your inbox, ready for a quick, helpful reply.
            </p>
          </div>
        </Reveal>
        <div className="mt-14 grid gap-5 lg:grid-cols-3">
          {[
            { n: "1", t: "Add your website", d: "We learn what you do and figure out which questions and topics your future customers care about.", img: "/process-1.png" },
            { n: "2", t: "Get warm conversations", d: "We bring the best buyer questions from Reddit and Google straight into one simple inbox — no scrolling required.", img: "/process-2.png" },
            { n: "3", t: "Reply and grow", d: "Send a helpful reply with one click. Build trust, win customers, and watch your brand show up where it matters.", img: "/process-3.png" },
          ].map((step) => (
            <Reveal key={step.n} className="h-full">
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-white/80 shadow-[0_20px_80px_-52px_rgba(15,23,42,0.45)]">
                <div className="relative h-56 overflow-hidden rounded-t-[1.75rem] bg-[linear-gradient(135deg,rgba(255,108,46,0.12),rgba(15,23,42,0.9))] p-5 text-background">
                  <img src={step.img} className="absolute inset-0 h-full w-full object-cover" />
                  {/* <div className="relative flex h-full items-center justify-center rounded-[1.5rem]">
                    <span className="text-3xl font-bold text-white/90">{step.n}</span>
                  </div> */}
                </div>
                <div className="p-6">
                  <h3 className="text-2xl font-bold tracking-tight">{step.t}</h3>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.d}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Scope split (mirrored) ---------------- */

function ScopeSplit() {
  return (
    <section className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-24 grid md:grid-cols-2 gap-10 items-center">
        <Reveal>
          <span className="inline-flex items-center gap-2 border border-border px-3 py-1 text-xs font-bold uppercase tracking-wider">RedScout in numbers</span>
          <h2 className="mt-5 text-3xl md:text-5xl font-bold tracking-tight">
            Reach more buyers, <span className="text-primary">without the burnout</span>
          </h2>
          <p className="mt-4 text-muted-foreground">We bring you the conversations that actually matter — across Reddit communities, competitor mentions, and the searches your future customers are running today.</p>
          <div className="mt-8 grid grid-cols-2 gap-4">
            <div className="border border-border p-5">
              <p className="text-4xl font-bold">15×</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">More replies, less effort</p>
            </div>
            <div className="border border-border p-5">
              <p className="text-4xl font-bold">127K</p>
              <p className="text-xs text-muted-foreground mt-1 uppercase tracking-wider">Buyer conversations surfaced</p>
            </div>
          </div>
        </Reveal>
        <Reveal delay={120}>
          <div className="border border-border bg-card p-6 space-y-4">
            <div className="border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="label-eyebrow text-muted-foreground">Replies</p>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/15 text-primary">+4.8%</span>
              </div>
              <p className="mt-1 text-3xl font-bold">342</p>
              <svg viewBox="0 0 200 50" className="mt-3 w-full h-12">
                <path d="M0 40 Q 30 30 50 35 T 100 20 T 150 15 T 200 10" stroke="hsl(0 0% 10%)" strokeWidth="2" fill="none" className="text-primary" style={{ stroke: "var(--primary)" }} />
                <path d="M0 40 Q 30 30 50 35 T 100 20 T 150 15 T 200 10 L 200 50 L 0 50 Z" style={{ fill: "color-mix(in oklab, var(--primary) 15%, transparent)" }} />
              </svg>
            </div>
            <div className="border border-border p-4">
              <div className="flex items-center justify-between">
                <p className="label-eyebrow text-muted-foreground">Active users</p>
                <span className="text-[10px] font-bold px-2 py-0.5 bg-primary/15 text-primary">+2.95%</span>
              </div>
              <p className="mt-1 text-3xl font-bold">27,480</p>
              <div className="mt-3 grid grid-cols-12 gap-1">
                {Array.from({ length: 36 }).map((_, i) => (
                  <span key={i} className="h-2 w-2" style={{ backgroundColor: i % 4 === 0 ? "var(--primary)" : i % 3 === 0 ? "color-mix(in oklab, var(--primary) 40%, transparent)" : "color-mix(in oklab, var(--foreground) 12%, transparent)" }} />
                ))}
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Pricing ---------------- */

function Pricing() {
  const [loadingPlan, setLoadingPlan] = useState<BillingPlan | null>(null);
  const [interval, setInterval] = useState<"monthly" | "yearly">("monthly");

  const plans = [
    {
      key: "starter" as const,
      name: "Starter",
      price: BILLING_PLANS.starter.monthlyPriceLabel,
      discountedPrice: getDiscountedPriceLabel(BILLING_PLANS.starter.monthlyPriceCents),
      yearlyPrice: `${getYearlyPriceLabel(BILLING_PLANS.starter.monthlyPriceCents)}/yr`,
      d: "For founders just getting started.",
      features: [
        `${BILLING_PLANS.starter.limits.keywords} keywords`,
        `${BILLING_PLANS.starter.limits.competitors} competitors`,
        `${getProjectLimitLabel(BILLING_PLANS.starter.limits.projects)} project`,
      ],
      cta: "Claim Starter",
      featured: false,
    },
    {
      key: "growth" as const,
      name: "Growth",
      price: BILLING_PLANS.growth.monthlyPriceLabel,
      discountedPrice: getDiscountedPriceLabel(BILLING_PLANS.growth.monthlyPriceCents),
      yearlyPrice: `${getYearlyPriceLabel(BILLING_PLANS.growth.monthlyPriceCents)}/yr`,
      d: "For growing teams that want more conversations.",
      features: [
        `${BILLING_PLANS.growth.limits.keywords} keywords`,
        `${BILLING_PLANS.growth.limits.competitors} competitors`,
        `${getProjectLimitLabel(BILLING_PLANS.growth.limits.projects)} projects`,
      ],
      cta: "Claim Growth",
      featured: true,
    },
    {
      key: "agency" as const,
      name: "Agency",
      price: BILLING_PLANS.agency.monthlyPriceLabel,
      discountedPrice: getDiscountedPriceLabel(BILLING_PLANS.agency.monthlyPriceCents),
      yearlyPrice: `${getYearlyPriceLabel(BILLING_PLANS.agency.monthlyPriceCents)}/yr`,
      d: "For agencies running multiple brands.",
      features: [
        `${BILLING_PLANS.agency.limits.keywords} keywords`,
        `${BILLING_PLANS.agency.limits.competitors} competitors`,
        `${getProjectLimitLabel(BILLING_PLANS.agency.limits.projects)} projects`,
      ],
      cta: "Claim Agency",
      featured: false,
    },
  ];

  async function startCheckout(plan: BillingPlan) {
    const email = window.prompt("Enter your billing email");
    if (!email) return;
    const name = window.prompt("Enter your name (optional)") ?? "";

    setLoadingPlan(plan);
    try {
      const r = await fetch("/api/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plan, email, name }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data?.payment_link) {
        throw new Error(data?.error ?? "Could not create checkout session");
      }
      window.location.href = data.payment_link;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      window.alert(msg || "Checkout failed");
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <section id="pricing" className="border-b border-border bg-muted/30">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <Reveal>
          <div className="text-center mb-12">
            <p className="label-eyebrow text-primary">Pricing</p>
            <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">Plans that pay for themselves</h2>
            <p className="mt-4 text-sm text-muted-foreground">Early supporters get 50% off monthly, and yearly plans get an extra 20% on top. Cancel anytime, no questions asked.</p>
            <div className="mt-5 inline-flex items-center rounded-full border border-border bg-card p-1 text-sm">
              <button
                type="button"
                onClick={() => setInterval("monthly")}
                className={`rounded-full px-4 py-1.5 font-semibold transition ${interval === "monthly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                Monthly
              </button>
              <button
                type="button"
                onClick={() => setInterval("yearly")}
                className={`rounded-full px-4 py-1.5 font-semibold transition ${interval === "yearly" ? "bg-foreground text-background" : "text-muted-foreground"}`}
              >
                Yearly <span className="text-primary">-20%</span>
              </button>
            </div>
          </div>
        </Reveal>
        <div className="grid md:grid-cols-3 gap-4">
          {plans.map((p, i) => (
            <Reveal key={p.name} delay={i * 100}>
              <div className={`border p-7 h-full flex flex-col ${p.featured ? "border-foreground bg-foreground text-background" : "border-border bg-card"}`}>
                <p className={`label-eyebrow ${p.featured ? "text-background/70" : "text-muted-foreground"}`}>{p.name}</p>
                <p className="mt-4 flex items-baseline gap-3">
                  <span className={`text-lg line-through ${p.featured ? "text-background/45" : "text-muted-foreground"}`}>{p.price}</span>
                  <span className="text-5xl font-bold">
                    {interval === "monthly" ? p.discountedPrice : p.yearlyPrice}
                    <span className={`text-base font-medium ${p.featured ? "text-background/60" : "text-muted-foreground"}`}>{interval === "monthly" ? "/mo" : ""}</span>
                  </span>
                </p>
                <p className={`mt-2 text-sm ${p.featured ? "text-background/70" : "text-muted-foreground"}`}>{p.d}</p>
                <p className="mt-2 text-xs font-semibold text-primary">
                  {interval === "monthly" ? "50% off for Early Users" : "Yearly = 50% early-bird + extra 20%"}
                </p>
                <ul className="mt-6 space-y-2 flex-1">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className={`h-4 w-4 ${p.featured ? "text-primary" : "text-primary"}`} strokeWidth={3} /> {f}
                    </li>
                  ))}
                  {[
                    "Helpful reply suggestions in one click",
                    "Know when competitors get mentioned",
                    "Safe, gradual account warmup",
                    "Reddit DM browser extension",
                    "Daily goals to keep momentum",
                    "Simple charts to see what's working",
                    "Reports you can actually share",
                    "Cancel anytime",
                  ].map((extra) => (
                    <li key={extra} className="flex items-center gap-2 text-sm">
                      <Check className={`h-4 w-4 ${p.featured ? "text-primary" : "text-primary"}`} strokeWidth={3} /> {extra}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => { void startCheckout(p.key); }}
                  disabled={loadingPlan !== null}
                  className={`mt-7 inline-flex items-center justify-center gap-2 border px-5 py-3 text-sm font-bold uppercase tracking-wider transition disabled:opacity-60 ${p.featured ? "border-background bg-background text-foreground hover:opacity-90" : "border-foreground hover:bg-foreground hover:text-background"}`}
                >
                  {loadingPlan === p.key ? "Opening..." : p.cta} <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-10 grid md:grid-cols-[1.1fr_1fr] gap-0 border border-border bg-card">
            <div className="p-7 md:p-10 border-b md:border-b-0 md:border-r border-border">
              <p className="label-eyebrow text-primary">Try before you commit</p>
              <h3 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
                {THREE_DAY_PASS.label} — {THREE_DAY_PASS.priceLabel}
              </h3>
              <p className="mt-3 text-sm text-muted-foreground max-w-md">{THREE_DAY_PASS.description}</p>
              <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2">
                {THREE_DAY_PASS.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-primary" strokeWidth={3} /> {f}
                  </li>
                ))}
              </ul>
            </div>
            <div className="p-7 md:p-10 flex flex-col justify-center bg-muted/40">
              <p className="text-5xl font-bold tracking-tight">{THREE_DAY_PASS.priceLabel}<span className="text-base font-medium text-muted-foreground"> one-time</span></p>
              <p className="mt-2 text-xs font-semibold text-primary">No subscription · Auto-expires after {THREE_DAY_PASS.durationDays} days</p>
              <Link
                to="/pricing"
                className="mt-6 inline-flex items-center justify-center gap-2 border border-foreground bg-foreground text-background px-5 py-3 text-sm font-bold uppercase tracking-wider transition hover:opacity-90"
              >
                Get 3-Day Pass <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="mt-3 text-xs text-muted-foreground">Outbound (Auto DMs) not included in the pass.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- FAQ ---------------- */

function FAQ() {
  const items = [
    { q: "How does RedScout actually help me get customers?", a: "We surface real conversations where people are asking for products like yours, then help you reply in a way that builds trust. No ads, no cold outreach — just showing up where buyers already are." },
    { q: "Will you post or message people for me automatically?", a: "Never. You always approve every reply and message. We do the searching and the heavy lifting; your words stay yours." },
    { q: "I'm not a marketer. Is this still for me?", a: "Yes — most of our users are founders and small teams. If you can answer an email, you can grow your business with RedScout." },
    { q: "How long until I see results?", a: "Most people get their first warm conversation within a day. Real customers typically follow in the first 2–3 weeks of consistent replying." },
    { q: "Do I need to be active on Reddit already?", a: "Not at all. We'll help you find the right conversations and write replies that fit the community, even if you've never posted before." },
    { q: "Is this safe for my brand?", a: "Totally. RedScout is built around helpful, honest replies — the opposite of spam. We never mass-post or do anything that could get your account flagged." },
    { q: "Can I cancel anytime?", a: "Yes. No contracts, no awkward calls. Cancel in one click and keep all your data." },
    { q: "What if my product is super niche?", a: "Even better. Niche products win on Reddit because real users help each other find them. We'll surface the exact threads where your audience hangs out." },
  ];
  return (
    <section id="faq" className="border-b border-border">
      <div className="max-w-4xl mx-auto px-6 py-24">
        <Reveal>
          <div className="text-center mb-10">
            <p className="label-eyebrow text-primary">FAQ</p>
            <h2 className="mt-3 text-4xl md:text-5xl font-bold tracking-tight">Quick answers</h2>
          </div>
        </Reveal>
        <div className="border border-border bg-card divide-y divide-border">
          {items.map((it, i) => <FAQRow key={it.q} item={it} delay={i * 60} />)}
        </div>
      </div>
    </section>
  );
}

function FAQRow({ item, delay }: { item: { q: string; a: string }; delay: number }) {
  const [open, setOpen] = useState(false);
  return (
    <Reveal delay={delay}>
      <button onClick={() => setOpen((o) => !o)} className="w-full flex items-center justify-between gap-4 p-5 text-left">
        <span className="font-bold">{item.q}</span>
        <span className={`text-2xl transition-transform ${open ? "rotate-45" : ""}`}>+</span>
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="overflow-hidden">
          <p className="px-5 pb-5 text-sm text-muted-foreground">{item.a}</p>
        </div>
      </div>
    </Reveal>
  );
}

/* ---------------- Final CTA + footer ---------------- */

function FinalCTA() {
  return (
    <section className="border-b border-border">
      <div className="max-w-7xl mx-auto px-6 py-24">
        <Reveal>
          <div className="relative border border-border bg-foreground text-background p-12 md:p-20 text-center overflow-hidden">
            <div className="absolute inset-4 border border-dashed border-background/20 pointer-events-none" />
            <h2 className="relative text-4xl md:text-6xl font-bold tracking-tight max-w-3xl mx-auto">
              Your next customer is asking about you <span className="text-primary">right now</span>.
            </h2>
            <p className="relative mt-4 text-background/70 max-w-xl mx-auto">Grab a 3-Day Pass now for $5 and get started in 60 seconds.</p>
            <Link to="/signup" className="relative mt-8 inline-flex items-center gap-2 bg-background text-foreground px-8 py-4 text-sm font-bold uppercase tracking-wider hover:opacity-90">
              Grab 3-Day Pass Now <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------------- Rank on Google + influence AI search ---------------- */

function RankOnGoogle() {
  return (
    <section className="border-b border-border/70 bg-black">
      <div className="mx-auto max-w-7xl px-6 py-24 grid gap-16 items-center lg:grid-cols-[0.95fr_1.05fr] lg:text-left">
        <Reveal className="relative mx-auto flex w-full max-w-xl items-center justify-center lg:justify-start">
          <AnimatedBeamMultipleOutputDemo className="w-full max-w-[520px]" />
        </Reveal>

        <Reveal delay={150}>
          <div className="mx-auto max-w-3xl">
            <h2 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight leading-tight text-white">
              Show up everywhere your buyers <span className="text-primary">search and ask</span>
            </h2>

            <p className="mt-6 text-lg text-white/70 leading-8">
              Today's buyers ask Google, Reddit, ChatGPT, and Perplexity before they ever buy. RedScout helps you be the helpful answer they find — in every one of those places.
            </p>

            <ul className="mt-10 space-y-6">
              {[
                {
                  title: "Be the answer on Google",
                  desc: "We find the Reddit conversations that already rank, so your reply shows up right where buyers are looking.",
                },
                {
                  title: "Get cited by AI tools",
                  desc: "Helpful Reddit answers get pulled into ChatGPT, Perplexity, and Google's AI summaries. We help yours stand out.",
                },
                {
                  title: "Build traffic that keeps paying off",
                  desc: "One great reply can keep bringing in visitors, mentions, and new customers months after you post it.",
                },
              ].map((item) => (
                <li key={item.title} className="flex flex-col items-center gap-4 md:flex-row md:items-start md:text-left md:gap-3">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/30 shrink-0 mt-1">
                    <Check className="h-3.5 w-3.5 text-primary" />
                  </span>
                  <div>
                    <p className="font-semibold text-white">{item.title}</p>
                    <p className="mt-1.5 text-sm text-white/60">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

function ResultsCarousel() {
  const cards = Array.from({ length: 9 }, (_, index) => ({
    id: index + 1,
    src: `/redscout-proof-${index + 1}.jpeg`,
    title: `Proof ${index + 1}`,
    subtitle: `Real customer wins from real conversations`,
  }));

  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxSrc, setLightboxSrc] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLDivElement | null>>([]);

  const scrollToIndex = (index: number) => {
    const normalized = (index + cards.length) % cards.length;
    setActiveIndex(normalized);
    cardRefs.current[normalized]?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  };

  const handlePrev = () => scrollToIndex(activeIndex - 1);
  const handleNext = () => scrollToIndex(activeIndex + 1);

  return (
    <section className="border-b border-border/70 bg-slate-950">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <Reveal>
          <div className="text-center sm:text-left">
            <h2 className="text-4xl font-bold tracking-tight text-white">Real wins from real founders</h2>
            <p className="mt-4 max-w-3xl text-sm text-white/70 sm:text-base">
              Nine snapshots of founders who turned everyday conversations into customers, traffic, and trust.
            </p>
          </div>
        </Reveal>

        <div className="relative mt-12">
          <div className="absolute inset-y-0 left-0 flex items-center px-3 sm:px-4 z-10">
            <button
              type="button"
              onClick={handlePrev}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
              aria-label="Previous proof"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          </div>
          <div className="absolute inset-y-0 right-0 flex items-center px-3 sm:px-4 z-10">
            <button
              type="button"
              onClick={handleNext}
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/15 bg-white/10 text-white transition hover:bg-white/15"
              aria-label="Next proof"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div
            ref={scrollRef}
            className="results-carousel-scroll -mx-3 overflow-x-auto pb-4 scroll-smooth relative z-0"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            <style>{`
              .results-carousel-scroll::-webkit-scrollbar { display: none; }
              .results-carousel-scroll { scrollbar-width: none; -ms-overflow-style: none; }
            `}</style>
            <div className="flex gap-6 px-3 sm:px-4">
              {cards.map((card, index) => (
                <div
                  key={card.id}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  className="snap-center flex-none min-w-[calc(33.333%-1rem)] max-w-[420px] overflow-hidden rounded-[2rem] border border-border/80 bg-[#0e1723] shadow-[0_30px_80px_-50px_rgba(0,0,0,0.45)]"
                >
                  <button
                    type="button"
                    onClick={() => setLightboxSrc(card.src)}
                    className="group block h-72 w-full overflow-hidden bg-zinc-950"
                  >
                    <img
                      src={card.src}
                      alt={card.title}
                      className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                    />
                  </button>
                  <div className="p-6">
                    <p className="text-xs font-semibold uppercase tracking-[0.26em] text-primary">{card.title}</p>
                    <h3 className="mt-3 text-lg font-semibold text-white">{card.subtitle}</h3>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {lightboxSrc ? (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6 backdrop-blur-sm"
            onClick={() => setLightboxSrc(null)}
          >
            <div className="relative max-h-[90vh] max-w-[90vw]" onClick={(event) => event.stopPropagation()}>
              <button
                type="button"
                onClick={() => setLightboxSrc(null)}
                className="absolute right-4 top-4 z-10 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition hover:bg-white/20"
                aria-label="Close image preview"
              >
                ×
              </button>
              <img src={lightboxSrc} alt="Proof image" className="max-h-[90vh] max-w-[90vw] rounded-[1.5rem] object-contain shadow-2xl" />
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

/* ---------------- Automation philosophy ---------------- */

function AutomationPhilosophy() {
  const items = [
    { icon: Bot, t: "We do the listening", d: "RedScout watches Reddit and Google around the clock so you don't have to scroll for hours." },
    { icon: Sparkles, t: "We draft the reply", d: "Get a helpful, on-brand reply suggestion that fits the community — ready in seconds." },
    { icon: Target, t: "You stay in control", d: "Nothing gets posted without you. We handle the busywork; your voice stays yours." },
  ];
  return (
    <section className="border-b border-border/70">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <Reveal>
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">How we work</p>
            <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight leading-tight">
              We do the busywork. <span className="text-primary">You keep the voice.</span>
            </h2>
            <p className="mt-5 text-base md:text-lg text-muted-foreground leading-8">
              Spammy bots get banned and brands get mocked. RedScout removes the hours of searching and sorting, so the only thing left is the part you're great at — talking to people like a human.
            </p>
          </div>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-3 gap-5">
          {items.map((it, i) => (
            <Reveal key={it.t} delay={i * 100}>
              <div className="h-full rounded-[1.75rem] border border-border/70 bg-white/85 p-7 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.45)]">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
                  <it.icon className="h-5 w-5" />
                </span>
                <h3 className="mt-5 text-xl font-bold tracking-tight">{it.t}</h3>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">{it.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ---------------- Testimonials ---------------- */

function Testimonials() {
  const quotes = [
    { q: "First customer in 9 days. We replied to one Reddit thread redScout surfaced — they signed up the next day.", name: "Marina K.", role: "Founder, Lumitrix", initials: "MK" },
    { q: "I used to spend 2 hours every morning scrolling Reddit. Now I open the inbox, reply to 5 things, and ship.", name: "Devon R.", role: "Solo dev, Bioplex", initials: "DR" },
    { q: "We replaced a $400/mo agency with redScout. Our Reddit thread is ranking #1 on Google for our main keyword.", name: "Priya S.", role: "Head of Growth, Nexiflow", initials: "PS" },
    { q: "Best $19 I spend every month. The scoring is freakishly accurate — almost every 85+ post is a real lead.", name: "Tomás L.", role: "Indie maker, Vortexia", initials: "TL" },
  ];
  return (
    <section className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,247,240,0.6),rgba(255,255,255,0))]">
      <div className="mx-auto max-w-7xl px-6 py-24">
        <Reveal>
          <div className="text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">Loved by founders</p>
            <h2 className="mt-3 text-3xl md:text-5xl font-bold tracking-tight">Real founders. Real pipeline.</h2>
            <div className="mt-4 inline-flex items-center gap-2 text-sm text-muted-foreground">
              <span className="inline-flex items-center gap-0.5 text-primary">
                {Array.from({ length: 5 }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
              </span>
              <span>4.9 / 5 from 240+ teams</span>
            </div>
          </div>
        </Reveal>
        <div className="mt-12 grid md:grid-cols-2 gap-5">
          {quotes.map((it, i) => (
            <Reveal key={it.name} delay={i * 80}>
              <figure className="h-full rounded-[1.75rem] border border-border/70 bg-white/90 p-7 shadow-[0_20px_60px_-44px_rgba(15,23,42,0.45)]">
                <Quote className="h-6 w-6 text-primary" />
                <blockquote className="mt-3 text-base md:text-lg leading-8 text-foreground/90">"{it.q}"</blockquote>
                <figcaption className="mt-5 flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-background text-xs font-bold">{it.initials}</span>
                  <span>
                    <span className="block text-sm font-semibold">{it.name}</span>
                    <span className="block text-xs text-muted-foreground">{it.role}</span>
                  </span>
                </figcaption>
              </figure>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="max-w-7xl mx-auto px-6 py-12 grid md:grid-cols-4 gap-8">
        <div>
          <div className="flex items-center gap-2">
              <BrandIcon className="h-10 w-auto object-contain" />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Turn everyday conversations into customers.</p>
        </div>
        {[
          { h: "Product", l: ["Features", "Pricing", "Changelog", "Roadmap"] },
          { h: "Company", l: ["About", "Blog", "Careers", "Contact"] },
          { h: "Legal", l: ["Privacy", "Terms", "Security", "DPA"] },
        ].map((c) => (
          <div key={c.h}>
            <p className="label-eyebrow text-muted-foreground mb-3">{c.h}</p>
            <ul className="space-y-2 text-sm">
              {c.l.map((i) => <li key={i}><a href={i === "Features" ? "/features" : i === "Pricing" ? "#pricing" : "#"} className="hover:text-primary">{i}</a></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-6 flex items-center justify-between text-xs text-muted-foreground">
          <span>© redScout 2026 — All rights reserved.</span>
          <span className="label-eyebrow">v2.0</span>
        </div>
      </div>
    </footer>
  );
}

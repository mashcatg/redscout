import { Link } from "@tanstack/react-router";
import { ArrowRight, Check, Mail, Star } from "lucide-react";
import type { FeaturePageData } from "@/lib/feature-pages";
import MarketingHeader from "@/components/marketing/MarketingHeader";
import MarketingFooter from "@/components/marketing/MarketingFooter";

export function FeaturePageShell({ page }: { page: FeaturePageData }) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,95,45,0.14),_transparent_30%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_42%,#fff8f2_100%)] text-foreground">
      <MarketingHeader />


      <main>
        <section className="relative overflow-hidden border-b border-border/70">
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-20 top-10 h-72 w-72 rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute right-0 top-0 h-96 w-96 rounded-full bg-foreground/5 blur-3xl" />
          </div>
          <div className="mx-auto grid max-w-7xl gap-10 px-6 py-20 lg:grid-cols-[1.06fr_.94fr] lg:items-center lg:py-24">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/8 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.22em] text-primary shadow-sm">
                <span className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                {page.eyebrow}
              </span>
              <h1 className="mt-6 max-w-3xl text-5xl font-bold tracking-tight leading-[0.92] text-balance sm:text-6xl lg:text-7xl">
                {page.title} <span className="text-primary">{page.highlight}</span>
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-muted-foreground sm:text-xl">{page.description}</p>
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link to="/signup" className="inline-flex items-center gap-2 rounded-full border border-foreground bg-foreground px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-background transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-foreground/10">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="#faq" className="inline-flex items-center gap-2 rounded-full border border-border bg-white/75 px-7 py-3.5 text-sm font-bold uppercase tracking-wider text-foreground transition hover:border-primary/40 hover:bg-primary/6">
                  Read FAQ
                </a>
              </div>
              <div className="mt-10 grid max-w-2xl grid-cols-3 gap-3">
                {page.stats.map((stat) => (
                  <div key={stat.label} className="rounded-2xl border border-border/70 bg-white/75 px-4 py-3 shadow-[0_10px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur">
                    <p className="text-2xl font-bold tracking-tight text-foreground">{stat.value}</p>
                    <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{stat.label}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{stat.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative">
              <div className="absolute -inset-6 -z-10 rounded-[2rem] bg-primary/10 blur-3xl" />
              <div className="overflow-hidden rounded-[2rem] border border-border/70 bg-white/85 p-4 shadow-[0_24px_80px_-40px_rgba(15,23,42,0.55)] backdrop-blur-xl">
                <div className="flex items-center justify-between border-b border-border/80 px-2 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-primary" />
                    <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                    <span className="h-2.5 w-2.5 rounded-full bg-foreground/20" />
                  </div>
                  <span className="text-xs font-mono text-muted-foreground">redscout.tech</span>
                </div>
                <div className="grid gap-4 p-3 sm:grid-cols-[1.05fr_.95fr]">
                  <div className="rounded-[1.5rem] border border-border/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(255,248,244,0.88))] p-4 shadow-[0_16px_50px_-32px_rgba(15,23,42,0.35)]">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">{page.heroCardTitle}</p>
                    <div className="mt-4 rounded-[1.5rem] border border-border/70 bg-white/95 p-4">
                      <img src="/redscout_logo_icon.png" alt="RedScout icon placeholder" className="mx-auto h-24 w-24 object-contain" />
                      <p className="mt-4 text-center text-sm leading-7 text-muted-foreground">{page.heroCardCopy}</p>
                    </div>
                  </div>
                  <div className="grid gap-4">
                    {page.bento.map((card) => (
                      <div key={card.title} className="rounded-[1.5rem] border border-border/80 bg-white/90 p-4 shadow-[0_16px_50px_-32px_rgba(15,23,42,0.3)]">
                        <div className="mb-3 overflow-hidden rounded-2xl border border-border/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.95),rgba(255,247,241,0.9))] p-3">
                          <img src="/redscout_logo_icon.png" alt="Feature placeholder" className="mx-auto h-14 w-14 object-contain" />
                        </div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">{card.kicker}</p>
                        <h3 className="mt-2 text-lg font-bold tracking-tight">{card.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{card.copy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-border/70">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="grid gap-4 md:grid-cols-3">
              {page.features.map((feature) => (
                <div key={feature.title} className="rounded-[1.75rem] border border-border/70 bg-white/80 p-6 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)]">
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Check className="h-5 w-5" strokeWidth={3} />
                  </div>
                  <h2 className="mt-5 text-xl font-bold">{feature.title}</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">{feature.copy}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,250,245,0.7),rgba(255,255,255,0.3))]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="text-center">
              <p className="label-eyebrow text-primary">3 simple steps</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-6xl">{page.stepsHeading}</h2>
              <p className="mx-auto mt-4 max-w-3xl text-base leading-8 text-muted-foreground md:text-lg">{page.stepsCopy}</p>
            </div>
            <div className="mt-14 grid gap-5 lg:grid-cols-3">
              {page.steps.map((step) => (
                <div key={step.title} className="overflow-hidden rounded-[2rem] border border-border/70 bg-white/80 shadow-[0_20px_80px_-52px_rgba(15,23,42,0.45)]">
                  <div className="relative h-56 bg-[linear-gradient(135deg,rgba(255,108,46,0.12),rgba(15,23,42,0.9))] p-5 text-background">
                    <div className="absolute left-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-black text-primary-foreground">{step.number}</div>
                    <div className="mt-10 flex h-full items-center justify-center rounded-[1.5rem] border border-white/15 bg-white/10 backdrop-blur-sm">
                      <div className="space-y-3 px-5 text-center">
                        <div className="mx-auto h-10 w-10 rounded-full bg-white/90" />
                        <div className="mx-auto h-3 w-36 rounded-full bg-white/70" />
                        <div className="mx-auto h-3 w-28 rounded-full bg-white/50" />
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h3 className="text-2xl font-bold tracking-tight">{step.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-muted-foreground">{step.copy}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/70">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="text-center">
              <p className="label-eyebrow text-primary">Reviews</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Why founders trust {page.reviewLabel}</h2>
              <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Real quotes from operators who want the same thing you do: more qualified conversations, faster.</p>
            </div>
            <div className="mt-12 grid gap-4 md:grid-cols-3">
              {page.reviews.map((review) => (
                <article key={review.name} className="rounded-[1.75rem] border border-border/70 bg-white/80 p-6 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)]">
                  <div className="flex gap-1 text-primary">
                    {Array.from({ length: review.stars }).map((_, i) => <Star key={i} className="h-4 w-4 fill-current" />)}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-foreground/80">{review.quote}</p>
                  <div className="mt-6 flex items-center gap-3 border-t border-border/70 pt-4">
                    <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary/40 to-foreground/20" />
                    <div>
                      <p className="text-sm font-bold">{review.name}</p>
                      <p className="text-xs text-muted-foreground">{review.role}</p>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-b border-border/70">
          <div className="mx-auto max-w-4xl px-6 py-20">
            <div className="text-center">
              <p className="label-eyebrow text-primary">FAQ</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Questions about {page.faqLabel}</h2>
            </div>
            <div className="mt-10 divide-y divide-border rounded-[1.75rem] border border-border/70 bg-white/80 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)]">
              {page.faqs.map((faq) => (
                <details key={faq.q} className="group p-5">
                  <summary className="cursor-pointer list-none text-sm font-bold text-foreground outline-none">
                    {faq.q}
                    <span className="float-right transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{faq.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/70 bg-[linear-gradient(180deg,rgba(255,250,245,0.7),rgba(255,255,255,0.3))]">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="text-center">
              <p className="label-eyebrow text-primary">Internal links</p>
              <h2 className="mt-3 text-4xl font-bold tracking-tight md:text-5xl">Explore related redScout pages</h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted-foreground">Move through connected features to build your complete Reddit growth system.</p>
            </div>
            <div className="mt-10 grid gap-4 md:grid-cols-3">
              {page.related.map((item) => (
                <Link
                  key={item.href}
                  to={item.href}
                  className="group rounded-[1.5rem] border border-border/70 bg-white/80 p-5 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] transition hover:-translate-y-1 hover:border-primary/40"
                >
                  <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-primary/10 text-primary">
                    <ArrowRight className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">{item.label}</h3>
                  <p className="mt-2 text-sm text-muted-foreground">Open this page to connect strategy, execution, and analytics.</p>
                  <p className="mt-3 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    Visit page <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-border/70">
          <div className="mx-auto max-w-7xl px-6 py-20">
            <div className="rounded-[2.5rem] border border-foreground/10 bg-foreground p-10 text-center text-background shadow-[0_30px_100px_-60px_rgba(15,23,42,0.7)] md:p-16">
              <h2 className="mx-auto max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
                Ready to turn Reddit into a growth channel?
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-background/70">
                Start free, cancel anytime, and keep your data under your control. Email us at <a className="text-primary underline-offset-4 hover:underline" href="mailto:hello@redscout.tech">hello@redscout.tech</a> anytime.
              </p>
              <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                <Link to="/signup" className="inline-flex items-center gap-2 rounded-full bg-background px-8 py-4 text-sm font-bold uppercase tracking-wider text-foreground transition hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/20">
                  Start free <ArrowRight className="h-4 w-4" />
                </Link>
                <a href="mailto:hello@redscout.tech" className="inline-flex items-center gap-2 rounded-full border border-background/20 bg-background/10 px-8 py-4 text-sm font-bold uppercase tracking-wider text-background transition hover:bg-background hover:text-foreground">
                  Talk to us <Mail className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}


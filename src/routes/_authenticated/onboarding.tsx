import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowRight, ArrowLeft, Plus, X, Loader2, Check, RotateCw,
  Globe, Users, Sparkles, Search,
} from "lucide-react";
import BrandIcon from "@/components/BrandIcon";
import { toast } from "sonner";
import { scrapeWebsite, suggestKeywordsGrouped } from "@/lib/onboarding.functions";
import { createOrganization, listOrganizations } from "@/lib/org.functions";

export const Route = createFileRoute("/_authenticated/onboarding")({
  validateSearch: (s: Record<string, unknown>) => ({ add: s.add ? Number(s.add) : 0 }),
  component: OnboardingPage,
});

type Competitor = { name: string; website_url: string; description: string };
type KwGroup = { source: string; keywords: string[] };

const STEPS = [
  { n: 1, label: "Product", icon: Globe, hint: "We scan your site to know what you sell." },
  { n: 2, label: "Competitors", icon: Users, hint: "Optionalb ut sharpens scoring against rivals." },
  { n: 3, label: "Keywords", icon: Search, hint: "Pick the searches your buyers actually run." },
] as const;

function OnboardingPage() {
  const navigate = useNavigate();
  const scrapeFn = useServerFn(scrapeWebsite);
  const suggestFn = useServerFn(suggestKeywordsGrouped);
  const createFn = useServerFn(createOrganization);
  const listFn = useServerFn(listOrganizations);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);

  const search = Route.useSearch();
  const adding = search.add === 1;

  useEffect(() => {
    if (adding) return;
    (async () => {
      try {
        const res: unknown = await listFn();
        const orgs = Array.isArray(res) ? (res as Array<{ id: string }>) : [];
        if (orgs.length > 0) {
          navigate({ to: "/dashboard/$orgId/inbox/seo", params: { orgId: orgs[0].id }, replace: true });
        }
      } catch { /* ignore */ }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adding]);

  // Step 1
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [productName, setProductName] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [faviconUrl, setFaviconUrl] = useState("");
  const scraped = productName.length > 0 && productDescription.length > 0;

  // Step 2
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [compUrl, setCompUrl] = useState("");

  // Step 3
  const [groups, setGroups] = useState<KwGroup[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<Set<string>>(new Set());
  const [customKw, setCustomKw] = useState("");

  async function handleScrape() {
    if (!websiteUrl) return;
    setLoading(true);
    try {
      const res = await scrapeFn({ data: { url: websiteUrl } });
      if (res.ok) {
        setProductName(res.name);
        setProductDescription(res.description);
        setFaviconUrl(res.favicon_url);
        toast.success("Site scraped");
      } else {
        toast.error(res.error || "Scrape failed");
      }
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }

  async function handleAddCompetitor() {
    if (!compUrl || competitors.length >= 3) return;
    setLoading(true);
    try {
      const res = await scrapeFn({ data: { url: compUrl } });
      if (res.ok) {
        setCompetitors([...competitors, { name: res.name, website_url: compUrl, description: res.description }]);
        setCompUrl("");
      } else { toast.error(res.error || "Failed"); }
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }

  async function loadKeywords() {
    setLoading(true);
    try {
      const res = await suggestFn({ data: { productName, productDescription, competitors: [] } });
      const next: KwGroup[] = [{ source: productName || "Your product", keywords: res.product }];
      setGroups(next);
      setSelectedKeywords(new Set(res.product));
      if (!res.ok) toast.error(res.error || "Keyword suggestions failed");
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }

  async function goToStep3() {
    setStep(3);
    if (groups.length === 0) await loadKeywords();
  }

  function toggleKw(k: string) {
    const next = new Set(selectedKeywords);
    if (next.has(k)) next.delete(k); else next.add(k);
    setSelectedKeywords(next);
  }

  function addCustomKw() {
    const k = customKw.trim().toLowerCase();
    if (!k) return;
    setGroups((prev) => {
      const idx = prev.findIndex((g) => g.source === "Custom");
      if (idx >= 0) {
        if (prev[idx].keywords.includes(k)) return prev;
        const copy = [...prev];
        copy[idx] = { ...copy[idx], keywords: [...copy[idx].keywords, k] };
        return copy;
      }
      return [...prev, { source: "Custom", keywords: [k] }];
    });
    const next = new Set(selectedKeywords); next.add(k);
    setSelectedKeywords(next);
    setCustomKw("");
  }

  async function handleFinish() {
    setLoading(true);
    try {
      const keywords = Array.from(
        new Set(Array.from(selectedKeywords).map((k) => k.trim().toLowerCase()).filter(Boolean))
      );
      const res = await createFn({
        data: {
          name: productName,
          website_url: websiteUrl || null,
          favicon_url: faviconUrl || null,
          product_name: productName,
          product_description: productDescription,
          competitors,
          keywords,
        },
      });
      toast.success("Workspace ready");
      navigate({ to: "/dashboard/$orgId/inbox/seo", params: { orgId: res.orgId }, replace: true });
    } catch (e) { toast.error((e as Error).message); }
    setLoading(false);
  }

  const canNext = useMemo(() => {
    if (step === 1) return scraped;
    if (step === 2) return true; // optional
    return selectedKeywords.size > 0;
  }, [step, scraped, selectedKeywords]);

  const current = STEPS[step - 1];

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-[radial-gradient(circle_at_top,_rgba(255,95,45,0.10),_transparent_30%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_60%,#fff8f2_100%)] text-foreground">
      {/* Left – form */}
      <div className="flex flex-col px-6 py-10 sm:px-10 lg:px-14">
        <Link to="/" className="inline-flex items-center gap-2 mb-10">
          <BrandIcon className="h-7 w-7" />
          <span className="text-2xl font-bold tracking-tight">redScout</span>
        </Link>

        {/* Progress */}
        <div className="flex items-center gap-3 mb-10">
          {STEPS.map((s, i) => {
            const active = s.n === step;
            const done = s.n < step;
            return (
              <div key={s.n} className="flex items-center gap-3 flex-1">
                <div className={`flex items-center gap-2 ${active ? "" : done ? "" : "opacity-50"}`}>
                  <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border ${
                    done ? "bg-primary text-primary-foreground border-primary"
                    : active ? "bg-foreground text-background border-foreground"
                    : "bg-background border-border text-muted-foreground"
                  }`}>
                    {done ? <Check className="h-4 w-4" /> : s.n}
                  </div>
                  <span className={`text-xs font-semibold uppercase tracking-wider ${active ? "text-foreground" : "text-muted-foreground"}`}>{s.label}</span>
                </div>
                {i < STEPS.length - 1 && <div className={`flex-1 h-px ${done ? "bg-primary" : "bg-border"}`} />}
              </div>
            );
          })}
        </div>

        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Step {step} of 3 · {current.label}</p>
          <h1 className="mt-2 text-3xl sm:text-[2.25rem] font-semibold tracking-tight leading-tight">
            {step === 1 && <>Let's start with <span className="text-primary">your product</span>.</>}
            {step === 2 && <>Who are you <span className="text-primary">competing</span> with?</>}
            {step === 3 && <>Pick the <span className="text-primary">keywords</span> your buyers search.</>}
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">{current.hint}</p>
        </div>

        <div className="mt-8 max-w-xl flex-1">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Website URL</label>
                <div className="flex gap-2">
                  <input value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)} placeholder="https://yourproduct.com"
                    className="flex-1 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20 transition" />
                  <button onClick={handleScrape} disabled={loading || !websiteUrl}
                    className="rounded-lg bg-foreground text-background px-4 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : scraped ? <RotateCw className="h-4 w-4" /> : "Scan"}
                  </button>
                </div>
                <p className="mt-1.5 text-xs text-muted-foreground">We'll auto-fill your product name, description and favicon.</p>
              </div>

              {scraped && (
                <div className="rounded-xl border border-border bg-white p-4 flex gap-3 shadow-sm">
                  {faviconUrl && <img src={faviconUrl} alt="" className="h-10 w-10 mt-0.5 rounded-md border border-border bg-white" />}
                  <div className="min-w-0">
                    <p className="font-semibold text-sm">{productName}</p>
                    <p className="text-xs text-muted-foreground line-clamp-3 mt-1">{productDescription}</p>
                  </div>
                </div>
              )}

              {scraped && (
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Edit product name</label>
                    <input value={productName} onChange={(e) => setProductName(e.target.value)}
                      className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20 transition" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Favicon URL</label>
                    <input value={faviconUrl} onChange={(e) => setFaviconUrl(e.target.value)}
                      className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20 transition" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Description</label>
                    <textarea value={productDescription} onChange={(e) => setProductDescription(e.target.value)} rows={4}
                      className="w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20 transition" />
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {competitors.length < 3 && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Competitor website</label>
                  <div className="flex gap-2">
                    <input value={compUrl} onChange={(e) => setCompUrl(e.target.value)} placeholder="https://competitor.com"
                      className="flex-1 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20 transition" />
                    <button onClick={handleAddCompetitor} disabled={loading || !compUrl}
                      className="rounded-lg bg-foreground text-background px-4 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition inline-flex items-center gap-1.5">
                      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4" /> Add</>}
                    </button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">Add up to 3. Skip if you'd rather configure later.</p>
                </div>
              )}
              <div className="space-y-2">
                {competitors.map((c, i) => (
                  <div key={i} className="rounded-xl border border-border bg-white p-3 flex items-start justify-between gap-2 shadow-sm">
                    <div className="min-w-0">
                      <p className="font-semibold text-sm">{c.name}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{c.description}</p>
                    </div>
                    <button onClick={() => setCompetitors(competitors.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-foreground">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {competitors.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No competitors added — that's fine.</p>
                )}
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              {loading && groups.length === 0 && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating keywords with AI…
                </div>
              )}

              {groups.map((g) => (
                <div key={g.source}>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{g.source}</p>
                  <div className="flex flex-wrap gap-2">
                    {g.keywords.length === 0 && <span className="text-xs text-muted-foreground">No keywords returned</span>}
                    {g.keywords.map((k) => {
                      const on = selectedKeywords.has(k);
                      return (
                        <button key={`${g.source}-${k}`} onClick={() => toggleKw(k)}
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                            on ? "border-foreground bg-foreground text-background" : "border-border bg-white text-muted-foreground hover:border-foreground/40"
                          }`}>
                          {on && <Check className="h-3 w-3" />} {k}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}

              {!loading && groups.length === 0 && (
                <button onClick={loadKeywords} className="rounded-lg border border-border bg-white px-4 py-2 text-xs font-semibold uppercase tracking-wider hover:bg-accent/30">
                  Retry suggestions
                </button>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Add custom keyword</label>
                <div className="flex gap-2">
                  <input value={customKw} onChange={(e) => setCustomKw(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCustomKw(); } }}
                    placeholder="e.g. reddit marketing tool"
                    className="flex-1 rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20 transition" />
                  <button onClick={addCustomKw} className="rounded-lg border border-border bg-white px-4 text-sm font-semibold hover:bg-accent/30 inline-flex items-center gap-1.5">
                    <Plus className="h-4 w-4" /> Add
                  </button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">{selectedKeywords.size} keyword{selectedKeywords.size === 1 ? "" : "s"} selected</p>
            </div>
          )}
        </div>

        {/* Sticky bottom action bar */}
        <div className="sticky bottom-0 -mx-6 sm:-mx-10 lg:-mx-14 mt-10 border-t border-border bg-background/85 backdrop-blur px-6 sm:px-10 lg:px-14 py-4 flex items-center justify-between">
          <button onClick={() => setStep((s) => (s > 1 ? ((s - 1) as 1 | 2 | 3) : s))} disabled={step === 1}
            className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground disabled:opacity-40 disabled:cursor-not-allowed">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          {step < 3 ? (
            <button onClick={() => { if (step === 2) void goToStep3(); else setStep(2); }} disabled={!canNext}
              className="inline-flex items-center gap-2 rounded-lg bg-foreground text-background px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button onClick={handleFinish} disabled={loading || selectedKeywords.size === 0}
              className="inline-flex items-center gap-2 rounded-lg bg-primary text-primary-foreground px-5 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <>Launch workspace <ArrowRight className="h-4 w-4" /></>}
            </button>
          )}
        </div>
      </div>

      {/* Right – live preview panel */}
      <aside className="hidden lg:flex relative overflow-hidden flex-col items-center justify-center px-12 py-12 border-l border-border/60 bg-[linear-gradient(160deg,#fff3e8_0%,#ffe4d2_55%,#ffd1b3_100%)]">
        <div className="pointer-events-none absolute -top-24 -right-20 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-6rem] left-[-3rem] h-72 w-72 rounded-full bg-foreground/10 blur-3xl" />

        <div className="relative w-full max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-3 py-1 text-xs font-semibold text-primary border border-white/80 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Live preview
          </div>

          {/* Step 1 preview */}
          {step === 1 && (
            <div className="mt-5 rounded-2xl border border-white/70 bg-white/85 backdrop-blur p-5 shadow-xl shadow-primary/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Your workspace</p>
              <div className="mt-3 flex items-center gap-3">
                {faviconUrl ? <img src={faviconUrl} alt="" className="h-12 w-12 rounded-lg border border-border" />
                  : <div className="h-12 w-12 rounded-lg border border-dashed border-border bg-muted/40" />}
                <div className="min-w-0">
                  <p className="font-semibold truncate">{productName || "Your product name"}</p>
                  <p className="text-xs text-muted-foreground truncate">{websiteUrl || "https://yourproduct.com"}</p>
                </div>
              </div>
              <p className="mt-4 text-xs text-foreground/70 line-clamp-4 leading-relaxed">
                {productDescription || "We'll write a clean product summary from your site so AI scoring knows exactly what counts as a qualified Reddit lead."}
              </p>
            </div>
          )}

          {/* Step 2 preview */}
          {step === 2 && (
            <div className="mt-5 rounded-2xl border border-white/70 bg-white/85 backdrop-blur p-5 shadow-xl shadow-primary/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tracked competitors</p>
              <div className="mt-3 space-y-2">
                {competitors.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">No competitors yet — every mention of them on Reddit will surface in your inbox.</p>
                )}
                {competitors.map((c, i) => (
                  <div key={i} className="rounded-lg border border-border bg-white p-2.5">
                    <p className="text-sm font-semibold truncate">{c.name}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{c.website_url}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 3 preview */}
          {step === 3 && (
            <div className="mt-5 rounded-2xl border border-white/70 bg-white/85 backdrop-blur p-5 shadow-xl shadow-primary/10">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Will start scanning</p>
              <div className="mt-3 flex flex-wrap gap-1.5 max-h-40 overflow-hidden">
                {Array.from(selectedKeywords).slice(0, 14).map((k) => (
                  <span key={k} className="inline-flex items-center gap-1 rounded-full bg-foreground text-background px-2.5 py-1 text-[11px] font-semibold">
                    <Search className="h-3 w-3" /> {k}
                  </span>
                ))}
                {selectedKeywords.size === 0 && (
                  <p className="text-xs text-muted-foreground italic">Pick at least one keyword to start scanning Reddit + Google.</p>
                )}
                {selectedKeywords.size > 14 && (
                  <span className="text-[11px] text-muted-foreground">+{selectedKeywords.size - 14} more</span>
                )}
              </div>
              <div className="mt-4 rounded-lg border border-primary/20 bg-primary/8 p-3">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-primary">First scan</p>
                <p className="mt-1 text-xs text-foreground/80">Reddit + Google SERPs scanned within 60 seconds of finishing setup.</p>
              </div>
            </div>
          )}

          <ul className="mt-8 space-y-2.5 text-sm">
            {[
              "AI-scored opportunities every day",
              "Reddit threads ranked on Google",
              "Daily targets + streaks to stay consistent",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-foreground/80">{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}

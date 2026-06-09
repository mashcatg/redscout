import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUp, MessageCircle, AlertCircle, RotateCw, Filter as FilterIcon, Tag, Bookmark, BookmarkX, CheckCheck, Archive, ArchiveRestore, RotateCcw, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  listInboxItems,
  runOneScanJob,
  getScanProgress,
  retryScanJob,
  listScanJobs,
  listOrgKeywords,
  listOrgCompetitors,
} from "@/lib/scan.functions";
import { markInboxItemsBulk } from "@/lib/bulk-actions.functions";
import { getIsAdmin } from "@/lib/roles.functions";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { PostDetailPanel, type DetailItem } from "@/components/PostDetailPanel";
import { BulkActionBar, type BulkAction } from "@/components/BulkActionBar";
import { toast } from "sonner";

type Source = "sociavault_keyword" | "sociavault_competitor" | "brightdata_serp";
type InboxItem = DetailItem;
type Filter = "new" | "saved" | "replied" | "archived" | "all";
type SortBy = "newest" | "score" | "upvotes" | "google";
type ScoreMin = -50 | 0 | 50 | 70 | 90;
type PositionMax = 0 | 3 | 10 | 50;

export function InboxPage({
  orgId,
  title,
  eyebrow,
  sources,
  jobTypes,
  layout = "list",
  showCompetitorFilter = false,
  competitorsOnly = false,
}: {
  orgId: string;
  title: string;
  eyebrow: string;
  sources: Source[];
  jobTypes: string[];
  layout?: "list" | "split";
  showCompetitorFilter?: boolean;
  competitorsOnly?: boolean;
}) {
  const qc = useQueryClient();
  const listFn = useServerFn(listInboxItems);
  const runFn = useServerFn(runOneScanJob);
  const progressFn = useServerFn(getScanProgress);
  const jobsFn = useServerFn(listScanJobs);
  const retryFn = useServerFn(retryScanJob);
  const kwFn = useServerFn(listOrgKeywords);
  const compFn = useServerFn(listOrgCompetitors);

  const isSeo = sources.includes("brightdata_serp");

  const [filter, setFilter] = useState<Filter>("new");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  // Advanced filters
  const [scoreMin, setScoreMin] = useState<ScoreMin>(0);
  const [sortBy, setSortBy] = useState<SortBy>(isSeo ? "google" : "score");
  const [positionMax, setPositionMax] = useState<PositionMax>(0);
  const [subredditQ, setSubredditQ] = useState("");
  const [competitorIds, setCompetitorIds] = useState<string[]>([]);
  const [keywordIds, setKeywordIds] = useState<string[]>([]);

  const bulkFn = useServerFn(markInboxItemsBulk);
  function getBulkActionMessage(action: BulkAction, count: number) {
    const verb = {
      save: "saved",
      unsave: "unsaved",
      archive: "archived",
      unarchive: "unarchived",
      replied: "replied",
      reset: "marked new",
      read: "marked read",
    }[action];

    const itemText = count === 1 ? "item" : "items";
    return `${count} ${itemText} ${verb}`;
  }

  const bulkM = useMutation({
    mutationFn: (p: { ids: string[]; action: BulkAction }) => bulkFn({ data: p }),
    onSuccess: (_d, vars) => {
      toast.success(getBulkActionMessage(vars.action, vars.ids.length));
      setCheckedIds(new Set());
      qc.invalidateQueries({ queryKey: ["inbox", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  function rowAction(id: string, action: BulkAction) {
    bulkM.mutate({ ids: [id], action });
  }

  const itemsQ = useQuery({
    queryKey: ["inbox", orgId, sources.join("|")],
    queryFn: async () => {
      const all = await Promise.all(sources.map((s) => listFn({ data: { orgId, source: s } })));
      return all.flat() as InboxItem[];
    },
    refetchInterval: 5000,
  });

  const progressQ = useQuery({
    queryKey: ["scan-progress", orgId],
    queryFn: () => progressFn({ data: { orgId } }),
    refetchInterval: 3000,
  });

  const jobsQ = useQuery({
    queryKey: ["scan-jobs", orgId],
    queryFn: () => jobsFn({ data: { orgId } }),
    refetchInterval: 3000,
  });

  const kwQ = useQuery({ queryKey: ["org-keywords", orgId], queryFn: () => kwFn({ data: { orgId } }) });
  const compQ = useQuery({ queryKey: ["org-competitors", orgId], queryFn: () => compFn({ data: { orgId } }) });
  const adminFn = useServerFn(getIsAdmin);
  const adminQ = useQuery({ queryKey: ["is-admin"], queryFn: () => adminFn() });
  const isAdmin = !!adminQ.data?.isAdmin;

  // Resilient scan pump
  const running = useRef(false);
  useEffect(() => {
    let cancelled = false;
    async function pump() {
      if (running.current) return;
      running.current = true;
      try {
        let consecutiveEmpty = 0;
        while (!cancelled) {
          let r: Awaited<ReturnType<typeof runFn>> | null = null;
          try {
            r = await runFn({ data: { orgId } });
          } catch (e) {
            console.error("[pump] transport error, retrying", e);
            await new Promise((res) => setTimeout(res, 1500));
            continue;
          }
          void qc.invalidateQueries({ queryKey: ["inbox", orgId] });
          void qc.invalidateQueries({ queryKey: ["scan-progress", orgId] });
          void qc.invalidateQueries({ queryKey: ["scan-jobs", orgId] });
          if (!r.ranJob) {
            consecutiveEmpty++;
            if (consecutiveEmpty >= 2) break;
            await new Promise((res) => setTimeout(res, 1000));
            continue;
          }
          consecutiveEmpty = 0;
          if (r.status === "error") {
            console.error(`[pump] ${r.jobType} · ${r.entityLabel}: ${r.error}`);
          } else if ((r.inserted ?? 0) > 0) {
            toast.success(`${r.inserted} new post${r.inserted === 1 ? "" : "s"} available`);
          }

          await new Promise((res) => setTimeout(res, 500));
        }
      } finally {
        running.current = false;
      }
    }
    void pump();
    return () => { cancelled = true; };
  }, [orgId, runFn, qc]);

  async function handleRetry(jobId: string) {
    await retryFn({ data: { jobId } });
    toast.message("Retry queued");
    void qc.invalidateQueries({ queryKey: ["scan-jobs", orgId] });
    if (!running.current) {
      void runFn({ data: { orgId } }).then(() => {
        void qc.invalidateQueries({ queryKey: ["inbox", orgId] });
      });
    }
  }

  const items = itemsQ.data ?? [];

  // Apply ALL filters
  const filtered = useMemo(() => {
    let out = items;
    if (competitorsOnly) out = out.filter((i) => !!i.competitor_id);

    if (filter === "new") out = out.filter((i) => !i.status || i.status === "new");
    else if (filter !== "all") out = out.filter((i) => i.status === filter);

    if (scoreMin === -50) out = out.filter((i) => (i.relevance_score ?? 0) < 50);
    else if (scoreMin > 0) out = out.filter((i) => (i.relevance_score ?? 0) >= scoreMin);
    if (positionMax > 0) out = out.filter((i) => i.google_position != null && i.google_position <= positionMax);
    if (subredditQ.trim()) {
      const q = subredditQ.trim().toLowerCase();
      out = out.filter((i) => (i.subreddit ?? "").toLowerCase().includes(q));
    }
    if (competitorIds.length) out = out.filter((i) => i.competitor_id && competitorIds.includes(i.competitor_id));
    if (keywordIds.length) out = out.filter((i) => i.keyword_id && keywordIds.includes(i.keyword_id));

    const sorted = [...out];
    if (sortBy === "newest") {
      sorted.sort((a, b) => (new Date(b.reddit_created_at ?? 0).getTime()) - (new Date(a.reddit_created_at ?? 0).getTime()));
    } else if (sortBy === "score") {
      sorted.sort((a, b) => (b.relevance_score ?? -1) - (a.relevance_score ?? -1));
    } else if (sortBy === "upvotes") {
      sorted.sort((a, b) => (b.upvotes ?? 0) - (a.upvotes ?? 0));
    } else if (sortBy === "google") {
      sorted.sort((a, b) => (a.google_position ?? 999) - (b.google_position ?? 999));
    }
    return sorted;
  }, [items, filter, scoreMin, positionMax, subredditQ, competitorIds, keywordIds, sortBy, competitorsOnly]);

  const counts: Record<Filter, number> = useMemo(() => {
    const base = competitorsOnly ? items.filter((i) => !!i.competitor_id) : items;
    return {
      new: base.filter((i) => !i.status || i.status === "new").length,
      saved: base.filter((i) => i.status === "saved").length,
      replied: base.filter((i) => i.status === "replied").length,
      archived: base.filter((i) => i.status === "archived").length,
      all: base.length,
    };
  }, [items, competitorsOnly]);

  const selected = filtered.find((i) => i.id === selectedId) ?? items.find((i) => i.id === selectedId) ?? null;

  // Desktop split: auto-select first item
  const isDesktop = typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  useEffect(() => {
    if (isDesktop && !selectedId && filtered.length > 0) {
      setSelectedId(filtered[0].id);
    }
  }, [isDesktop, filtered, selectedId]);

  const scanning = (progressQ.data?.due ?? 0) > 0;
  const relevantJobs = (jobsQ.data ?? []).filter((j) => jobTypes.includes(j.job_type));
  const failedJobs = relevantJobs.filter((j) => j.error_message);

  function openItem(id: string) {
    setSelectedId(id);
    if (!isDesktop) setDrawerOpen(true);
  }

  const filtersActive =
    scoreMin !== 0 ||
    positionMax > 0 ||
    subredditQ.trim().length > 0 ||
    competitorIds.length > 0 ||
    keywordIds.length > 0 ||
    sortBy !== (isSeo ? "google" : "score");

  const header = (
    <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
      <div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">{eyebrow}</p>
        <h1 className="mt-0.5 text-xl font-bold">{title}</h1>
      </div>
      {scanning && isAdmin && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground border border-border px-3 py-1.5 rounded-full">
          <Spinner size={12} />
          Scanning {progressQ.data?.due} job{progressQ.data?.due === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );

  function toggleId(list: string[], id: string, setter: (v: string[]) => void) {
    setter(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  const allChecked = filtered.length > 0 && filtered.every((i) => checkedIds.has(i.id));
  const someChecked = checkedIds.size > 0 && !allChecked;

  const filterBar = (
    <div className="px-6 flex items-center gap-1 border-b border-border flex-wrap">
      {selectMode && (
        <div className="flex items-center pr-2 mr-1 border-r border-border h-9" title="Select all in view">
          <Checkbox
            className="h-[18px] w-[18px] rounded border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
            checked={allChecked ? true : someChecked ? "indeterminate" : false}
            onCheckedChange={(v) => {
              if (v) {
                setCheckedIds(new Set(filtered.map((i) => i.id)));
              } else {
                setCheckedIds(new Set());
              }
            }}
          />
        </div>
      )}
      {(["new", "saved", "replied", "archived", "all"] as Filter[]).map((f) => (
        <button
          key={f}
          onClick={() => setFilter(f)}
          className={`relative px-3 py-2 text-sm capitalize transition-colors ${
            filter === f ? "text-foreground font-semibold" : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {f}{" "}
          <span className={`ml-0.5 inline-flex items-center justify-center min-w-5 px-1.5 h-5 text-[10px] rounded-full font-medium ${
            filter === f ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
          }`}>
            {counts[f]}
          </span>
          {filter === f && <span className="absolute inset-x-3 -bottom-px h-0.5 bg-primary rounded-full" />}
        </button>
      ))}

      <div className="mx-2 h-5 w-px bg-border" />

      <Popover>
        <PopoverTrigger asChild>
          <button className="relative inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">
            <FilterIcon className="h-3.5 w-3.5" /> Filters
            {filtersActive && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full" />}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 space-y-3">
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Minimum Score</label>
            <select value={scoreMin} onChange={(e) => setScoreMin(Number(e.target.value) as ScoreMin)} className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background">
              <option value={0}>All scores</option>
              <option value={-50}>{"< 50 (Low)"}</option>
              <option value={50}>50+ (Medium)</option>
              <option value={70}>70+ (High)</option>
              <option value={90}>90+ (Excellent)</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Sort By</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background">
              <option value="newest">Newest first</option>
              <option value="score">Highest score</option>
              <option value="upvotes">Most upvotes</option>
              {isSeo && <option value="google">Google rank</option>}
            </select>
          </div>
          {isSeo && (
            <div>
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Google Position</label>
              <select value={positionMax} onChange={(e) => setPositionMax(Number(e.target.value) as PositionMax)} className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background">
                <option value={0}>Any position</option>
                <option value={3}>Top 3</option>
                <option value={10}>Top 10</option>
                <option value={50}>Top 50</option>
              </select>
            </div>
          )}
          <div>
            <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subreddit</label>
            <input
              value={subredditQ}
              onChange={(e) => setSubredditQ(e.target.value)}
              placeholder="e.g. cordcutters"
              className="mt-1 w-full text-sm border border-border rounded px-2 py-1.5 bg-background"
            />
          </div>
          {filtersActive && (
            <button
              onClick={() => {
                setScoreMin(0); setPositionMax(0); setSubredditQ("");
                setCompetitorIds([]); setKeywordIds([]);
                setSortBy(isSeo ? "google" : "score");
              }}
              className="w-full text-xs text-muted-foreground hover:text-foreground py-1"
            >
              Clear filters
            </button>
          )}
        </PopoverContent>
      </Popover>

      <button
        type="button"
        onClick={() => {
          if (selectMode) {
            setCheckedIds(new Set());
          }
          setSelectMode((cur) => !cur);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted"
      >
        {selectMode ? <X className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />} {selectMode ? "Cancel" : "Select"}
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">
            <Tag className="h-3.5 w-3.5" /> Keywords
            {keywordIds.length > 0 && (
              <span className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground font-semibold">{keywordIds.length}</span>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 max-h-72 overflow-auto">
          {(kwQ.data ?? []).length === 0 ? (
            <p className="text-xs text-muted-foreground">No keywords yet.</p>
          ) : (
            <ul className="space-y-0.5">
              {(kwQ.data ?? []).map((k) => (
                <li key={k.id}>
                  <label className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted cursor-pointer">
                    <Checkbox className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={keywordIds.includes(k.id)} onCheckedChange={() => toggleId(keywordIds, k.id, setKeywordIds)} />
                    <span className="truncate">{k.keyword}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>

      {showCompetitorFilter && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M7 7l10 10M17 7L7 17"/></svg>
              Competitors
              {competitorIds.length > 0 && (
                <span className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground font-semibold">{competitorIds.length}</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-64 max-h-72 overflow-auto">
            {(compQ.data ?? []).length === 0 ? (
              <p className="text-xs text-muted-foreground">No competitors yet.</p>
            ) : (
              <ul className="space-y-0.5">
                {(compQ.data ?? []).map((c) => (
                  <li key={c.id}>
                    <label className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted cursor-pointer">
                      <Checkbox className="h-4 w-4 data-[state=checked]:bg-primary data-[state=checked]:border-primary" checked={competitorIds.includes(c.id)} onCheckedChange={() => toggleId(competitorIds, c.id, setCompetitorIds)} />
                      <span className="truncate" title={c.name}>{c.name}</span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
          </PopoverContent>
        </Popover>
      )}


      <div className="ml-auto text-xs text-muted-foreground py-2">{filtered.length} result{filtered.length === 1 ? "" : "s"}</div>
    </div>
  );

  async function retryAllFailedJobs() {
    try {
      await Promise.all(failedJobs.map((job) => retryFn({ data: { jobId: job.id } })));
      toast.success("Retry queued");
      void qc.invalidateQueries({ queryKey: ["scan-jobs", orgId] });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Retry failed";
      toast.error(message);
    }
  }

  const failedBanner = failedJobs.length > 0 && (
    <div className="mx-6 mt-3 border border-destructive/40 bg-destructive/5 rounded">
      <div className="px-3 py-2 flex items-center justify-between gap-3">
        <div className="text-xs font-bold uppercase tracking-wider text-destructive flex items-center gap-2">
          <AlertCircle className="h-3 w-3" /> {failedJobs.length} scan{failedJobs.length === 1 ? "" : "s"} failed
        </div>
        <button
          onClick={retryAllFailedJobs}
          className="inline-flex items-center gap-1 border border-border px-2 py-0.5 rounded hover:bg-muted text-xs"
        >
          <RotateCw className="h-3 w-3" /> Retry
        </button>
      </div>
      {isAdmin && (
        <div className="divide-y divide-destructive/20 max-h-32 overflow-auto">
          {failedJobs.map((j) => (
            <div key={j.id} className="px-3 py-1.5 flex items-center gap-2 text-xs">
              <span className="font-mono text-muted-foreground w-36 truncate shrink-0">{j.job_type}</span>
              <span className="font-medium truncate flex-1">{j.entity_label}</span>
              <span className="text-destructive truncate max-w-[16rem]" title={j.error_message ?? ""}>{j.error_message}</span>
              <button
                onClick={() => handleRetry(j.id)}
                className="inline-flex items-center gap-1 border border-border px-2 py-0.5 rounded hover:bg-muted shrink-0"
              >
                <RotateCw className="h-3 w-3" /> Retry
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const listView = (
    <div className="overflow-auto">
      {itemsQ.isLoading || (filtered.length === 0 && scanning) ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-border p-4 rounded space-y-2">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-1/3" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="m-6 border border-dashed border-border p-10 rounded text-center text-sm text-muted-foreground">
          No posts in this view. Scans run continuously.
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((it) => {
            const checked = checkedIds.has(it.id);
            const saveIsUnsave = it.status === "saved";
            const repliedIsReset = it.status === "replied";
            const archiveIsUnarchive = it.status === "archived";
            return (
              <li key={it.id} className="group relative">
                <div
                  className={`w-full text-left pl-2 pr-3 py-4 hover:bg-muted/40 transition-colors flex items-start gap-2 ${
                    selected?.id === it.id ? "bg-primary/5" : ""
                  }`}
                >
                  {selectMode && (
                    <div className="pt-1 pl-1" onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        className="h-[18px] w-[18px] rounded border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                        checked={checked}
                        onCheckedChange={(v) => {
                          const next = new Set(checkedIds);
                          if (v) next.add(it.id); else next.delete(it.id);
                          setCheckedIds(next);
                        }}
                      />
                    </div>
                  )}
                  <button onClick={() => openItem(it.id)} className="flex-1 text-left min-w-0">
                    <div className="flex items-start gap-3">
                      {it.relevance_score != null && (
                        <div className="shrink-0 text-right w-10">
                          <div className={`text-base font-bold leading-none ${
                            it.relevance_score >= 70 ? "text-primary" :
                            it.relevance_score >= 40 ? "text-amber-600" : "text-muted-foreground"
                          }`}>{it.relevance_score}</div>
                          <div className="text-[9px] uppercase tracking-wider mt-0.5 text-muted-foreground">
                            {it.relevance_score >= 70 ? "HIGH" : it.relevance_score >= 40 ? "MED" : "LOW"}
                          </div>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                          {it.subreddit && <span className="font-medium text-foreground">r/{it.subreddit}</span>}
                          {it.google_position != null && (
                            <span className="bg-primary/10 text-primary px-1.5 py-0.5 rounded font-medium">#{it.google_position}</span>
                          )}
                          {it.serp_keyword && <span className="truncate max-w-[12rem]">· {it.serp_keyword}</span>}
                          {it.status === "saved" && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                              <Bookmark className="h-2.5 w-2.5 fill-current" /> Saved
                            </span>
                          )}
                          {it.status === "replied" && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                              <CheckCheck className="h-2.5 w-2.5" /> Replied
                            </span>
                          )}
                          {it.status === "archived" && (
                            <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-semibold uppercase">
                              <Archive className="h-2.5 w-2.5" /> Archived
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 font-medium text-sm leading-snug truncate" title={it.title}>{it.title}</h3>
                        <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                          {it.upvotes != null && (
                            <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /> {it.upvotes}</span>
                          )}
                          {it.num_comments != null && (
                            <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {it.num_comments}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                  {!selectMode && (
                    <div
                      className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border rounded-full shadow-sm px-1 py-0.5"
                    >
                      <button
                        title={saveIsUnsave ? "Unsave" : "Save"}
                        onClick={(e) => { e.stopPropagation(); rowAction(it.id, saveIsUnsave ? "unsave" : "save"); }}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-primary"
                      >
                        {saveIsUnsave ? <BookmarkX className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        title={repliedIsReset ? "Mark new" : "Mark replied"}
                        onClick={(e) => { e.stopPropagation(); rowAction(it.id, repliedIsReset ? "reset" : "replied"); }}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-primary"
                      >
                        {repliedIsReset ? <RotateCcw className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />}
                      </button>
                      <button
                        title={archiveIsUnarchive ? "Unarchive" : "Archive"}
                        onClick={(e) => { e.stopPropagation(); rowAction(it.id, archiveIsUnarchive ? "unarchive" : "archive"); }}
                        className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-destructive"
                      >
                        {archiveIsUnarchive ? <ArchiveRestore className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  // Suppress unused-layout-prop warning (kept for backwards-compat with routes)
  void layout;

  return (
    <div className="h-screen flex flex-col">
      {header}
      {filterBar}
      {failedBanner}
      <div className="flex-1 min-h-0 border-t border-border flex lg:hidden">
        <div className="flex-1 overflow-auto">{listView}</div>
      </div>
      <div className="flex-1 min-h-0 border-t border-border hidden lg:block">
        <ResizablePanelGroup {...({ direction: "horizontal", autoSaveId: "inbox-split" } as React.ComponentProps<typeof ResizablePanelGroup>)}>
          <ResizablePanel defaultSize={36} minSize={28}>
            <div className="h-full overflow-auto">{listView}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={64} minSize={40}>
            <div className="h-full overflow-hidden">
              {selected ? (
                <PostDetailPanel item={selected} orgId={orgId} />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
                  Select a post to view details
                </div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col lg:hidden">
          {selected && <PostDetailPanel item={selected} orgId={orgId} onClose={() => setDrawerOpen(false)} />}
        </SheetContent>
      </Sheet>
      <BulkActionBar
        count={checkedIds.size}
        pending={bulkM.isPending}
        filter={filter}
        onClear={() => setCheckedIds(new Set())}
        onAction={(a) => bulkM.mutate({ ids: Array.from(checkedIds), action: a })}
      />
    </div>
  );
}
// layout prop kept for backwards-compat
void 0 as unknown as typeof InboxPage;

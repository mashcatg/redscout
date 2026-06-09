import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp, MessageCircle, ExternalLink, Pencil, X, Filter as FilterIcon,
  Sparkles, Bookmark, CheckCheck, EyeOff, Copy, RefreshCw, Check, ChevronDown,
} from "lucide-react";
import {
  listWarmupFeed, generateWarmupPost, generateWarmupComment, markWarmupEngagement, type WarmupFeedItem,
} from "@/lib/warmup.functions";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Spinner } from "@/components/ui/spinner";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useServerFn as useServerFnRaw } from "@tanstack/react-start";
import { listPersonalities } from "@/lib/settings.functions";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/warmup")({
  component: WarmupPage,
});

type SortBy = "newest" | "ups" | "comments";
type Filter = "new" | "engaged" | "saved" | "hidden" | "all";

function WarmupPage() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const feedFn = useServerFn(listWarmupFeed);
  const personasFn = useServerFnRaw(listPersonalities);
  const markFn = useServerFn(markWarmupEngagement);
  const q = useQuery({
    queryKey: ["warmup-feed", orgId],
    queryFn: () => feedFn({ data: { orgId } }),
    enabled: !!orgId,
    refetchInterval: 30000,
  });
  const personasQ = useQuery({ queryKey: ["personalities", orgId], queryFn: () => personasFn({ data: { orgId } }) });

  const [subIds, setSubIds] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<SortBy>("newest");
  const [filter, setFilter] = useState<Filter>("new");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const subs = q.data?.subreddits ?? [];
  const items = q.data?.items ?? [];

  const counts = useMemo(() => ({
    new: items.filter((i) => i.status === "new").length,
    engaged: items.filter((i) => i.status === "engaged").length,
    saved: items.filter((i) => i.status === "saved").length,
    hidden: items.filter((i) => i.status === "hidden").length,
    all: items.length,
  }), [items]);

  const filtered = useMemo(() => {
    let out = items;
    if (filter !== "all") out = out.filter((i) => i.status === filter);
    if (subIds.length) out = out.filter((i) => subIds.includes(i.subreddit_id));
    out = [...out];
    if (sortBy === "ups") out.sort((a, b) => b.ups - a.ups);
    else if (sortBy === "comments") out.sort((a, b) => b.num_comments - a.num_comments);
    return out;
  }, [items, filter, subIds, sortBy]);

  const selected = filtered.find((i) => i.key === selectedKey) ?? items.find((i) => i.key === selectedKey) ?? null;

  function bodyPreview(text: string) {
    return text.trim().replace(/\s+/g, " ");
  }

  const isDesktop = typeof window !== "undefined" ? window.innerWidth >= 1024 : true;
  useEffect(() => {
    if (isDesktop && !selectedKey && filtered.length > 0) setSelectedKey(filtered[0].key);
  }, [isDesktop, filtered, selectedKey]);

  const markM = useMutation({
    mutationFn: (p: { item: WarmupFeedItem; status: "new" | "engaged" | "saved" | "hidden" }) =>
      markFn({ data: { orgId, subredditId: p.item.subreddit_id, postId: p.item.post_id, status: p.status } }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["warmup-feed", orgId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  function toggleSub(id: string) {
    setSubIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  }

  function toggleChecked(id: string) {
    setCheckedIds((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function openItem(key: string) {
    setSelectedKey(key);
    if (!isDesktop) setDrawerOpen(true);
  }

  const allChecked = filtered.length > 0 && filtered.every((i) => checkedIds.has(i.key));
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
                setCheckedIds(new Set(filtered.map((i) => i.key)));
              } else {
                setCheckedIds(new Set());
              }
            }}
          />
        </div>
      )}
      {(["new", "engaged", "saved", "hidden", "all"] as Filter[]).map((f) => (
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
          <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted">
            <FilterIcon className="h-3.5 w-3.5" /> Subreddits
            {subIds.length > 0 && <span className="ml-1 inline-flex items-center justify-center min-w-4 h-4 px-1 text-[10px] rounded-full bg-primary text-primary-foreground font-semibold">{subIds.length}</span>}
          </button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-64 max-h-72 overflow-auto">
          {subs.length === 0 ? (
            <p className="text-xs text-muted-foreground">No subreddits available yet — check back soon.</p>
          ) : (
            <ul className="space-y-0.5">
              {subs.map((s) => (
                <li key={s.id}>
                  <label className="flex items-center gap-2 px-2 py-1 text-sm rounded hover:bg-muted cursor-pointer">
                    <input type="checkbox" checked={subIds.includes(s.id)} onChange={() => toggleSub(s.id)} />
                    <span className="font-mono">r/{s.name}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </PopoverContent>
      </Popover>
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)} className="h-8 text-sm border border-border rounded px-2 bg-background">
        <option value="newest">Newest</option>
        <option value="ups">Most upvotes</option>
        <option value="comments">Most comments</option>
      </select>
      <button
        type="button"
        onClick={() => {
          if (selectMode) setCheckedIds(new Set());
          setSelectMode((cur) => !cur);
        }}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded hover:bg-muted"
      >
        {selectMode ? <X className="h-3.5 w-3.5" /> : <CheckCheck className="h-3.5 w-3.5" />} {selectMode ? "Cancel" : "Select"}
      </button>
      <div className="ml-auto text-xs text-muted-foreground py-2">{filtered.length} post{filtered.length === 1 ? "" : "s"}</div>
    </div>
  );

  const listView = (
    <div className="overflow-auto">
      {q.isLoading ? (
        <div className="p-6 space-y-3">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20" />)}</div>
      ) : filtered.length === 0 ? (
        <div className="m-6 border border-dashed border-border p-10 rounded text-center text-sm text-muted-foreground">
          {items.length === 0 ? "No warmup posts yet — check back soon." : "No posts in this view."}
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map((p) => (
            <li key={p.key} className="group relative">
              <div
                className={`w-full text-left pl-2 pr-3 py-4 hover:bg-muted/40 transition-colors flex items-start gap-2 ${
                  selected?.key === p.key ? "bg-primary/5" : ""
                }`}
              >
                {selectMode && (
                  <div className="pt-1 pl-1" onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      className="h-[18px] w-[18px] rounded border-muted-foreground/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                      checked={checkedIds.has(p.key)}
                      onCheckedChange={() => toggleChecked(p.key)}
                    />
                  </div>
                )}
                <button onClick={() => openItem(p.key)} className="flex-1 text-left min-w-0">
                  <div className="flex items-start gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-medium text-foreground">r/{p.subreddit}</span>
                        {p.author && <span>· u/{p.author}</span>}
                        {p.status === "saved" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                            <Bookmark className="h-2.5 w-2.5 fill-current" /> Saved
                          </span>
                        )}
                        {p.status === "engaged" && (
                          <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px] font-semibold uppercase">
                            <CheckCheck className="h-2.5 w-2.5" /> Engaged
                          </span>
                        )}
                      </div>
                      <h3 className="mt-1 font-medium text-sm leading-snug truncate" title={p.title}>{p.title}</h3>
                      {p.selftext.trim() && (
                        <p className="mt-1 text-sm text-muted-foreground leading-snug line-clamp-2" title={p.selftext}>
                          {bodyPreview(p.selftext)}
                        </p>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><ArrowUp className="h-3 w-3" /> {p.ups}</span>
                        <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" /> {p.num_comments}</span>
                      </div>
                    </div>
                  </div>
                </button>
                {!selectMode && (
                  <div
                    className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 bg-card/95 backdrop-blur-sm border border-border rounded-full shadow-sm px-1 py-0.5"
                  >
                    <button
                      title={p.status === "saved" ? "Unsave" : "Save"}
                      onClick={(e) => { e.stopPropagation(); markM.mutate({ item: p, status: p.status === "saved" ? "new" : "saved" }); }}
                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-primary"
                    >
                      <Bookmark className={`h-3.5 w-3.5 ${p.status === "saved" ? "fill-current text-primary" : ""}`} />
                    </button>
                    <button
                      title="Mark engaged (counts as replied)"
                      onClick={(e) => { e.stopPropagation(); markM.mutate({ item: p, status: p.status === "engaged" ? "new" : "engaged" }); }}
                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-primary"
                    >
                      <CheckCheck className="h-3.5 w-3.5" />
                    </button>
                    <button
                      title="Hide"
                      onClick={(e) => { e.stopPropagation(); markM.mutate({ item: p, status: "hidden" }); }}
                      className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-destructive"
                    >
                      <EyeOff className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  return (
    <div className="h-screen flex flex-col">
      <div className="px-6 pt-6 pb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Warmup</p>
          <h1 className="mt-0.5 text-xl font-bold">Karma-building posts</h1>
        </div>
        <ComposeSheet subreddits={subs} />
      </div>
      {filterBar}
      <div className="flex-1 min-h-0 border-t border-border flex lg:hidden">
        <div className="flex-1 overflow-auto">{listView}</div>
      </div>
      <div className="flex-1 min-h-0 border-t border-border hidden lg:block">
        <ResizablePanelGroup {...({ direction: "horizontal", autoSaveId: "warmup-split" } as React.ComponentProps<typeof ResizablePanelGroup>)}>
          <ResizablePanel defaultSize={40} minSize={28}>
            <div className="h-full overflow-auto">{listView}</div>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={60} minSize={40}>
            <div className="h-full overflow-hidden">
              {selected ? (
                <WarmupDetail
                  item={selected}
                  orgId={orgId}
                  personalities={personasQ.data ?? []}
                  pending={markM.isPending}
                  onMark={(status) => markM.mutate({ item: selected, status })}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-sm text-muted-foreground">Select a post to view details</div>
              )}
            </div>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl p-0 flex flex-col lg:hidden">
          {selected && (
            <WarmupDetail
              item={selected}
              orgId={orgId}
              personalities={personasQ.data ?? []}
              pending={markM.isPending}
              onMark={(status) => markM.mutate({ item: selected, status })}
              onClose={() => setDrawerOpen(false)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

function WarmupDetail({
  item, orgId, personalities, pending, onMark, onClose,
}: {
  item: WarmupFeedItem;
  orgId: string;
  personalities: Array<{ id: string; slug: string; label: string; description: string | null; instructions: string }>;
  pending: boolean;
  onMark: (status: "new" | "engaged" | "saved" | "hidden") => void;
  onClose?: () => void;
}) {
  const genFn = useServerFnRaw(generateWarmupComment);
  const url = item.permalink
    ? `https://reddit.com${item.permalink.startsWith("/") ? "" : "/"}${item.permalink}`
    : (item.url || "#");
  const isSaved = item.status === "saved";
  const isEngaged = item.status === "engaged";
  const draftKey = `warmup-comment-draft:${item.key}`;
  const [comment, setComment] = useState(() => {
    if (typeof window === "undefined") return "";
    return localStorage.getItem(draftKey) ?? "";
  });
  const [copied, setCopied] = useState(false);
  const [lastTone, setLastTone] = useState<string>("helpful");
  const [draftSaved, setDraftSaved] = useState(false);

  const BUILTIN_TONES: Array<{ value: string; label: string; desc: string }> = [
    { value: "helpful", label: "Helpful", desc: "Genuine advice" },
    { value: "personal", label: "Personal", desc: "Share your story" },
    { value: "curious", label: "Curious", desc: "Ask questions" },
    { value: "direct", label: "Direct", desc: "Recommend directly" },
    { value: "friendly", label: "Friendly + helpful", desc: "Warm and useful" },
  ];

  useEffect(() => {
    if (typeof window === "undefined") return;
    const saved = localStorage.getItem(draftKey);
    if (saved !== null) setComment(saved);
  }, [draftKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      if (comment.trim().length === 0) {
        localStorage.removeItem(draftKey);
        setDraftSaved(false);
      } else {
        localStorage.setItem(draftKey, comment);
        setDraftSaved(true);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [comment, draftKey]);

  async function generateComment(tone: string) {
    setLastTone(tone);
    try {
      const result = await genFn({ data: { subredditId: item.subreddit_id, title: item.title, body: item.selftext, tone } });
      setComment(result.comment);
      toast.success("Comment generated");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Generation failed");
    }
  }

  async function copyComment() {
    const text = comment.trim();
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Comment copied");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Copy failed");
    }
  }

  async function openAndMark() {
    const text = comment.trim();
    if (text) {
      try {
        await navigator.clipboard.writeText(text);
        toast.success("Comment copied — paste on Reddit");
      } catch {
        toast.message("Open Reddit and paste your comment");
      }
    }
    window.open(url, "_blank", "noreferrer");
    if (text && !isEngaged) onMark("engaged");
  }

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0 flex-1">
            <span className="font-medium text-foreground">r/{item.subreddit}</span>
            {item.author && <span>· u/{item.author}</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              disabled={pending}
              onClick={() => onMark(isSaved ? "new" : "saved")}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded transition-colors ${
                isSaved ? "bg-primary/10 text-primary border-primary/30" : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`} />
              <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
            </button>
            <button
              disabled={pending}
              onClick={() => onMark(isEngaged ? "new" : "engaged")}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                isEngaged ? "bg-primary/15 text-primary border border-primary/40" : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isEngaged ? "Engaged" : "Mark engaged"}</span>
            </button>
            {onClose && (
              <button onClick={onClose} className="lg:hidden text-muted-foreground hover:text-foreground p-1">
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
        <h2 className="mt-2 text-lg font-semibold leading-snug">{item.title}</h2>
        <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted"><ArrowUp className="h-3 w-3" /> {item.ups}</span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted"><MessageCircle className="h-3 w-3" /> {item.num_comments} comments</span>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {item.selftext ? (
          <div className="text-sm leading-relaxed text-foreground/90 bg-muted/30 p-4 rounded">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              components={{
                p: ({ children }) => <p className="my-2 first:mt-0 last:mb-0 whitespace-pre-wrap">{children}</p>,
                a: ({ href, children }) => (
                  <a href={href ?? "#"} target="_blank" rel="noreferrer noopener" className="text-primary underline break-all">
                    {children}
                  </a>
                ),
                strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                em: ({ children }) => <em className="italic">{children}</em>,
                ul: ({ children }) => <ul className="list-disc pl-5 my-2 space-y-0.5">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-2 space-y-0.5">{children}</ol>,
                li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                h1: ({ children }) => <h1 className="text-base font-bold mt-3 mb-2">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-bold mt-3 mb-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-sm font-semibold mt-2 mb-1">{children}</h3>,
                blockquote: ({ children }) => (
                  <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">{children}</blockquote>
                ),
                code: ({ children }) => <code className="px-1 py-0.5 bg-muted rounded text-xs font-mono">{children}</code>,
                hr: () => <hr className="my-3 border-border" />,
              }}
            >
              {item.selftext.replace(/\\\*/g, "*").replace(/\\_/g, "_").replace(/\\~/g, "~").replace(/\\>/g, ">")}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No post body — title-only post.</p>
        )}
      </div>
      <div className="border-t border-border p-4 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="font-medium">Write a comment</span>
          {draftSaved && <span className="text-muted-foreground">Draft saved</span>}
        </div>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Generate a comment or write your own..."
          className="w-full min-h-[110px] text-sm p-3 border border-border rounded bg-background resize-y focus:outline-none focus:ring-1 focus:ring-ring"
        />
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <button
              onClick={() => generateComment(lastTone)}
              disabled={!comment.trim() || pending}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded hover:bg-muted disabled:opacity-50"
              title="Regenerate"
            >
              {pending ? <Spinner size={14} /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={copyComment}
              disabled={!comment.trim()}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded hover:bg-muted disabled:opacity-50"
              title="Copy"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-primary" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="inline-flex items-center gap-1 text-xs px-3 py-1.5 border border-border rounded hover:bg-muted disabled:opacity-50"
                  disabled={pending}
                >
                  {pending ? <Spinner size={14} /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 max-h-80 overflow-auto">
                <DropdownMenuLabel className="text-xs">Built-in tones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {BUILTIN_TONES.map((t) => (
                  <DropdownMenuItem key={t.value} onClick={() => { void generateComment(t.value); }} className="flex flex-col items-start gap-0">
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.desc}</span>
                  </DropdownMenuItem>
                ))}
                {personalities.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Your personalities</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {personalities.map((p) => (
                      <DropdownMenuItem key={p.id} onClick={() => { void generateComment(p.slug); }} className="flex flex-col items-start gap-0">
                        <span className="text-sm font-medium">{p.label}</span>
                        {p.description && <span className="text-xs text-muted-foreground">{p.description}</span>}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={openAndMark}
              className="inline-flex items-center gap-1 text-xs px-3 py-1.5 bg-primary text-primary-foreground rounded hover:bg-primary/90 font-medium"
            >
              Open Reddit <ExternalLink className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ComposeSheet({ subreddits }: { subreddits: Array<{ id: string; name: string }> }) {
  const genFn = useServerFn(generateWarmupPost);
  const [open, setOpen] = useState(false);
  const [subId, setSubId] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");

  const genM = useMutation({
    mutationFn: (id: string) => genFn({ data: { subredditId: id } }),
    onSuccess: (data) => { setTitle(data.title); setBody(data.body); toast.success("Draft generated"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const chosen = subreddits.find((s) => s.id === subId);
  const submitUrl = chosen
    ? `https://www.reddit.com/r/${chosen.name}/submit?title=${encodeURIComponent(title)}&text=${encodeURIComponent(body)}`
    : "#";

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button size="sm" className="gap-1.5"><Pencil className="h-3.5 w-3.5" /> Compose</Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Generate a karma post</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Subreddit</label>
            <select value={subId} onChange={(e) => setSubId(e.target.value)} className="w-full border border-border bg-background px-3 py-2 text-sm rounded">
              <option value="">— Pick a subreddit —</option>
              {subreddits.map((s) => <option key={s.id} value={s.id}>r/{s.name}</option>)}
            </select>
          </div>
          <Button onClick={() => subId && genM.mutate(subId)} disabled={!subId || genM.isPending} className="w-full gap-2">
            {genM.isPending ? <Spinner size={14} /> : <Sparkles className="h-3.5 w-3.5" />}
            {genM.isPending ? "Generating…" : "Generate with AI (follows rules)"}
          </Button>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Title</label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wide text-muted-foreground mb-1 block">Body</label>
            <Textarea rows={10} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <a
            href={submitUrl}
            target="_blank"
            rel="noreferrer"
            className={`w-full inline-flex items-center justify-center gap-2 rounded bg-primary text-primary-foreground px-4 py-2.5 text-sm font-semibold ${!chosen || !title ? "pointer-events-none opacity-50" : "hover:opacity-90"}`}
          >
            <ExternalLink className="h-4 w-4" /> Open Reddit to submit
          </a>
        </div>
      </SheetContent>
    </Sheet>
  );
}

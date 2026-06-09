import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  ArrowUp, MessageCircle, ExternalLink, Copy, Check, Bookmark,
  Sparkles, ChevronDown, RefreshCw, CheckCheck, X, Archive,
} from "lucide-react";
import { generateComment, markInboxItem } from "@/lib/comment.functions";
import { listPersonalities } from "@/lib/settings.functions";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";


export type DetailItem = {
  id: string;
  title: string;
  body: string | null;
  reddit_url: string;
  subreddit: string | null;
  author: string | null;
  upvotes: number | null;
  num_comments: number | null;
  google_position: number | null;
  serp_keyword: string | null;
  relevance_score: number | null;
  reddit_created_at: string | null;
  generated_comment: string | null;
  status: string | null;
  competitor_id?: string | null;
  keyword_id?: string | null;
  source?: string | null;
  org_id?: string;
};

const BUILTIN_TONES: Array<{ value: string; label: string; desc: string }> = [
  { value: "helpful", label: "Helpful", desc: "Genuine advice" },
  { value: "personal", label: "Personal", desc: "Share your story" },
  { value: "curious", label: "Curious", desc: "Ask questions" },
  { value: "direct", label: "Direct", desc: "Recommend directly" },
  { value: "friendly", label: "Friendly + helpful", desc: "Warm and useful" },
];

function timeAgo(iso: string | null) {
  if (!iso) return "";
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return "just now";
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
}

export function PostDetailPanel({ item, orgId, onClose }: { item: DetailItem; orgId: string; onClose?: () => void }) {
  const qc = useQueryClient();
  const genFn = useServerFn(generateComment);
  const markFn = useServerFn(markInboxItem);
  const personasFn = useServerFn(listPersonalities);

  const draftKey = `comment-draft:${item.id}`;
  const [comment, setComment] = useState(() => {
    if (typeof window === "undefined") return item.generated_comment ?? "";
    return localStorage.getItem(draftKey) ?? item.generated_comment ?? "";
  });
  const [copied, setCopied] = useState(false);
  const [lastTone, setLastTone] = useState<string>("helpful");
  const [draftSaved, setDraftSaved] = useState(false);

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(draftKey) : null;
    setComment(saved ?? item.generated_comment ?? "");
    setCopied(false);
  }, [item.id, item.generated_comment, draftKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const t = setTimeout(() => {
      if (comment.trim().length === 0) {
        localStorage.removeItem(draftKey);
        setDraftSaved(false);
      } else if (comment !== (item.generated_comment ?? "")) {
        localStorage.setItem(draftKey, comment);
        setDraftSaved(true);
      } else {
        setDraftSaved(false);
      }
    }, 500);
    return () => clearTimeout(t);
  }, [comment, draftKey, item.generated_comment]);

  const personasQ = useQuery({
    queryKey: ["personalities", orgId],
    queryFn: () => personasFn({ data: { orgId } }),
  });

  const genMut = useMutation({
    mutationFn: async (tone: string) => {
      setLastTone(tone);
      return genFn({ data: { postId: item.id, tone } });
    },
    onSuccess: (r) => {
      setComment(r.comment);
      void qc.invalidateQueries({ queryKey: ["inbox"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const markMut = useMutation({
    mutationFn: (action: "save" | "unsave" | "replied" | "dismiss" | "reset" | "archive" | "unarchive") =>
      markFn({ data: { postId: item.id, action } }),
    onSuccess: (_d, action) => {
      if (action === "replied" && typeof window !== "undefined") {
        localStorage.removeItem(draftKey);
        setDraftSaved(false);
      }
      qc.invalidateQueries({ queryKey: ["inbox"] });
    },
  });

  const score = item.relevance_score;
  const scoreColor =
    score == null ? "" :
    score >= 70 ? "text-primary" :
    score >= 40 ? "text-amber-600" :
    "text-muted-foreground";
  const scoreLabel = score == null ? "" : score >= 70 ? "HIGH" : score >= 40 ? "MED" : "LOW";

  async function copyComment(silent = false) {
    if (!comment) return;
    try {
      await navigator.clipboard.writeText(comment);
      setCopied(true);
      if (!silent) toast.success("Copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      if (!silent) toast.error("Copy failed");
    }
  }

  async function openRedditAndMark() {
    const hasComment = comment.trim().length > 0;
    if (hasComment) {
      try {
        await navigator.clipboard.writeText(comment);
        toast.success("Comment copied — paste in Reddit");
      } catch {
        toast.message("Open Reddit and paste your comment");
      }
    }
    window.open(item.reddit_url, "_blank", "noreferrer");
    // Only mark replied when the user actually has a comment to post.
    if (hasComment && !isReplied) markMut.mutate("replied");
  }

  const isSaved = item.status === "saved";
  const isReplied = item.status === "replied";
  const isArchived = item.status === "archived";
  const hasComment = comment.trim().length > 0;

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 text-xs text-muted-foreground min-w-0 flex-1">
            {item.subreddit && <span className="font-medium text-foreground">r/{item.subreddit}</span>}
            {item.author && <span>· u/{item.author}</span>}
            {item.reddit_created_at && <span>· {timeAgo(item.reddit_created_at)}</span>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => markMut.mutate(isArchived ? "unarchive" : "archive")}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded transition-colors ${
                isArchived
                  ? "bg-muted text-foreground border-border"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title={isArchived ? "Unarchive" : "Archive"}
            >
              <Archive className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isArchived ? "Unarchive" : "Archive"}</span>
            </button>
            <button
              onClick={() => markMut.mutate(isSaved ? "unsave" : "save")}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 border rounded transition-colors ${
                isSaved
                  ? "bg-primary/10 text-primary border-primary/30"
                  : "border-border hover:bg-muted text-muted-foreground hover:text-foreground"
              }`}
              title={isSaved ? "Unsave" : "Save"}
            >
              <Bookmark className={`h-3.5 w-3.5 ${isSaved ? "fill-current" : ""}`} />
              <span className="hidden sm:inline">{isSaved ? "Saved" : "Save"}</span>
            </button>
            <button
              onClick={() => markMut.mutate(isReplied ? "reset" : "replied")}
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded font-medium transition-colors ${
                isReplied
                  ? "bg-primary/15 text-primary border border-primary/40"
                  : "bg-primary text-primary-foreground hover:bg-primary/90"
              }`}
              title={isReplied ? "Unmark replied" : "Mark as replied"}
            >
              <CheckCheck className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isReplied ? "Replied" : "Mark replied"}</span>
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="lg:hidden text-muted-foreground hover:text-foreground p-1"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        <div className="mt-2 flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            {/* If the title is long, let the user scroll vertically */}
            <div className="max-h-20 overflow-y-auto pr-2">
              <h2 className="text-lg font-semibold leading-snug whitespace-pre-wrap">{item.title}</h2>
            </div>
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
              {item.upvotes != null && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted">
                  <ArrowUp className="h-3 w-3" /> {item.upvotes} upvotes
                </span>
              )}
              {item.num_comments != null && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-muted">
                  <MessageCircle className="h-3 w-3" /> {item.num_comments} comments
                </span>
              )}
              {item.google_position != null && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium">
                  Google #{item.google_position}
                </span>
              )}
              {item.serp_keyword && (
                <span className="px-1.5 py-0.5 rounded bg-muted">{item.serp_keyword}</span>
              )}
            </div>
          </div>
          {score != null && (
            <div className={`text-right shrink-0 ${scoreColor}`}>
              <div className="text-2xl font-bold leading-none">{score}</div>
              <div className="text-[10px] uppercase tracking-wider mt-0.5 text-muted-foreground">{scoreLabel}</div>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto p-4">
        {item.body ? (
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
              {item.body.replace(/\\\*/g, "*").replace(/\\_/g, "_").replace(/\\~/g, "~").replace(/\\>/g, ">")}
            </ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground italic">No post body — title-only post.</p>
        )}
      </div>



      {/* Composer */}
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
              onClick={() => genMut.mutate(lastTone)}
              disabled={!hasComment || genMut.isPending}
              className="inline-flex items-center gap-1 text-xs px-2 py-1.5 border border-border rounded hover:bg-muted disabled:opacity-50"
              title="Regenerate"
            >
              {genMut.isPending ? <Spinner size={14} /> : <RefreshCw className="h-3.5 w-3.5" />}
            </button>
            <button
              onClick={() => copyComment()}
              disabled={!hasComment}
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
                  disabled={genMut.isPending}
                >
                  {genMut.isPending ? <Spinner size={14} /> : <Sparkles className="h-3.5 w-3.5" />}
                  Generate
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60 max-h-80 overflow-auto">
                <DropdownMenuLabel className="text-xs">Built-in tones</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {BUILTIN_TONES.map((t) => (
                  <DropdownMenuItem
                    key={t.value}
                    onClick={() => genMut.mutate(t.value)}
                    className="flex flex-col items-start gap-0"
                  >
                    <span className="text-sm font-medium">{t.label}</span>
                    <span className="text-xs text-muted-foreground">{t.desc}</span>
                  </DropdownMenuItem>
                ))}
                {(personasQ.data ?? []).length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs">Your personalities</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    {(personasQ.data ?? []).map((p) => (
                      <DropdownMenuItem
                        key={p.id}
                        onClick={() => genMut.mutate(p.slug)}
                        className="flex flex-col items-start gap-0"
                      >
                        <span className="text-sm font-medium">{p.label}</span>
                        {p.description && (
                          <span className="text-xs text-muted-foreground">{p.description}</span>
                        )}
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              onClick={openRedditAndMark}
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

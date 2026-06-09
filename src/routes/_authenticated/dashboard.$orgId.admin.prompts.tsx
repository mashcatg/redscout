import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { listPrompts, upsertPrompt, resetPrompt } from "@/lib/admin.functions";
import { PROMPT_REGISTRY } from "@/lib/prompt-registry";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { RotateCcw, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/admin/prompts")({
  component: AdminPrompts,
});

type PromptRow = {
  key: string;
  label: string;
  description: string;
  variables: string[];
  defaultContent: string;
  content: string;
  isOverridden: boolean;
  updated_at: string | null;
};

function AdminPrompts() {
  const qc = useQueryClient();
  const listFn = useServerFn(listPrompts);
  const saveFn = useServerFn(upsertPrompt);
  const resetFn = useServerFn(resetPrompt);
  const q = useQuery({ queryKey: ["admin-prompts"], queryFn: () => listFn() });

  // Always-available fallback so the page never appears empty
  const fallback: PromptRow[] = useMemo(() => PROMPT_REGISTRY.map((p) => ({
    key: p.key, label: p.label, description: p.description, variables: p.variables,
    defaultContent: p.defaultContent, content: p.defaultContent, isOverridden: false, updated_at: null,
  })), []);

  const list = ((q.data as PromptRow[] | undefined) ?? fallback);

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  useEffect(() => {
    const next: Record<string, string> = {};
    for (const p of list) next[p.key] = p.content;
    setDrafts((cur) => {
      // only update if shape changed to avoid update loop
      const keys = Object.keys(next);
      const same = keys.length === Object.keys(cur).length && keys.every((k) => cur[k] === next[k]);
      return same ? cur : next;
    });
  }, [list]);

  const save = useMutation({
    mutationFn: (p: { key: string; label: string; content: string }) => saveFn({ data: p }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-prompts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const reset = useMutation({
    mutationFn: (key: string) => resetFn({ data: { key } }),
    onSuccess: () => { toast.success("Reset to default"); qc.invalidateQueries({ queryKey: ["admin-prompts"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (q.isLoading && !q.data) {
    return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40" />)}</div>;
  }

  const overridden = list.filter((p) => p.isOverridden).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-sm text-muted-foreground">
          Every AI prompt in the app is listed here. Edit and save to override the built-in default. Reset removes the override and uses the code default again.
        </p>
        <span className="text-xs text-muted-foreground border border-border rounded-full px-2 py-0.5">
          {overridden} / {list.length} overridden
        </span>
      </div>
      {q.error && (
        <div className="flex items-start gap-2 border border-destructive/40 bg-destructive/5 rounded p-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-semibold mb-0.5">Failed to load saved overrides — showing code defaults.</div>
            <div className="opacity-80">{(q.error as Error).message}</div>
          </div>
        </div>
      )}
      {list.map((p) => {
        const draft = drafts[p.key] ?? p.content;
        const dirty = draft !== p.content;
        return (
          <div key={p.key} className="border border-border rounded-lg p-4 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{p.label}</span>
                  {p.isOverridden ? (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-primary/15 text-primary font-bold">Custom</span>
                  ) : (
                    <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-muted text-muted-foreground font-bold">Code default</span>
                  )}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground mt-0.5">{p.key}</div>
                <p className="text-xs text-muted-foreground mt-1">{p.description}</p>
                {p.variables.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {p.variables.map((v) => (
                      <code key={v} className="text-[10px] bg-muted px-1.5 py-0.5 rounded">{v}</code>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {p.isOverridden && (
                  <Button size="sm" variant="outline" onClick={() => reset.mutate(p.key)} disabled={reset.isPending}>
                    <RotateCcw className="h-3.5 w-3.5 mr-1" /> Reset
                  </Button>
                )}
                <Button
                  size="sm"
                  onClick={() => save.mutate({ key: p.key, label: p.label, content: draft })}
                  disabled={save.isPending || !dirty}
                >
                  Save
                </Button>
              </div>
            </div>
            <Textarea
              rows={Math.min(20, Math.max(6, draft.split("\n").length + 1))}
              value={draft}
              onChange={(e) => setDrafts({ ...drafts, [p.key]: e.target.value })}
              className="font-mono text-xs"
            />
            {p.updated_at && (
              <div className="text-[11px] text-muted-foreground">Last updated {new Date(p.updated_at).toLocaleString()}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}

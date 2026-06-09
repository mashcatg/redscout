import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Save, RefreshCw } from "lucide-react";
import {
  adminListSubreddits,
  adminAddSubreddit,
  adminUpdateSubreddit,
  adminDeleteSubreddit,
  adminRescanSubreddit,
} from "@/lib/warmup.functions";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/admin/warmup")({
  component: AdminWarmup,
});

function AdminWarmup() {
  const qc = useQueryClient();
  const listFn = useServerFn(adminListSubreddits);
  const addFn = useServerFn(adminAddSubreddit);
  const updFn = useServerFn(adminUpdateSubreddit);
  const delFn = useServerFn(adminDeleteSubreddit);
  const rescanFn = useServerFn(adminRescanSubreddit);

  const q = useQuery({ queryKey: ["admin-warmup"], queryFn: () => listFn() });

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [rules, setRules] = useState("");
  const [allowsBody, setAllowsBody] = useState(true);

  const addM = useMutation({
    mutationFn: () => addFn({ data: { name, description, rules, allows_body: allowsBody } }),
    onSuccess: (row: { scan_error?: string | null }) => {
      if (row?.scan_error) toast.warning(`Added — initial scan failed: ${row.scan_error}`);
      else toast.success("Subreddit added & scanned");
      setName(""); setDescription(""); setRules(""); setAllowsBody(true);
      qc.invalidateQueries({ queryKey: ["admin-warmup"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { toast.success("Removed"); qc.invalidateQueries({ queryKey: ["admin-warmup"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const rescanM = useMutation({
    mutationFn: (id: string) => rescanFn({ data: { id } }),
    onSuccess: (r: { count: number }) => { toast.success(`Scanned — ${r.count} posts`); qc.invalidateQueries({ queryKey: ["admin-warmup"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="border border-border rounded-lg p-4 space-y-3">
        <h2 className="font-semibold">Add subreddit</h2>
        <Input placeholder="Subreddit name (e.g. AskReddit)" value={name} onChange={(e) => setName(e.target.value)} />
        <Textarea placeholder="Short description of this subreddit and what works here…" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <Textarea placeholder="Rules the AI MUST follow when posting (paste the subreddit rules here)…" rows={6} value={rules} onChange={(e) => setRules(e.target.value)} />
        <div className="flex items-center gap-2">
          <Switch id="add-allows-body" checked={allowsBody} onCheckedChange={setAllowsBody} />
          <Label htmlFor="add-allows-body" className="text-sm">Allow text body (off = title-only subreddit)</Label>
        </div>
        <Button onClick={() => addM.mutate()} disabled={addM.isPending || !name.trim()}>
          <Plus className="h-4 w-4 mr-1" /> {addM.isPending ? "Adding…" : "Add subreddit"}
        </Button>

      </div>

      <h2 className="font-semibold">All subreddits ({q.data?.length ?? 0})</h2>
      {q.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32" />)}</div>
      ) : (
        <div className="space-y-3">
          {(q.data ?? []).map((s) => (
            <SubredditRow
              key={s.id}
              sub={s}
              onUpdate={updFn}
              onDelete={() => delM.mutate(s.id)}
              onRescan={() => rescanM.mutate(s.id)}
              rescanning={rescanM.isPending && rescanM.variables === s.id}
              qc={qc}
            />
          ))}
          {q.data?.length === 0 && <p className="text-sm text-muted-foreground">None yet.</p>}
        </div>
      )}
    </div>
  );
}

function SubredditRow({ sub, onUpdate, onDelete, onRescan, rescanning, qc }: {
  sub: { id: string; name: string; description: string | null; rules: string | null; allows_body?: boolean | null };
  onUpdate: (a: { data: { id: string; description: string; rules: string; allows_body: boolean } }) => Promise<unknown>;
  onDelete: () => void;
  onRescan: () => void;
  rescanning: boolean;
  qc: ReturnType<typeof useQueryClient>;
}) {
  const [desc, setDesc] = useState(sub.description ?? "");
  const [rules, setRules] = useState(sub.rules ?? "");
  const [allowsBody, setAllowsBody] = useState(sub.allows_body !== false);
  const saveM = useMutation({
    mutationFn: () => onUpdate({ data: { id: sub.id, description: desc, rules, allows_body: allowsBody } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-warmup"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="border border-border rounded-lg p-4 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-sm font-semibold">r/{sub.name}</span>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={onRescan} disabled={rescanning}>
            <RefreshCw className={`h-4 w-4 ${rescanning ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="ghost" onClick={onDelete}><Trash2 className="h-4 w-4 text-destructive" /></Button>
        </div>
      </div>
      <Textarea rows={2} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="Description" />
      <Textarea rows={5} value={rules} onChange={(e) => setRules(e.target.value)} placeholder="Rules" />
      <div className="flex items-center gap-2">
        <Switch id={`allows-body-${sub.id}`} checked={allowsBody} onCheckedChange={setAllowsBody} />
        <Label htmlFor={`allows-body-${sub.id}`} className="text-sm">Allow text body (off = title-only)</Label>
      </div>
      <Button size="sm" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
        <Save className="h-3.5 w-3.5 mr-1" /> Save
      </Button>
    </div>
  );
}


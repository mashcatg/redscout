import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { listKeywords, addKeyword, removeKeyword } from "@/lib/keywords.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/keywords")({
  component: KeywordsPage,
});

function KeywordsPage() {
  const { orgId } = Route.useParams();
  const qc = useQueryClient();
  const listFn = useServerFn(listKeywords);
  const addFn = useServerFn(addKeyword);
  const removeFn = useServerFn(removeKeyword);

  const [newKw, setNewKw] = useState("");
  const [toDelete, setToDelete] = useState<{ id: string; keyword: string } | null>(null);

  const q = useQuery({
    queryKey: ["keywords", orgId],
    queryFn: () => listFn({ data: { orgId } }),
  });

  const addM = useMutation({
    mutationFn: (keyword: string) => addFn({ data: { orgId, keyword } }),
    onSuccess: () => {
      setNewKw("");
      toast.success("Keyword added — will be scanned on next cycle");
      qc.invalidateQueries({ queryKey: ["keywords", orgId] });
      qc.invalidateQueries({ queryKey: ["plan-usage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (keywordId: string) => removeFn({ data: { orgId, keywordId } }),
    onSuccess: () => {
      toast.success("Keyword removed");
      qc.invalidateQueries({ queryKey: ["keywords", orgId] });
      qc.invalidateQueries({ queryKey: ["plan-usage"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const keywords = q.data?.keywords ?? [];
  const max = q.data?.max ?? 10;
  const used = keywords.length;
  const atLimit = used >= max;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Keywords</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage the keywords we scan for your organization.
        </p>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
          Tracked ({used}/{max})
        </h2>
        <span className="text-xs text-muted-foreground capitalize">{q.data?.plan ?? "—"} plan</span>
      </div>

      <form
        className="flex gap-2 mb-6"
        onSubmit={(e) => {
          e.preventDefault();
          const v = newKw.trim();
          if (!v) return;
          if (atLimit) {
            toast.error(`Plan limit reached (${max}). Upgrade to add more.`);
            return;
          }
          addM.mutate(v);
        }}
      >
        <Input
          placeholder="Add a keyword (e.g. 'project management software')"
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          disabled={addM.isPending}
          maxLength={120}
        />
        <Button type="submit" disabled={addM.isPending || !newKw.trim() || atLimit}>
          <Plus className="h-4 w-4 mr-1" /> Add
        </Button>
      </form>

      {q.isLoading ? (
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-9 w-32" />)}
        </div>
      ) : keywords.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-12 text-center text-sm text-muted-foreground">
          No keywords yet — add one above.
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          {keywords.map((k) => (
            <div
              key={k.id}
              className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
              <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="text-sm font-medium">{k.keyword}</span>
              <button
                onClick={() => setToDelete({ id: k.id, keyword: k.keyword })}
                className="opacity-60 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                title="Remove keyword"
                aria-label={`Remove ${k.keyword}`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove "{toDelete?.keyword}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Future scans for this keyword will stop. Previously scanned inbox items will remain.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (toDelete) delM.mutate(toDelete.id);
                setToDelete(null);
              }}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

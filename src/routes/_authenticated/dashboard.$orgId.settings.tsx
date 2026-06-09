import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Plus, Trash2, KeyRound, CreditCard, User as UserIcon, Building2, Sparkles, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { getOrganization, getCurrentUser, updateMyProfile } from "@/lib/org.functions";
import { listKeywords, addKeyword, removeKeyword } from "@/lib/keywords.functions";
import {
  updateOrganization, deleteOrganization, deleteMyAccount,
  listPersonalities, upsertPersonality, deletePersonality,
} from "@/lib/settings.functions";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { BillingPortal } from "@/components/BillingPortal";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TABS = ["org", "keywords", "train", "profile", "password", "billing", "danger"] as const;
type Tab = (typeof TABS)[number];

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/settings")({
  validateSearch: z.object({ tab: z.enum(TABS).optional() }),
  component: SettingsPage,
});

function SettingsPage() {
  const { orgId } = Route.useParams();
  const search = useSearch({ from: "/_authenticated/dashboard/$orgId/settings" });
  const navigate = useNavigate();
  const tab: Tab = search.tab ?? "org";

  return (
    <div className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-1">Settings</h1>
      <p className="text-sm text-muted-foreground mb-6">Manage your organization and account.</p>
      <Tabs
        value={tab}
        onValueChange={(v) => navigate({ to: ".", params: { orgId }, search: { tab: v as Tab } })}
      >
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="org"><Building2 className="h-3.5 w-3.5 mr-1.5" /> Org details</TabsTrigger>
          <TabsTrigger value="keywords"><Plus className="h-3.5 w-3.5 mr-1.5" /> Keywords</TabsTrigger>
          <TabsTrigger value="train"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Train redScout</TabsTrigger>
          <TabsTrigger value="profile"><UserIcon className="h-3.5 w-3.5 mr-1.5" /> Profile</TabsTrigger>
          <TabsTrigger value="password"><KeyRound className="h-3.5 w-3.5 mr-1.5" /> Password</TabsTrigger>
          <TabsTrigger value="billing"><CreditCard className="h-3.5 w-3.5 mr-1.5" /> Billing</TabsTrigger>
          <TabsTrigger value="danger" className="text-destructive data-[state=active]:text-destructive">
            <AlertTriangle className="h-3.5 w-3.5 mr-1.5" /> Danger zone
          </TabsTrigger>
        </TabsList>

        <TabsContent value="org" className="mt-6"><OrgTab orgId={orgId} /></TabsContent>
  <TabsContent value="keywords" className="mt-6"><KeywordsTab orgId={orgId} /></TabsContent>
        <TabsContent value="train" className="mt-6"><TrainTab orgId={orgId} /></TabsContent>
        <TabsContent value="profile" className="mt-6"><ProfileTab /></TabsContent>
        <TabsContent value="password" className="mt-6"><PasswordTab /></TabsContent>
        <TabsContent value="billing" className="mt-6"><BillingTab /></TabsContent>
        <TabsContent value="danger" className="mt-6"><DangerTab orgId={orgId} /></TabsContent>
      </Tabs>
    </div>
  );
}

function KeywordsTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const listFn = useServerFn(listKeywords);
  const addFn = useServerFn(addKeyword);
  const removeFn = useServerFn(removeKeyword);

  const q = useQuery({ queryKey: ["keywords", orgId], queryFn: () => listFn({ data: { orgId } }) });
  const [newKw, setNewKw] = useState("");

  const addM = useMutation({
    mutationFn: (kw: string) => addFn({ data: { orgId, keyword: kw } }),
    onSuccess: () => {
      setNewKw("");
      toast.success("Keyword added");
      qc.invalidateQueries({ queryKey: ["keywords", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (keywordId: string) => removeFn({ data: { orgId, keywordId } }),
    onSuccess: () => {
      toast.success("Keyword removed");
      qc.invalidateQueries({ queryKey: ["keywords", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const keywords = q.data?.keywords ?? [];
  const max = q.data?.max ?? 0;
  const atLimit = max > 0 && keywords.length >= max;

  return (
    <div className="space-y-4 max-w-2xl">
      <div>
        <h2 className="font-semibold">Keywords</h2>
        <p className="text-sm text-muted-foreground">Manage the keywords we scan for your organization.</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = newKw.trim();
          if (!v || atLimit) return;
          addM.mutate(v);
        }}
        className="flex gap-2"
      >
        <Input
          value={newKw}
          onChange={(e) => setNewKw(e.target.value)}
          placeholder="Add keyword"
          disabled={addM.isPending}
        />
        <Button type="submit" disabled={addM.isPending || !newKw.trim() || atLimit}>Add</Button>
      </form>

      <p className="text-xs text-muted-foreground">{keywords.length} / {max} used</p>

      {q.isLoading ? (
        <FormSkeleton />
      ) : keywords.length === 0 ? (
        <div className="border border-dashed border-border rounded p-8 text-center text-sm text-muted-foreground">
          No keywords yet.
        </div>
      ) : (
        <ul className="border border-border rounded divide-y divide-border">
          {keywords.map((k: { id: string; keyword: string }) => (
            <li key={k.id} className="p-3 flex items-center justify-between gap-3">
              <span className="truncate text-sm">{k.keyword}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => delM.mutate(k.id)}
                disabled={delM.isPending}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ---------- Org details ---------- */
function OrgTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const orgFn = useServerFn(getOrganization);
  const updateFn = useServerFn(updateOrganization);
  const orgQ = useQuery({ queryKey: ["org", orgId], queryFn: () => orgFn({ data: { orgId } }) });

  const [form, setForm] = useState({ name: "", website_url: "", favicon_url: "", product_name: "", product_description: "" });
  useEffect(() => {
    if (orgQ.data) {
      setForm({
        name: orgQ.data.name ?? "",
        website_url: orgQ.data.website_url ?? "",
        favicon_url: orgQ.data.favicon_url ?? "",
        product_name: orgQ.data.product_name ?? "",
        product_description: orgQ.data.product_description ?? "",
      });
    }
  }, [orgQ.data]);

  const m = useMutation({
    mutationFn: () => updateFn({ data: { orgId, ...form } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["org", orgId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (orgQ.isLoading) return <FormSkeleton />;

  return (
    <div className="space-y-4 max-w-xl">
      <Field label="Organization name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
      <Field label="Website URL"><Input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="https://example.com" /></Field>
      <Field label="Favicon URL"><Input value={form.favicon_url} onChange={(e) => setForm({ ...form, favicon_url: e.target.value })} placeholder="https://…/favicon.ico" /></Field>
      <Field label="Product name"><Input value={form.product_name} onChange={(e) => setForm({ ...form, product_name: e.target.value })} /></Field>
      <Field label="Product description">
        <Textarea rows={4} value={form.product_description} onChange={(e) => setForm({ ...form, product_description: e.target.value })} />
      </Field>
      <Button onClick={() => m.mutate()} disabled={m.isPending}>Save changes</Button>
    </div>
  );
}

/* ---------- Train redScout ---------- */
function TrainTab({ orgId }: { orgId: string }) {
  const qc = useQueryClient();
  const orgFn = useServerFn(getOrganization);
  const updateFn = useServerFn(updateOrganization);
  const listFn = useServerFn(listPersonalities);
  const upsertFn = useServerFn(upsertPersonality);
  const delFn = useServerFn(deletePersonality);

  const orgQ = useQuery({ queryKey: ["org", orgId], queryFn: () => orgFn({ data: { orgId } }) });
  const personasQ = useQuery({ queryKey: ["personalities", orgId], queryFn: () => listFn({ data: { orgId } }) });

  const [notes, setNotes] = useState("");
  useEffect(() => { if (orgQ.data) setNotes(orgQ.data.training_notes ?? ""); }, [orgQ.data]);

  const saveNotes = useMutation({
    mutationFn: () => updateFn({ data: { orgId, training_notes: notes } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["org", orgId] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<{ id?: string; slug: string; label: string; description: string; instructions: string }>({
    slug: "", label: "", description: "", instructions: "",
  });

  const saveP = useMutation({
    mutationFn: () => upsertFn({ data: { orgId, ...edit } }),
    onSuccess: () => {
      toast.success("Saved");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["personalities", orgId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delP = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["personalities", orgId] }); toast.success("Deleted"); },
  });

  function openNew() {
    setEdit({ slug: "", label: "", description: "", instructions: "" });
    setOpen(true);
  }
  function openEdit(p: NonNullable<typeof personasQ.data>[number]) {
    setEdit({ id: p.id, slug: p.slug, label: p.label, description: p.description ?? "", instructions: p.instructions });
    setOpen(true);
  }

  return (
    <div className="space-y-8 max-w-2xl">
      <section className="space-y-3">
        <div>
          <h2 className="font-semibold">Train redScout on your voice</h2>
          <p className="text-sm text-muted-foreground">
            Describe how you write — tone, vocabulary, things you'd never say, examples. This is appended to every comment redScout drafts.
          </p>
        </div>
        {orgQ.isLoading ? <Skeleton className="h-40 w-full" /> : (
          <Textarea
            rows={10}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Example: I write casually, lowercase first word, no exclamation marks. I love sharing concrete numbers from my own experience. I never start with 'Great question'…"
          />
        )}
        <Button onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>Save voice notes</Button>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Custom personalities</h2>
            <p className="text-sm text-muted-foreground">
              Add your own comment tones — they appear in the Generate dropdown next to the built-ins.
            </p>
          </div>
          <Button size="sm" onClick={openNew}><Plus className="h-3.5 w-3.5 mr-1" /> New</Button>
        </div>

        {personasQ.isLoading ? (
          <Skeleton className="h-24 w-full" />
        ) : (personasQ.data ?? []).length === 0 ? (
          <div className="border border-dashed border-border rounded p-8 text-center text-sm text-muted-foreground">
            No custom personalities yet.
          </div>
        ) : (
          <ul className="border border-border rounded divide-y divide-border">
            {(personasQ.data ?? []).map((p) => (
              <li key={p.id} className="p-3 flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">{p.label}</div>
                  {p.description && (
                    <p className="text-xs text-muted-foreground truncate">{p.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(p)}>Edit</Button>
                  <Button size="sm" variant="ghost" onClick={() => delP.mutate(p.id)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{edit.id ? "Edit personality" : "New personality"}</DialogTitle>
            <DialogDescription>Define a custom tone redScout can use when drafting comments.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Field label="Name">
              <Input
                value={edit.label}
                onChange={(e) => {
                  const label = e.target.value;
                  const autoSlug = edit.id
                    ? edit.slug
                    : label.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
                  setEdit({ ...edit, label, slug: autoSlug });
                }}
                placeholder="Sarcastic"
              />
            </Field>
            <Field label="Short description"><Input value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} placeholder="Dry humor, gentle ribbing" /></Field>
            <Field label="Instructions for the AI">
              <Textarea rows={5} value={edit.instructions} onChange={(e) => setEdit({ ...edit, instructions: e.target.value })}
                placeholder="Be dry and a little sarcastic. Make exactly one joke at the situation's expense, then give the actual answer in one sentence." />
            </Field>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveP.mutate()} disabled={saveP.isPending || !edit.label || !edit.slug || edit.instructions.length < 5}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ---------- Profile ---------- */
function ProfileTab() {
  const qc = useQueryClient();
  const meFn = useServerFn(getCurrentUser);
  const updateFn = useServerFn(updateMyProfile);
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });

  const [name, setName] = useState("");
  useEffect(() => {
    if (meQ.data) { setName(meQ.data.name ?? ""); }
  }, [meQ.data]);

  const m = useMutation({
    mutationFn: () => updateFn({ data: { name, avatar_url: null } }),
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["me"] }); },
    onError: (e: Error) => toast.error(e.message),
  });

  if (meQ.isLoading) return <FormSkeleton />;

  return (
    <div className="space-y-4 max-w-xl">
      <Field label="Email"><Input value={meQ.data?.email ?? ""} disabled /></Field>
      <Field label="Display name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
      <Button onClick={() => m.mutate()} disabled={m.isPending}>Save profile</Button>
    </div>
  );
}

/* ---------- Password ---------- */
function PasswordTab() {
  const [pw, setPw] = useState("");
  const m = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.auth.updateUser({ password: pw });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Password updated"); setPw(""); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <div className="space-y-4 max-w-md">
      <Field label="New password (min 8 chars)">
        <Input type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={8} />
      </Field>
      <Button onClick={() => m.mutate()} disabled={m.isPending || pw.length < 8}>Update password</Button>
    </div>
  );
}

/* ---------- Billing ---------- */
function BillingTab() {
  return (
    <BillingPortal />
  );
}

/* ---------- Danger zone ---------- */
function DangerTab({ orgId }: { orgId: string }) {
  const navigate = useNavigate();
  const orgFn = useServerFn(getOrganization);
  const meFn = useServerFn(getCurrentUser);
  const delOrgFn = useServerFn(deleteOrganization);
  const delMeFn = useServerFn(deleteMyAccount);
  const orgQ = useQuery({ queryKey: ["org", orgId], queryFn: () => orgFn({ data: { orgId } }) });
  const meQ = useQuery({ queryKey: ["me"], queryFn: () => meFn() });
  const isOwner = orgQ.data?.owner_id && meQ.data?.id && orgQ.data.owner_id === meQ.data.id;

  const delOrg = useMutation({
    mutationFn: () => delOrgFn({ data: { orgId } }),
    onSuccess: () => { toast.success("Organization deleted"); navigate({ to: "/dashboard" }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const delMe = useMutation({
    mutationFn: () => delMeFn(),
    onSuccess: async () => { await supabase.auth.signOut(); navigate({ to: "/login" }); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6 max-w-xl">
      {isOwner && (
        <div className="border border-destructive/40 rounded p-4">
          <h3 className="font-semibold text-destructive">Delete this organization</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently delete the org, its keywords, competitors, scan jobs, and inbox items. This cannot be undone.
          </p>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" className="mt-3">Delete organization</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this organization?</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently remove "{orgQ.data?.name}" and all of its data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => delOrg.mutate()} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      )}

      <div className="border border-destructive/40 rounded p-4">
        <h3 className="font-semibold text-destructive">Delete my account</h3>
        <p className="text-sm text-muted-foreground mt-1">
          Permanently delete your account, all orgs you own, and all your data. This cannot be undone.
        </p>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="destructive" size="sm" className="mt-3">Delete account</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete your account?</AlertDialogTitle>
              <AlertDialogDescription>
                You will be signed out and removed permanently. All organizations you own will be deleted.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => delMe.mutate()} className="bg-destructive text-destructive-foreground">Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

/* ---------- helpers ---------- */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function FormSkeleton() {
  return (
    <div className="space-y-3 max-w-xl">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="space-y-1.5">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-9 w-full" />
        </div>
      ))}
    </div>
  );
}

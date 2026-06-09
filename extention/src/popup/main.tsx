import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSupabase } from "@/lib/supabase";
import { DEFAULT_SETTINGS, type CampaignProgress, type CampaignSettings } from "@/lib/messaging";
import { LogIn, Home, Megaphone, Settings as SettingsIcon, Loader2, Play, Pause, Square, RefreshCw } from "lucide-react";
import "./index.css";

type Session = { user: { id: string; email?: string } } | null;
type Org = { id: string; name: string; favicon_url: string | null };

function useSession() {
  const [s, setS] = useState<Session>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const sb = getSupabase();
    sb.auth.getSession().then(({ data }) => { setS(data.session as any); setLoading(false); });
    const { data: sub } = sb.auth.onAuthStateChange((_e, sess) => setS(sess as any));
    return () => sub.subscription.unsubscribe();
  }, []);
  return { session: s, loading };
}

function Header({ tab, setTab }: { tab: string; setTab: (t: string) => void }) {
  return (
    <div className="px-4 pt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="serif text-2xl tracking-tight">redScout<span className="text-primary">↻</span></div>
        <button className="w-8 h-8 rounded-full bg-muted border border-border" />
      </div>
      <div className="grid grid-cols-3 gap-1 p-1 bg-muted border border-border rounded-md">
        {[
          { k: "home", l: "Home", I: Home },
          { k: "campaign", l: "Campaign", I: Megaphone },
          { k: "settings", l: "Settings", I: SettingsIcon },
        ].map(({ k, l, I }) => (
          <button key={k} onClick={() => setTab(k)}
            className={`flex flex-col items-center gap-1 py-2 text-xs rounded ${tab === k ? "bg-card text-primary border border-primary/30" : "text-mutedfg"}`}>
            <I className="w-4 h-4" /> {l}
          </button>
        ))}
      </div>
    </div>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function go() {
    setBusy(true); setErr(null);
    const { error } = await getSupabase().auth.signInWithPassword({ email, password: pw });
    if (error) setErr(error.message);
    setBusy(false);
  }
  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="serif text-2xl">Sign in</h1>
        <p className="text-sm text-mutedfg">Use your redScout dashboard account.</p>
      </div>
      <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com"
        className="w-full px-3 py-2 border border-border rounded bg-card text-sm" />
      <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="Password"
        className="w-full px-3 py-2 border border-border rounded bg-card text-sm" />
      {err && <p className="text-xs text-red-600">{err}</p>}
      <button onClick={go} disabled={busy}
        className="w-full bg-primary text-primaryfg py-2 rounded font-medium flex items-center justify-center gap-2 disabled:opacity-50">
        {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />} Sign in
      </button>
      <p className="text-xs text-center text-mutedfg">
        Don't have an account?{" "}
        <a className="text-primary underline" href="https://reddit-spark-search.lovable.app/signup" target="_blank" rel="noreferrer">Sign up</a>
      </p>
    </div>
  );
}

function HomeView({ orgs, activeOrg, setActiveOrg, onPickCampaign, postInfo }: {
  orgs: Org[]; activeOrg: Org | null; setActiveOrg: (o: Org) => void;
  onPickCampaign: () => void; postInfo: { onPost: boolean; subreddit?: string; title?: string };
}) {
  return (
    <div className="p-4 space-y-3">
      <div className="border border-border rounded p-2 bg-card flex items-center gap-2">
        <div className="w-6 h-6 rounded bg-muted flex items-center justify-center text-[10px]">
          {activeOrg?.name?.[0]?.toUpperCase() ?? "?"}
        </div>
        <select value={activeOrg?.id ?? ""} onChange={(e) => {
          const o = orgs.find((x) => x.id === e.target.value); if (o) setActiveOrg(o);
        }} className="flex-1 bg-transparent text-sm outline-none">
          {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      <h2 className="text-sm font-semibold mt-2">Start a Campaign</h2>

      <button onClick={onPickCampaign} disabled={!postInfo.onPost}
        className="w-full text-left border border-border bg-card rounded p-3 hover:border-primary disabled:opacity-60">
        <div className="flex items-center gap-2"><Megaphone className="w-4 h-4 text-primary" /><span className="font-medium text-sm">Thread Campaign</span></div>
        <p className="text-xs text-mutedfg mt-1">Target commenters in a Reddit post</p>
        {!postInfo.onPost && <p className="text-xs text-amber-700 mt-2">⚠ Navigate to a Reddit thread to enable</p>}
        {postInfo.onPost && <p className="text-xs text-mutedfg mt-2 truncate">r/{postInfo.subreddit} · {postInfo.title}</p>}
      </button>

      <div className="border border-border bg-card rounded p-3 opacity-60">
        <div className="flex items-center gap-2"><span className="font-medium text-sm">Subreddit Campaign</span></div>
        <p className="text-xs text-mutedfg mt-1">Coming soon</p>
      </div>
      <div className="border border-border bg-card rounded p-3 opacity-60">
        <div className="flex items-center gap-2"><span className="font-medium text-sm">List Campaign</span></div>
        <p className="text-xs text-mutedfg mt-1">Coming soon</p>
      </div>
    </div>
  );
}

function CampaignView({ activeOrg, postInfo }: { activeOrg: Org | null; postInfo: { onPost: boolean; subreddit?: string; title?: string; url?: string; author?: string } }) {
  const [name, setName] = useState("Thread Campaign");
  const [template, setTemplate] = useState("{Hey|Hi|Hi there} — saw your comment in r/" + (postInfo.subreddit ?? "") + ". {Quick question|Mind if I ask}: ...");
  const [settings, setSettings] = useState<CampaignSettings>(DEFAULT_SETTINGS);
  const [progress, setProgress] = useState<CampaignProgress | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const draftKey = "redreach.campaignDraft";

  useEffect(() => {
    chrome.storage.local.get(draftKey, (value) => {
      const saved = value[draftKey] as {
        name?: string;
        template?: string;
        settings?: Partial<CampaignSettings>;
      } | undefined;
      if (!saved) return;
      if (saved.name) setName(saved.name);
      if (saved.template) setTemplate(saved.template);
      if (saved.settings) setSettings((current) => ({ ...current, ...saved.settings }));
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({
      [draftKey]: {
        name,
        template,
        settings,
      },
    });
  }, [name, template, settings]);

  useEffect(() => {
    chrome.storage.local.get("redreach.defaultSettings", (value) => {
      const saved = value["redreach.defaultSettings"] as Partial<CampaignSettings> | undefined;
      if (saved) {
        setSettings((current) => ({ ...current, ...saved }));
      }
    });
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({ type: "GET_PROGRESS" }, (r) => { if (r?.progress) setProgress(r.progress); });
    const l = (msg: any) => { if (msg?.type === "PROGRESS_UPDATE") setProgress(msg.progress); };
    chrome.runtime.onMessage.addListener(l);
    return () => chrome.runtime.onMessage.removeListener(l);
  }, []);

  async function start() {
    setBusy(true); setErr(null);
    try {
      if (!activeOrg) throw new Error("Pick an org first");
      if (!postInfo.onPost) throw new Error("Open a Reddit post tab");
      const sb = getSupabase();
      const { data: u } = await sb.auth.getUser();
      if (!u.user) throw new Error("Not signed in");
      const { data: sessionData } = await sb.auth.getSession();
      const authSession = sessionData.session
        ? {
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
            expires_at: sessionData.session.expires_at,
          }
        : null;

      // Get active reddit tab
      const tabs = (await chrome.tabs.query({ active: true, currentWindow: true })) as any[];
      const tab = tabs?.[0] as any;
      if (!tab?.id || !tab.url?.includes("reddit.com")) throw new Error("Open the Reddit post in the active tab");

      // Ask background to scrape commenters via .json (reuses existing SCRAPE_THREAD handler)
      const scrape: any = await chrome.runtime.sendMessage({ type: "SCRAPE_THREAD" });
      if (!scrape?.ok) throw new Error(scrape?.error || "Failed to scrape thread");
      const commenters = (scrape.data?.commenters || []) as Array<{ username: string; comment_id: string; comment_url: string; comment_body: string; is_first_level: boolean }>;
      if (!commenters.length) throw new Error("No commenters found on this thread");

      // Create campaign row via SECURITY DEFINER RPC (handles RLS + org membership check)
      const rpcRes: any = await sb.rpc("create_dm_campaign", {
        _org_id: activeOrg.id,
        _user_id: u.user.id,
        _name: name,
        _message_template: template,
        _status: "running",
        _post_title: postInfo.title,
        _post_url: postInfo.url,
        _post_author: postInfo.author,
        _post_subreddit: postInfo.subreddit,
        _skip_post_author: settings.skip_post_author,
        _skip_if_dmed: settings.skip_if_dmed,
        _first_level_only: settings.first_level_only,
      }).single();
      const camp = rpcRes?.data as any;
      const error = rpcRes?.error;
      if (error) throw error;
      if (!camp) throw new Error("Failed to create campaign");

      // Dispatch autopilot to the active tab's content script
      const delaySec = Math.max(settings.delay_min_sec, 5);
      const filtered = settings.first_level_only ? commenters.filter((c) => c.is_first_level) : commenters;
      const r: any = await chrome.tabs.sendMessage(tab.id, {
        type: "START_AUTOPILOT",
        payload: {
          campaignId: camp.id,
          orgId: activeOrg.id,
          userId: u.user.id,
          authSession,
          messageTemplate: template,
          delaySec,
          dmLimit: settings.dm_limit,
          skipPostAuthor: settings.skip_post_author,
          skipIfDmed: settings.skip_if_dmed,
          postAuthor: postInfo.author,
          postSubreddit: postInfo.subreddit,
          postTitle: postInfo.title,
          postUrl: postInfo.url,
          commenters: filtered,
        },
      });
      if (!r?.ok) throw new Error(r?.error || "Failed to start autopilot in tab");

      await chrome.storage.local.remove(draftKey);

      setProgress({
        status: "running", campaign_id: camp.id, total: filtered.length,
        sent: 0, failed: 0, skipped: 0, remaining: filtered.length,
      });
    } catch (e: any) { setErr(String(e.message ?? e)); }
    finally { setBusy(false); }
  }

  return (
    <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto scroll-thin">
      {postInfo.onPost && (
        <div className="border border-border rounded p-3 bg-card">
          <div className="text-xs text-mutedfg">Targeting</div>
          <div className="text-sm font-medium">r/{postInfo.subreddit}</div>
          <div className="text-sm">{postInfo.title}</div>
        </div>
      )}

      <input value={name} onChange={(e) => setName(e.target.value)}
        className="w-full px-3 py-2 border border-border rounded bg-card text-sm" placeholder="Campaign name" />

      <div className="border border-border rounded p-3 bg-card space-y-2">
        <div className="text-sm font-semibold">Campaign Message</div>
        <p className="text-xs text-mutedfg">Use spintax to vary: {"{Hello|Hi|Hey}"}</p>
        <textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={6}
          className="w-full px-3 py-2 border border-border rounded bg-bg text-sm" />
        <div className="text-xs text-mutedfg">{template.length}/1000 characters</div>
      </div>

      <div className="border border-border rounded p-3 bg-card space-y-2">
        <div className="text-sm font-semibold">Campaign Settings</div>
        <label className="text-xs">Campaign limit
          <input type="number" value={settings.dm_limit} onChange={(e) => setSettings({ ...settings, dm_limit: Number(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border border-border rounded bg-bg text-sm" />
        </label>
        <label className="text-xs">Daily limit
          <input type="number" value={settings.daily_limit} onChange={(e) => setSettings({ ...settings, daily_limit: Number(e.target.value) })}
            className="w-full mt-1 px-2 py-1 border border-border rounded bg-bg text-sm" />
        </label>
        <div className="grid grid-cols-2 gap-2">
          <label className="text-xs">Delay min (s)
            <input type="number" value={settings.delay_min_sec} onChange={(e) => setSettings({ ...settings, delay_min_sec: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 border border-border rounded bg-bg text-sm" />
          </label>
          <label className="text-xs">Delay max (s)
            <input type="number" value={settings.delay_max_sec} onChange={(e) => setSettings({ ...settings, delay_max_sec: Number(e.target.value) })}
              className="w-full mt-1 px-2 py-1 border border-border rounded bg-bg text-sm" />
          </label>
        </div>
        {[
          ["skip_post_author", "Skip post author (OP)"],
          ["skip_if_dmed", "Skip users already DM'd"],
          ["first_level_only", "First-level comments only"],
          ["dry_run", "Dry-run (don't send, log only)"],
        ].map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={(settings as any)[k]}
              onChange={(e) => setSettings({ ...settings, [k]: e.target.checked } as any)} />
            {l}
          </label>
        ))}
      </div>

      {progress && progress.status !== "idle" && (
        <div className="border border-primary/30 bg-primary/5 rounded p-3 text-xs space-y-1">
          <div className="font-semibold capitalize">{progress.status.replace("_", " ")}</div>
          <div>Sent {progress.sent} · Failed {progress.failed} · Skipped {progress.skipped} · Remaining {progress.remaining}</div>
          {progress.current_user && <div>Current: u/{progress.current_user}</div>}
        </div>
      )}
      {err && <p className="text-xs text-red-600">{err}</p>}

      <div className="flex gap-2">
        <button onClick={start} disabled={busy || !postInfo.onPost}
          className="flex-1 bg-primary text-primaryfg py-2 rounded font-medium flex items-center justify-center gap-2 disabled:opacity-50">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Start Campaign
        </button>
        <button onClick={async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "AUTOPILOT_PAUSE" });
        }}
          className="px-3 py-2 border border-border rounded"><Pause className="w-4 h-4" /></button>
        <button onClick={async () => {
          const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
          if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: "AUTOPILOT_STOP" });
        }}
          className="px-3 py-2 border border-border rounded"><Square className="w-4 h-4" /></button>
      </div>
    </div>
  );
}

function SettingsView() {
  const [dailyLimit, setDailyLimit] = useState(DEFAULT_SETTINGS.daily_limit);

  useEffect(() => {
    chrome.storage.local.get("redreach.defaultSettings", (value) => {
      const saved = value["redreach.defaultSettings"] as Partial<CampaignSettings> | undefined;
      if (saved?.daily_limit) setDailyLimit(saved.daily_limit);
    });
  }, []);

  useEffect(() => {
    chrome.storage.local.set({
      "redreach.defaultSettings": {
        daily_limit: dailyLimit,
      },
    });
  }, [dailyLimit]);

  return (
    <div className="p-4 space-y-3 text-sm">
      <p className="text-mutedfg">Defaults are saved per-campaign. Sign out clears local session.</p>
      <label className="block text-xs text-foreground">
        Daily limit
        <input
          type="number"
          min={1}
          value={dailyLimit}
          onChange={(e) => setDailyLimit(Number(e.target.value || 25))}
          className="w-full mt-1 px-3 py-2 border border-border rounded bg-card text-sm"
        />
      </label>
      <button onClick={() => getSupabase().auth.signOut()}
        className="w-full border border-border rounded py-2">Sign out</button>
      <p className="text-xs text-mutedfg text-center">v0.1.0 · <a className="text-primary underline" target="_blank" rel="noreferrer" href="https://reddit-spark-search.lovable.app">Dashboard</a></p>
    </div>
  );
}

function App() {
  const { session, loading } = useSession();
  const [tab, setTab] = useState("home");
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrg, setActiveOrg] = useState<Org | null>(null);
  const [postInfo, setPostInfo] = useState<{ onPost: boolean; subreddit?: string; title?: string; url?: string; author?: string }>({ onPost: false });

  useEffect(() => {
    if (!session) return;
    (async () => {
      const sb = getSupabase();
      const { data } = await sb.from("organizations").select("id,name,favicon_url");
      setOrgs((data as any) ?? []);
      const stored = await chrome.storage.local.get("redreach.activeOrg");
      const found = (data as any)?.find?.((o: Org) => o.id === stored["redreach.activeOrg"]);
      setActiveOrg(found ?? (data as any)?.[0] ?? null);
    })();
  }, [session]);

  useEffect(() => {
    if (activeOrg) chrome.storage.local.set({ "redreach.activeOrg": activeOrg.id });
  }, [activeOrg]);

  useEffect(() => {
    chrome.tabs.query({ active: true, currentWindow: true }, async ([t]) => {
      if (!t?.url?.includes("reddit.com") || !t.url.includes("/comments/")) { setPostInfo({ onPost: false }); return; }
      try {
        const r: any = await chrome.runtime.sendMessage({ type: "SCRAPE_THREAD" });
        if (r?.ok) setPostInfo({ onPost: true, subreddit: r.data.post_subreddit, title: r.data.post_title, url: r.data.post_url, author: r.data.post_author });
        else setPostInfo({ onPost: true });
      } catch { setPostInfo({ onPost: true }); }
    });
  }, [session]);

  if (loading) return <div className="p-6 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!session) return <Login />;

  return (
    <div className="pb-4">
      <Header tab={tab} setTab={setTab} />
      {tab === "home" && <HomeView orgs={orgs} activeOrg={activeOrg} setActiveOrg={setActiveOrg}
        onPickCampaign={() => setTab("campaign")} postInfo={postInfo} />}
      {tab === "campaign" && <CampaignView activeOrg={activeOrg} postInfo={postInfo} />}
      {tab === "settings" && <SettingsView />}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);

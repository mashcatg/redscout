// Autopilot orchestrator content script.
// Listens for START_AUTOPILOT from popup/background and drives the page tab.
// Runs entirely in the active Reddit tab — no new tabs are opened.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { resolveSpintax } from "@/lib/spintax";
import { sendChatTo } from "./chat-driver";
import { sleep, waitForUserIdle } from "./fake-cursor";

type StartPayload = {
  campaignId: string;
  orgId: string;
  userId: string;
  messageTemplate: string;
  delaySec: number;          // base delay between sends
  dmLimit: number;
  skipPostAuthor: boolean;
  skipIfDmed: boolean;
  postAuthor?: string;
  postSubreddit?: string;
  postTitle?: string;
  postUrl?: string;
  authSession?: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  };
  commenters: Array<{ username: string; comment_id?: string; comment_url?: string; comment_body?: string; is_first_level?: boolean }>;
};

type State = {
  running: boolean;
  paused: boolean;
  stopped: boolean;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
  current?: string;
  consecutiveErrors: number;
  nextSendAt?: number;
  lastError?: string;
  cursor: number;
  queue: StartPayload["commenters"];
  payload: StartPayload;
};

let STATE: State | null = null;
let HUD_ROOT: HTMLDivElement | null = null;
const AUTOPILOT_STORAGE_KEY = "redreach.autopilot.state";
const AUTH_STORAGE_KEY = "redreach.auth";
let SB_CLIENT: SupabaseClient | null = null;

async function loadStoredAuthSession(): Promise<{ access_token: string; refresh_token: string; expires_at?: number } | null> {
  const stored = await chrome.storage.local.get(AUTH_STORAGE_KEY);
  const raw = stored[AUTH_STORAGE_KEY];
  if (typeof raw !== "string") return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.access_token && parsed?.refresh_token) return parsed;
  } catch {}
  return null;
}

async function ensureSupabaseClient(session?: { access_token: string; refresh_token: string; expires_at?: number } | null): Promise<SupabaseClient> {
  if (SB_CLIENT) return SB_CLIENT;
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
  const authSession = session ?? await loadStoredAuthSession();
  if (authSession?.access_token && authSession?.refresh_token) {
    await client.auth.setSession({
      access_token: authSession.access_token,
      refresh_token: authSession.refresh_token,
    });
  }
  SB_CLIENT = client;
  return client;
}

async function persistState() {
  if (!STATE) return;
  await chrome.storage.local.set({ [AUTOPILOT_STORAGE_KEY]: STATE });
}

async function clearPersistedState() {
  await chrome.storage.local.remove(AUTOPILOT_STORAGE_KEY);
}

function setStatus(text: string, color = "#18110d") {
  if (!HUD_ROOT) return;
  const s = HUD_ROOT.querySelector("[data-hud-status]") as HTMLDivElement | null;
  if (s) { s.textContent = text; s.style.color = color; }
}

function updateHud() {
  if (!HUD_ROOT || !STATE) return;
  const counts = HUD_ROOT.querySelector("[data-hud-counts]") as HTMLDivElement | null;
  if (counts) {
    counts.textContent = `Sent ${STATE.sent} · Failed ${STATE.failed} · Skipped ${STATE.skipped} · ${Math.max(0, STATE.total - STATE.sent - STATE.failed - STATE.skipped)} left`;
  }
  const cur = HUD_ROOT.querySelector("[data-hud-current]") as HTMLDivElement | null;
  if (cur) cur.textContent = STATE.current ? `Targeting u/${STATE.current}` : "Idle";
  const countdown = HUD_ROOT.querySelector("[data-hud-countdown]") as HTMLDivElement | null;
  if (countdown) {
    if (STATE.nextSendAt && STATE.nextSendAt > Date.now()) {
      const s = Math.ceil((STATE.nextSendAt - Date.now()) / 1000);
      countdown.textContent = `Next in ${s}s`;
    } else countdown.textContent = "";
  }
}

function mountHud() {
  if (HUD_ROOT) return;
  HUD_ROOT = document.createElement("div");
  HUD_ROOT.id = "redreach-hud";
  HUD_ROOT.style.cssText = [
    "position:fixed",
    "left:16px",
    "bottom:16px",
    "z-index:2147483646",
    "background:#fcfbf8",
    "color:#18110d",
    "border:1px solid rgba(231,160,129,0.5)",
    "border-radius:14px",
    "padding:12px 14px",
    "min-width:260px",
    "box-shadow:0 14px 40px rgba(40,22,12,0.18)",
    "font-family:Inter,system-ui,sans-serif",
    "font-size:12px",
    "line-height:1.4",
  ].join(";");
  HUD_ROOT.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;">
      <div style="font-weight:700;color:#ef5b2d;letter-spacing:-0.01em;">RedReach Autopilot</div>
      <div data-hud-status style="font-size:11px;">Starting…</div>
    </div>
    <div data-hud-current style="margin-bottom:4px;"></div>
    <div data-hud-counts style="color:#6b5d55;margin-bottom:4px;"></div>
    <div data-hud-countdown style="color:#6b5d55;margin-bottom:8px;"></div>
    <div style="display:flex;gap:6px;">
      <button data-hud-pause style="flex:1;padding:6px 0;border:1px solid rgba(231,160,129,0.5);background:#fff;border-radius:8px;cursor:pointer;font-size:12px;">Pause</button>
      <button data-hud-stop style="flex:1;padding:6px 0;border:1px solid rgba(231,160,129,0.5);background:#fff;color:#b3261e;border-radius:8px;cursor:pointer;font-size:12px;">Stop</button>
    </div>`;
  document.documentElement.appendChild(HUD_ROOT);
  HUD_ROOT.querySelector("[data-hud-pause]")?.addEventListener("click", () => {
    if (!STATE) return;
    STATE.paused = !STATE.paused;
    const btn = HUD_ROOT!.querySelector("[data-hud-pause]") as HTMLButtonElement;
    btn.textContent = STATE.paused ? "Resume" : "Pause";
    setStatus(STATE.paused ? "Paused" : "Running");
  });
  HUD_ROOT.querySelector("[data-hud-stop]")?.addEventListener("click", () => {
    if (!STATE) return;
    STATE.stopped = true;
    setStatus("Stopping…", "#b3261e");
  });
  setInterval(updateHud, 500);
}

function unmountHud() {
  HUD_ROOT?.remove();
  HUD_ROOT = null;
}

async function alreadyDmedSet(orgId: string, usernames: string[]): Promise<Set<string>> {
  const sb = await ensureSupabaseClient(STATE?.payload.authSession ?? null);
  const out = new Set<string>();
  for (let i = 0; i < usernames.length; i += 100) {
    const chunk = usernames.slice(i, i + 100);
    const { data } = await sb
      .from("dm_message_logs")
      .select("reddit_username")
      .eq("org_id", orgId)
      .eq("status", "sent")
      .in("reddit_username", chunk);
    (data ?? []).forEach((r: any) => out.add(String(r.reddit_username).toLowerCase()));
  }
  return out;
}

async function logResult(p: StartPayload, username: string, body: string, ok: boolean, reason?: string) {
  const sb = await ensureSupabaseClient(p.authSession ?? STATE?.payload.authSession ?? null);
  await sb.from("dm_message_logs").insert({
    user_id: p.userId,
    org_id: p.orgId,
    campaign_id: p.campaignId,
    reddit_username: username,
    subreddit: p.postSubreddit,
    reddit_url: p.postUrl,
    message_body: body,
    status: ok ? "sent" : "failed",
    error_message: ok ? null : reason ?? null,
    sent_at: ok ? new Date().toISOString() : null,
  });
}

async function runAutopilot(p: StartPayload, resumeState?: State) {
  mountHud();
  await ensureSupabaseClient(p.authSession ?? resumeState?.payload.authSession ?? null);
  if (resumeState) {
    STATE = resumeState;
    STATE.running = true;
    STATE.stopped = false;
    STATE.payload = p;
    STATE.queue = resumeState.queue?.length ? resumeState.queue : buildQueue(p);
  } else {
    const queue = buildQueue(p);
    STATE = {
      running: true, paused: false, stopped: false,
      sent: 0, failed: 0, skipped: 0, total: 0,
      consecutiveErrors: 0,
      cursor: 0,
      queue,
      payload: p,
    };
  }
  await persistState();

  // Build queue: skip OP, skip already DMed
  let queueToRun = STATE.queue.slice();
  if (!resumeState) {
    if (p.skipPostAuthor && p.postAuthor) {
      const op = p.postAuthor.toLowerCase();
      queueToRun = queueToRun.filter((c) => c.username.toLowerCase() !== op);
    }
    if (p.skipIfDmed) {
      setStatus("Checking dedupe…");
      const skip = await alreadyDmedSet(p.orgId, queueToRun.map((c) => c.username));
      STATE.skipped = queueToRun.filter((c) => skip.has(c.username.toLowerCase())).length;
      queueToRun = queueToRun.filter((c) => !skip.has(c.username.toLowerCase()));
    }
    queueToRun = queueToRun.slice(0, p.dmLimit);
    STATE.queue = queueToRun;
    STATE.total = queueToRun.length + STATE.skipped;
    STATE.cursor = 0;
    await persistState();
  } else {
    STATE.total = queueToRun.length + STATE.skipped;
    await persistState();
  }

  if (!queueToRun.length) {
    setStatus("Nothing to send", "#b3261e");
    STATE.running = false;
    await clearPersistedState();
    return;
  }

  setStatus("Running");
  for (let i = STATE.cursor; i < queueToRun.length; i++) {
    const c = queueToRun[i];
    if (STATE.stopped) break;
    while (STATE.paused && !STATE.stopped) await sleep(500);
    if (STATE.stopped) break;
    await waitForUserIdle();

    STATE.current = c.username;
    STATE.cursor = i;
    await persistState();
    updateHud();

    const body = resolveSpintax(p.messageTemplate).replace(/\{username\}/gi, c.username);
    const result = await sendChatTo(c.username, body);

    try {
      await logResult(p, c.username, body, result.ok, result.ok ? undefined : result.reason + ": " + result.message);
    } catch (e) {
      // ignore log errors
    }

    if (result.ok) {
      STATE.sent++;
      STATE.consecutiveErrors = 0;
    } else if (result.reason === "no_chat_button") {
      STATE.skipped++; // user has chat disabled; treat as skip not error
    } else {
      STATE.failed++;
      STATE.consecutiveErrors++;
      STATE.lastError = result.message;
      if (result.reason === "rate_limited") {
        setStatus("Rate limited — waiting 5 min", "#b3261e");
        STATE.nextSendAt = Date.now() + 5 * 60_000;
        for (let i = 0; i < 5 * 60 && !STATE.stopped; i++) await sleep(1000);
        setStatus("Running");
      }
      if (STATE.consecutiveErrors >= 5) {
        setStatus("Stopped: too many errors", "#b3261e");
        break;
      }
    }
    STATE.current = undefined;
    STATE.cursor = i + 1;
    await persistState();

    // Delay before next
    if (!STATE.stopped) {
      const jitter = (0.8 + Math.random() * 0.4); // ±20%
      const ms = Math.max(5, p.delaySec) * 1000 * jitter;
      STATE.nextSendAt = Date.now() + ms;
      await persistState();
      const until = STATE.nextSendAt;
      while (Date.now() < until && !STATE.stopped) {
        if (STATE.paused) { await sleep(500); continue; }
        await sleep(500);
      }
      STATE.nextSendAt = undefined;
      await persistState();
    }
  }

  STATE.running = false;
  setStatus(STATE.stopped ? "Stopped" : "Completed", STATE.stopped ? "#b3261e" : "#137333");
  updateHud();
  if (!STATE.paused) await clearPersistedState();
}

function buildQueue(p: StartPayload): StartPayload["commenters"] {
  let queue = p.commenters.slice();
  if (p.skipPostAuthor && p.postAuthor) {
    const op = p.postAuthor.toLowerCase();
    queue = queue.filter((c) => c.username.toLowerCase() !== op);
  }
  return queue.slice(0, p.dmLimit);
}

async function resumePersistedAutopilot() {
  const stored = await chrome.storage.local.get(AUTOPILOT_STORAGE_KEY);
  const saved = stored[AUTOPILOT_STORAGE_KEY] as State | undefined;
  if (!saved || !saved.running || saved.stopped) return;
  await ensureSupabaseClient(saved.payload.authSession ?? null);
  mountHud();
  setStatus(saved.paused ? "Paused" : "Running");
  runAutopilot(saved.payload, saved).catch((e) => {
    console.error("[redreach] autopilot resume crash", e);
    setStatus("Error: " + (e?.message ?? e), "#b3261e");
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "START_AUTOPILOT") {
    if (STATE?.running) { sendResponse({ ok: false, error: "Already running" }); return; }
    runAutopilot(msg.payload as StartPayload).catch((e) => {
      console.error("[redreach] autopilot crash", e);
      setStatus("Error: " + (e?.message ?? e), "#b3261e");
    });
    sendResponse({ ok: true });
    return;
  }
  if (msg?.type === "AUTOPILOT_STOP") {
    if (STATE) {
      STATE.stopped = true;
      STATE.running = false;
      void persistState();
    }
    sendResponse({ ok: true });
    return;
  }
  if (msg?.type === "AUTOPILOT_PAUSE") {
    if (STATE) {
      STATE.paused = !STATE.paused;
      void persistState();
      sendResponse({ ok: true, paused: STATE.paused });
    }
    else sendResponse({ ok: false });
    return;
  }
  if (msg?.type === "AUTOPILOT_STATUS") {
    sendResponse({ ok: true, state: STATE });
    return;
  }
  return false;
});

console.debug("[redreach] autopilot content script ready");
resumePersistedAutopilot().catch((e) => console.error("[redreach] failed to resume autopilot", e));

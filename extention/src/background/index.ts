// Background service worker: campaign engine.
// Holds in-memory state for the current run; persists progress to chrome.storage.local.
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/config";
import { resolveSpintax } from "@/lib/spintax";
import type { CampaignProgress, CampaignSettings, ThreadScrape, Commenter } from "@/lib/messaging";

type RunState = {
  campaignId: string;
  orgId: string;
  userId: string;
  authSession: { access_token: string; refresh_token: string; expires_at?: number } | null;
  settings: CampaignSettings;
  messageTemplate: string;
  queue: Commenter[];
  cursor: number;
  progress: CampaignProgress;
  paused: boolean;
  stopped: boolean;
  consecutiveErrors: number;
};

let RUN: RunState | null = null;
const PROGRESS_KEY = "redreach.progress";
const AUTH_STORAGE_KEY = "redreach.auth";
let COMPOSE_TAB_ID: number | null = null;
// Track recent click-to-compose intents per tab (tabId -> timestamp)
const RECENT_CLICK_NAV = new Map<number, number>();
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

// Close accidental compose tabs opened with openerTabId shortly after a click nav.
chrome.tabs.onCreated.addListener((tab) => {
  try {
    if (!tab || !tab.id) return;
    const opener = (tab as any).openerTabId as number | undefined;
    if (!opener) return;
    const ts = RECENT_CLICK_NAV.get(opener);
    if (!ts) return;
    if (Date.now() - ts > 2500) return;
    if (tab.url && tab.url.includes('/message/compose')) {
      // Close the accidental new tab; the original tab will navigate and handle compose.
      chrome.tabs.remove(tab.id).catch(() => {});
    }
  } catch (e) { }
});

async function broadcast(progress: CampaignProgress) {
  await chrome.storage.local.set({ [PROGRESS_KEY]: progress });
  chrome.runtime.sendMessage({ type: "PROGRESS_UPDATE", progress }).catch(() => {});
}

async function getCurrentTab(): Promise<chrome.tabs.Tab | null> {
  // Prefer an open Reddit tab; otherwise fall back to active tab.
  const redditTabs = await chrome.tabs.query({ url: '*://*.reddit.com/*' });
  if (redditTabs && redditTabs.length) return redditTabs[0];
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? null;
}

async function scrapeActiveThread(): Promise<ThreadScrape> {
  const tab = await getCurrentTab();
  if (!tab?.id || !tab.url?.includes("reddit.com")) throw new Error("Open a Reddit post first");
  const [injectionResult] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    world: "MAIN",
    func: async (pageUrl: string) => {
      try {
        const url = new URL(pageUrl);
        const parts = url.pathname.split("/").filter(Boolean);
        const idx = parts.indexOf("comments");
        if (idx === -1) return { ok: false, error: "Not on a Reddit post URL" };
        const subreddit = parts[1];
        const postId = parts[idx + 1];
        const slug = parts[idx + 2] ?? "";
        const jsonUrl = `https://www.reddit.com/r/${subreddit}/comments/${postId}/${slug}.json?limit=500&depth=10&sort=top`;
        const res = await fetch(jsonUrl, { credentials: "include", headers: { Accept: "application/json" } });
        if (!res.ok) return { ok: false, error: `Reddit ${res.status}` };
        const data = await res.json();
        const postData = data[0]?.data?.children?.[0]?.data ?? {};
        const commentsListing = data[1]?.data?.children ?? [];
        const BOT_AUTHORS = ["AutoModerator", "[deleted]", "[removed]", "RemindMeBot", "WikiTextBot", "sneakpeekbot", "Mentor-Mediabot"];
        const commenters = [] as any[];
        function walk(children: any[], acc: any[], depth: number) {
          for (const c of children) {
            if (c.kind === "more") continue;
            if (c.kind !== "t1") continue;
            const d = c.data;
            if (!d.author || BOT_AUTHORS.includes(d.author)) {
              // still recurse
            } else if (d.id && d.permalink) {
              acc.push({
                username: d.author,
                comment_id: d.id,
                comment_url: `https://www.reddit.com${d.permalink}`,
                comment_body: (d.body || "").slice(0, 800),
                is_first_level: depth === 0,
              });
            }
            if (d.replies && typeof d.replies === "object" && d.replies.data?.children) {
              walk(d.replies.data.children, acc, depth + 1);
            }
          }
        }
        walk(commentsListing, commenters, 0);
        const seen = new Set();
        const unique = commenters.filter((c) => {
          const k = String(c.username).toLowerCase();
          if (seen.has(k)) return false;
          seen.add(k);
          return true;
        });
        return {
          ok: true,
          data: {
            post_id: postId,
            post_title: postData.title ?? "",
            post_url: `https://www.reddit.com/r/${subreddit}/comments/${postId}/${slug}`,
            post_author: postData.author ?? "",
            post_subreddit: subreddit,
            post_body: (postData.selftext ?? "").slice(0, 4000),
            commenters: unique,
          },
        };
      } catch (e: any) {
        return { ok: false, error: String(e?.message ?? e) };
      }
    },
    args: [tab.url],
  });

  const res: any = injectionResult?.result ?? null;
  if (!res?.ok) throw new Error(res?.error || "Scrape failed");
  return res.data as ThreadScrape;
}

async function preflightDedupe(orgId: string, usernames: string[]): Promise<Set<string>> {
  const sb = await ensureSupabaseClient(RUN?.authSession ?? null);
  const skip = new Set<string>();
  // Batch query in chunks of 100
  for (let i = 0; i < usernames.length; i += 100) {
    const chunk = usernames.slice(i, i + 100);
    const { data } = await sb
      .from("dm_message_logs")
      .select("reddit_username")
      .eq("org_id", orgId)
      .eq("status", "sent")
      .in("reddit_username", chunk);
    (data ?? []).forEach((r: any) => skip.add(String(r.reddit_username).toLowerCase()));
  }
  return skip;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function sendFromTab(tabId: number, username: string, body: string): Promise<{ ok: boolean; reason?: string; body: string }> {
  const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(username)}`;
  await chrome.tabs.update(tabId, { url: composeUrl, active: false });
  await new Promise<void>((resolve) => {
    const listener = (updatedTabId: number, info: chrome.tabs.TabChangeInfo) => {
      if (updatedTabId === tabId && info.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);
        resolve();
      }
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(() => { chrome.tabs.onUpdated.removeListener(listener); resolve(); }, 12_000);
  });

  // Give Reddit time to finish mounting the chat composer before we try to focus it.
  const composeWarmupMs = 8000 + Math.floor(Math.random() * 2000);
  await new Promise<void>((resolve) => setTimeout(resolve, composeWarmupMs));

  const [{ result: sendResult }] = await chrome.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    func: async (subj: string, b: string) => {
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const deepQueryFirst = (selector: string): Element | null => {
        const queue: (Document | ShadowRoot)[] = [document];
        while (queue.length) {
          const root = queue.shift()!;
          const found = root.querySelector(selector);
          if (found) return found;
          for (const el of Array.from(root.querySelectorAll("*"))) {
            const sr = (el as any).shadowRoot as ShadowRoot | null;
            if (sr) queue.push(sr);
          }
        }
        return null;
      };
      const clickElement = (el: Element) => {
        const rect = (el as HTMLElement).getBoundingClientRect();
        const x = rect.left + rect.width / 2;
        const y = rect.top + rect.height / 2;
        const opts: MouseEventInit = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0 };
        try {
          el.dispatchEvent(new PointerEvent("pointerover", { ...opts, pointerType: "mouse", isPrimary: true }));
          el.dispatchEvent(new MouseEvent("mouseover", opts));
          el.dispatchEvent(new MouseEvent("mousemove", opts));
          el.dispatchEvent(new MouseEvent("mousedown", opts));
          (el as HTMLElement).focus?.();
          el.dispatchEvent(new MouseEvent("mouseup", opts));
          el.dispatchEvent(new MouseEvent("click", opts));
          (el as HTMLElement).click?.();
        } catch {}
      };
      const clickTextareaDirectly = (el: HTMLTextAreaElement) => {
        try { el.click(); } catch {}
        try { el.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true, view: window, button: 0 })); } catch {}
        try { el.dispatchEvent(new MouseEvent("mouseup", { bubbles: true, cancelable: true, composed: true, view: window, button: 0 })); } catch {}
        try { el.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, composed: true, view: window, button: 0 })); } catch {}
      };
      const isTextareaFocused = (el: HTMLTextAreaElement): boolean => {
        const root = el.getRootNode();
        return el.matches(":focus") || (root instanceof ShadowRoot && root.activeElement === el) || document.activeElement === el || document.activeElement === (root instanceof ShadowRoot ? root.host : null);
      };
      const focusTextarea = async (el: HTMLTextAreaElement) => {
        const root = el.getRootNode();
        const host = root instanceof ShadowRoot ? (root.host as HTMLElement) : null;
        el.scrollIntoView({ block: "center", inline: "center" });
        host?.scrollIntoView?.({ block: "center", inline: "center" });
        await sleep(100);
        for (let i = 0; i < 4; i++) {
          try { host?.dispatchEvent(new MouseEvent("mousedown", { bubbles: true, cancelable: true, composed: true, view: window })); } catch {}
          try { clickElement(el); } catch {}
          try { el.focus({ preventScroll: true }); } catch { try { el.focus(); } catch {} }
          try { el.dispatchEvent(new FocusEvent("focus", { bubbles: false, composed: true })); } catch {}
          try { el.dispatchEvent(new FocusEvent("focusin", { bubbles: true, composed: true })); } catch {}
          await sleep(150);
          if (isTextareaFocused(el)) {
            console.debug("[redreach] textarea focused", { attempt: i + 1 });
            return;
          }
        }
        console.debug("[redreach] textarea focus retry exhausted", {
          activeTag: document.activeElement?.tagName,
          shadowActive: root instanceof ShadowRoot ? (root.activeElement as HTMLElement | null)?.tagName : null,
        });
      };
      const findComposerHost = (): HTMLElement | null => {
        const host = deepQueryFirst('rs-message-composer');
        return host instanceof HTMLElement ? host : null;
      };
      const composerShadow = (): ShadowRoot | null => findComposerHost()?.shadowRoot ?? null;
      const findMessageTextarea = (): HTMLTextAreaElement | null => {
        const root = composerShadow();
        if (root) {
          const exact = root.querySelector('textarea[name="message"]');
          if (exact instanceof HTMLTextAreaElement) return exact;
          const alt = root.querySelector('textarea[aria-label="Write message" i], textarea[placeholder="Message" i], textarea');
          if (alt instanceof HTMLTextAreaElement) return alt;
        }
        const host = findComposerHost();
        if (host) {
          const fallback = host.querySelector('textarea[name="message"], textarea[aria-label="Write message" i], textarea[placeholder="Message" i], textarea');
          if (fallback instanceof HTMLTextAreaElement) return fallback;
        }
        return null;
      };
      const findMessageForm = (): HTMLFormElement | null => {
        const root = composerShadow();
        if (root) {
          const form = root.querySelector('form');
          if (form instanceof HTMLFormElement) return form;
        }
        const host = findComposerHost();
        if (host) {
          const form = host.querySelector('form');
          if (form instanceof HTMLFormElement) return form;
        }
        return null;
      };
      const setValue = (el: HTMLInputElement | HTMLTextAreaElement | HTMLElement, value: string) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          setter?.call(el, value);
          el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, data: value, inputType: "insertText" }));
          el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, composed: true, data: value, inputType: "insertText" }));
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
        el.textContent = value;
        el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
      };
      const typeValue = async (el: HTMLInputElement | HTMLTextAreaElement | HTMLElement, value: string) => {
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
          el.focus();
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
          for (let i = 1; i <= value.length; i++) {
            setter?.call(el, value.slice(0, i));
            try { el.setSelectionRange(value.length, value.length); } catch {}
            el.dispatchEvent(new InputEvent("beforeinput", { bubbles: true, cancelable: true, data: value[i - 1], inputType: "insertText" }));
            el.dispatchEvent(new InputEvent("input", { bubbles: true, cancelable: true, composed: true, data: value[i - 1], inputType: "insertText" }));
            await sleep(20 + Math.random() * 40);
          }
          el.dispatchEvent(new Event("change", { bubbles: true }));
          return;
        }
        const h = el as HTMLElement;
        h.focus();
        try {
          const sel = window.getSelection();
          const range = document.createRange();
          range.selectNodeContents(h);
          sel?.removeAllRanges();
          sel?.addRange(range);
          document.execCommand("delete", false);
        } catch {}
        for (const ch of value) {
          try {
            document.execCommand("insertText", false, ch);
          } catch {
            h.textContent = (h.textContent || "") + ch;
          }
          h.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
          await sleep(20 + Math.random() * 40);
        }
      };
      const waitFor = async <T extends Element>(selector: string, timeoutMs = 8000): Promise<T | null> => {
        const start = Date.now();
        while (Date.now() - start < timeoutMs) {
          const el = document.querySelector<T>(selector);
          if (el) return el;
          await new Promise((r) => setTimeout(r, 200));
        }
        return null;
      };

      const waitForTextareaPhases = async (): Promise<HTMLTextAreaElement | null> => {
        const phases = [10_000, 15_000, 20_000];
        for (const phaseMs of phases) {
          const phaseStart = Date.now();
          console.debug("[redreach] waiting for compose textarea", { phaseMs });
          while (Date.now() - phaseStart < phaseMs) {
            const textarea = findMessageTextarea();
            if (textarea) {
              console.debug("[redreach] compose textarea found", { phaseMs, name: textarea.getAttribute("name"), aria: textarea.getAttribute("aria-label") });
              return textarea;
            }
            await sleep(250);
          }
        }
        console.debug("[redreach] compose textarea not found after staged waits");
        return null;
      };

      const subject = await waitFor<HTMLInputElement>(
        'input[name="subject"], input[name="title"], input[placeholder*="subject" i], input[placeholder*="title" i]'
      );
      const textarea = await waitForTextareaPhases();

      if (subject) {
        clickElement(subject);
        await typeValue(subject, subj || "Hey");
      }
      if (!textarea) return { ok: false, reason: "error", message: "compose body field not found" };
      const exactTextareaCandidate = findMessageTextarea() || textarea;
      if (!(exactTextareaCandidate instanceof HTMLTextAreaElement)) {
        return { ok: false, reason: "error", message: "compose body field is not a textarea" };
      }
      const exactTextarea = exactTextareaCandidate;
      console.debug("[redreach] compose exact textarea", {
        tag: exactTextarea.tagName,
        name: exactTextarea.getAttribute("name"),
        aria: exactTextarea.getAttribute("aria-label"),
      });

      // Reddit sometimes re-renders composer immediately after mount; pause before final focus.
      await sleep(2200 + Math.floor(Math.random() * 800));
      await focusTextarea(exactTextarea);
      clickTextareaDirectly(exactTextarea);
      await sleep(150);
      clickTextareaDirectly(exactTextarea);
      await sleep(150);
      await typeValue(exactTextarea, b);
      await sleep(250);
      const writtenOnce = (exactTextarea.value || exactTextarea.textContent || "").trim();
      if (writtenOnce !== b.trim()) {
        await focusTextarea(exactTextarea);
        setValue(exactTextarea, b);
        await sleep(250);
      }
      const written = (exactTextarea.value || exactTextarea.textContent || "").trim();
      if (!written) {
        return { ok: false, reason: "error", message: "compose body was not written" };
      }
      await new Promise((r) => setTimeout(r, 700));

      const collectButtons = (): Element[] => {
        const out: Element[] = [];
        const queue: (Document | ShadowRoot)[] = [document];
        while (queue.length) {
          const root = queue.shift()!;
          out.push(...Array.from(root.querySelectorAll('button, input[type="submit"], [role="button"]')));
          for (const el of Array.from(root.querySelectorAll("*"))) {
            const sr = (el as any).shadowRoot as ShadowRoot | null;
            if (sr) queue.push(sr);
          }
        }
        return out;
      };
      const buttons = collectButtons();
      const textMatch = (el: Element) => ((el.textContent || (el as any).value || (el.getAttribute && el.getAttribute('aria-label')) || '').trim());
      const send = collectButtons().find((x) => /send message/i.test(textMatch(x) + " " + (x.getAttribute("aria-label") || "")))
        || Array.from(document.querySelectorAll('button[aria-label="Send message" i], button[aria-label*="send" i], [data-testid*="send" i]')).find(Boolean as any) as Element | undefined
        || buttons.find((x) => /^send$/i.test(textMatch(x)))
        || buttons.find((x) => /send/i.test(textMatch(x)));
      if (!send) return { ok: false, reason: "error", message: "send button not found" };

      // Wait briefly for Reddit/React to enable the send button after input events.
      const sendButton = send as HTMLButtonElement;
      const startEnableWait = Date.now();
      while (sendButton.disabled && Date.now() - startEnableWait < 3000) {
        await sleep(100);
      }
      if (sendButton.disabled) {
        try { sendButton.removeAttribute("disabled"); } catch {}
      }

      const currentBody = (exactTextarea.value || exactTextarea.textContent || "").trim();
      if (!currentBody) {
        return { ok: false, reason: "error", message: "compose body is empty before submit" };
      }

      try { (send as HTMLElement).click(); } catch (e) { send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, composed: true })); }
      try { exactTextarea.form?.requestSubmit(); } catch {}
      if (!location.pathname.includes("/message/messages") && !location.pathname.includes("/message/sent")) {
        const form = findMessageForm();
        if (form instanceof HTMLFormElement) {
          console.debug("[redreach] submitting compose form");
          try { form.requestSubmit(); } catch { form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })); }
        }
      }

      const start = Date.now();
      while (Date.now() - start < 12_000) {
        await new Promise((r) => setTimeout(r, 350));
        const lower = document.body.innerText.toLowerCase();
        if (lower.includes("you are doing that too much") || lower.includes("rate limit")) {
          return { ok: false, reason: "rate_limited", message: "rate limited" };
        }
        if (location.pathname.includes("/message/messages") || location.pathname.includes("/message/sent")) {
          return { ok: true };
        }
        const remaining = document.querySelector('textarea[name="message"], textarea[name="text"], textarea') as HTMLTextAreaElement | null;
        if (remaining && remaining.value.trim() === "") return { ok: true };
      }
      return { ok: false, reason: "error", message: "timeout waiting for send confirmation" };
    },
    args: ["Hey", body],
  });
  const r = sendResult as any;
  return { ok: !!r?.ok, reason: r?.reason ?? r?.message, body };
}

async function sendOne(commenter: Commenter): Promise<{ ok: boolean; reason?: string; body: string }> {
  if (!RUN) throw new Error("no run");
  const body = resolveSpintax(RUN.messageTemplate);
  if (RUN.settings.dry_run) {
    await sleep(300);
    return { ok: true, body };
  }
  // Reuse a dedicated compose tab to avoid creating many tabs.
  let tab: chrome.tabs.Tab | undefined | null = null;
  try {
    if (COMPOSE_TAB_ID != null) {
      const tabs = await chrome.tabs.get(COMPOSE_TAB_ID).catch(() => null);
      if (tabs) tab = tabs;
      else COMPOSE_TAB_ID = null;
    }
  } catch { COMPOSE_TAB_ID = null; }
  if (!tab) {
    const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(commenter.username)}`;
    tab = await chrome.tabs.create({ url: composeUrl, active: false });
    if (tab?.id) COMPOSE_TAB_ID = tab.id;
  } else {
    // Update URL to the desired compose for this username and keep tab background.
    const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(commenter.username)}`;
    await chrome.tabs.update(COMPOSE_TAB_ID!, { url: composeUrl, active: false });
  }
  try {
    return await sendFromTab(COMPOSE_TAB_ID!, commenter.username, body);
  } finally {
    // keep compose tab open for reuse; do not remove it.
  }
}

async function runLoop() {
  if (!RUN) return;
  const sb = await ensureSupabaseClient(RUN.authSession);
  const dailyLimit = RUN.settings.daily_limit || RUN.settings.dm_limit;
  while (!RUN.stopped && RUN.cursor < RUN.queue.length && RUN.progress.sent < RUN.settings.dm_limit && RUN.progress.sent < dailyLimit) {
    if (RUN.paused) { await sleep(1500); continue; }
    const lead = RUN.queue[RUN.cursor++];
    RUN.progress.current_user = lead.username;
    await broadcast(RUN.progress);

    const result = await sendOne(lead);
    if (result.ok) {
      RUN.progress.sent++;
      RUN.consecutiveErrors = 0;
      await sb.from("dm_message_logs").insert({
        user_id: RUN.userId, org_id: RUN.orgId, campaign_id: RUN.campaignId,
        reddit_username: lead.username, subreddit: RUN.queue[0] ? undefined : undefined,
        message_body: result.body, status: RUN.settings.dry_run ? "dry_run" : "sent",
        sent_at: new Date().toISOString(),
      });
      await sb.from("dm_leads").update({ status: "DM Sent", contacted_at: new Date().toISOString() })
        .eq("campaign_id", RUN.campaignId).eq("reddit_username", lead.username);
    } else {
      RUN.progress.failed++;
      RUN.consecutiveErrors++;
      await sb.from("dm_message_logs").insert({
        user_id: RUN.userId, org_id: RUN.orgId, campaign_id: RUN.campaignId,
        reddit_username: lead.username, message_body: result.body,
        status: "failed", error_message: result.reason ?? "unknown",
      });
      if (result.reason === "rate_limited") {
        RUN.progress.status = "rate_limited";
        await broadcast(RUN.progress);
        await sleep(5 * 60_000); // 5 min backoff
        RUN.progress.status = "running";
      }
      if (RUN.consecutiveErrors >= 5) {
        RUN.progress.status = "error";
        RUN.progress.last_error = "Too many consecutive failures";
        await broadcast(RUN.progress);
        return;
      }
    }
    RUN.progress.remaining = RUN.queue.length - RUN.cursor;
    const delay = (RUN.settings.delay_min_sec + Math.random() * (RUN.settings.delay_max_sec - RUN.settings.delay_min_sec)) * 1000;
    RUN.progress.next_send_at = Date.now() + delay;
    await broadcast(RUN.progress);
    await sleep(delay);
  }
  RUN.progress.status = RUN.stopped ? "idle" : "completed";
  RUN.progress.current_user = undefined;
  if (!RUN.stopped && RUN.progress.sent >= dailyLimit && RUN.progress.sent < RUN.settings.dm_limit) {
    RUN.progress.last_error = `Daily limit reached (${dailyLimit})`;
  }
  await broadcast(RUN.progress);
}

async function startCampaign(payload: { campaignId: string; settings: CampaignSettings; messageTemplate: string; authSession?: { access_token: string; refresh_token: string; expires_at?: number } | null }) {
  const sb = await ensureSupabaseClient(payload.authSession ?? null);
  const { data: ures } = await sb.auth.getUser();
  if (!ures.user) throw new Error("Not signed in");
  const { data: camp, error } = await sb.from("dm_campaigns").select("*").eq("id", payload.campaignId).single();
  if (error || !camp) throw new Error(error?.message || "Campaign not found");

  const progress: CampaignProgress = {
    status: "scraping", campaign_id: camp.id, total: 0, sent: 0, failed: 0, skipped: 0, remaining: 0,
  };
  RUN = {
    campaignId: camp.id, orgId: camp.org_id, userId: ures.user.id,
    authSession: payload.authSession ?? await loadStoredAuthSession(),
    settings: payload.settings, messageTemplate: payload.messageTemplate,
    queue: [], cursor: 0, progress, paused: false, stopped: false, consecutiveErrors: 0,
  };
  await broadcast(progress);

  const scrape = await scrapeActiveThread();
  progress.status = "queueing";
  await broadcast(progress);

  let commenters = scrape.commenters;
  if (payload.settings.skip_post_author && scrape.post_author) {
    commenters = commenters.filter((c) => c.username.toLowerCase() !== scrape.post_author.toLowerCase());
  }
  if (payload.settings.first_level_only) commenters = commenters.filter((c) => c.is_first_level);

  if (payload.settings.skip_if_dmed) {
    const skip = await preflightDedupe(camp.org_id, commenters.map((c) => c.username));
    progress.skipped = commenters.filter((c) => skip.has(c.username.toLowerCase())).length;
    commenters = commenters.filter((c) => !skip.has(c.username.toLowerCase()));
  }

  // Persist as dm_leads (status 'pending')
  if (commenters.length) {
    const rows = commenters.map((c) => ({
      campaign_id: camp.id, org_id: camp.org_id, user_id: ures.user!.id,
      reddit_username: c.username, comment_id: c.comment_id, comment_url: c.comment_url,
      comment_body: c.comment_body, post_title: scrape.post_title, post_url: scrape.post_url,
      subreddit: scrape.post_subreddit, status: "pending", is_first_level: c.is_first_level,
    }));
    for (let i = 0; i < rows.length; i += 100) {
      await sb.from("dm_leads").insert(rows.slice(i, i + 100));
    }
  }

  RUN.queue = commenters;
  progress.total = commenters.length;
  progress.remaining = commenters.length;
  progress.status = "running";
  await broadcast(progress);
  runLoop();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  (async () => {
    try {
      // Track click->compose navigations from content scripts so we can close accidental tabs.
      if (msg?.type === 'CLICK_NAV') {
        try {
          const tabId = _sender.tab?.id;
          if (tabId) RECENT_CLICK_NAV.set(tabId, Date.now());
        } catch (e) { }
        sendResponse({ ok: true });
        return;
      }
      if (msg?.type === "START_CAMPAIGN") {
        await startCampaign(msg);
        sendResponse({ ok: true });
      } else if (msg?.type === "PAUSE_CAMPAIGN") {
        if (RUN) { RUN.paused = true; RUN.progress.status = "paused"; await broadcast(RUN.progress); }
        sendResponse({ ok: true });
      } else if (msg?.type === "RESUME_CAMPAIGN") {
        if (RUN) { RUN.paused = false; RUN.progress.status = "running"; await broadcast(RUN.progress); }
        sendResponse({ ok: true });
      } else if (msg?.type === "STOP_CAMPAIGN") {
        if (RUN) { RUN.stopped = true; RUN.progress.status = "idle"; await broadcast(RUN.progress); }
        sendResponse({ ok: true });
      } else if (msg?.type === "GET_PROGRESS") {
        const stored = await chrome.storage.local.get(PROGRESS_KEY);
        sendResponse({ ok: true, progress: stored[PROGRESS_KEY] ?? null });
      } else if (msg?.type === "CLICK_TO_DM") {
        try {
          const username = msg.username as string;
          const tabId = _sender.tab?.id;
          const body = resolveSpintax(RUN?.messageTemplate ?? "{Hey|Hi}");
          const result = tabId
            ? await sendFromTab(tabId, username, body)
            : await sendOne({ username } as any);
          sendResponse({ ok: true, result });
        } catch (e: any) {
          sendResponse({ ok: false, error: String(e?.message ?? e) });
        }
      } else if (msg?.type === "SCRAPE_THREAD") {
        sendResponse({ ok: true, data: await scrapeActiveThread() });
      }
    } catch (e: any) {
      sendResponse({ ok: false, error: String(e?.message ?? e) });
    }
  })();
  return true;
});

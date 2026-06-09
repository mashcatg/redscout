// Drives Reddit's in-page Chat flow:
//  1) find the username anchor for the right comment (not avatar)
//  2) hover/click to open the faceplate-hovercard popover
//  3) click "Start Chat" inside the popover
//  4) wait for the chat composer to mount (normal OR invite state)
//  5) type message + click Send
//  6) close the drawer

import {
  clickAt,
  deepQueryAll,
  deepQueryFirst,
  moveCursorTo,
  moveCursorToElement,
  moveCursorToRect,
  nativeSet,
  setContentEditable,
  typeText,
  sleep,
  waitFor,
} from "./fake-cursor";

const LOG = (...args: any[]) => console.debug("[redreach]", ...args);

export type ChatSendResult =
  | { ok: true }
  | { ok: false; reason: "no_chat_button" | "no_composer" | "no_send" | "rate_limited" | "blocked" | "timeout" | "error"; message: string };

function textOf(el: Element): string {
  return (el.textContent || (el as HTMLElement).getAttribute?.("aria-label") || "").trim();
}

function isVisibleRect(el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 4 || r.height <= 4) return false;
  const cs = (el.ownerDocument?.defaultView || window).getComputedStyle(el as Element);
  if (cs.visibility === "hidden" || cs.display === "none" || parseFloat(cs.opacity || "1") < 0.05) return false;
  return true;
}

/**
 * Find the username anchor for a given username, preferring an anchor whose
 * visible text matches `u/username` or `username` (i.e. the textual username
 * link, NOT the avatar/image link that also points at /user/<name>).
 */
function findUsernameAnchor(username: string): HTMLAnchorElement | null {
  const target = username.toLowerCase();
  const anchors = deepQueryAll(
    (el) => el.tagName === "A" && /\/user\//i.test((el as HTMLAnchorElement).getAttribute("href") || ""),
  ) as HTMLAnchorElement[];

  const candidates: { a: HTMLAnchorElement; score: number }[] = [];
  for (const a of anchors) {
    const href = a.getAttribute("href") || "";
    const m = href.match(/\/user\/([^/?#]+)/i);
    if (!m || m[1].toLowerCase() !== target) continue;
    if (!isVisibleRect(a)) continue;
    const t = (a.textContent || "").trim().toLowerCase();
    // Avatar links typically have no/empty text and only contain <img>/<faceplate-img>
    const hasImg = !!a.querySelector("img, faceplate-img, svg");
    const hasText = !!t && (t === target || t === `u/${target}` || t.includes(target));
    let score = 0;
    if (hasText) score += 100;
    if (!hasImg && t) score += 30; // pure text anchor
    if (hasImg && !hasText) score -= 50; // avatar-only
    // Boost anchors inside a comment node
    if (a.closest("shreddit-comment, [data-testid='comment'], faceplate-tracker[source*='comment']")) score += 10;
    candidates.push({ a, score });
  }
  if (!candidates.length) return null;
  candidates.sort((x, y) => y.score - x.score);
  LOG("anchor candidates for", username, candidates.map((c) => ({ score: c.score, txt: (c.a.textContent || "").trim().slice(0, 40) })));
  return candidates[0].a;
}

/** Get the smallest visible text rect inside an anchor (the actual rendered username glyphs). */
function getUsernameTextRect(anchor: HTMLAnchorElement): DOMRect {
  const target = (anchor.textContent || "").trim();
  const usernameMatch = target.match(/u?\/??([A-Za-z0-9_\-]{2,})/);

  // Prefer finding the exact substring range for the visible username.
  const walker = document.createTreeWalker(anchor, NodeFilter.SHOW_TEXT);
  let node: Node | null = walker.nextNode();
  const rects: DOMRect[] = [];
  while (node) {
    const t = node.textContent || "";
    if (!t.trim()) { node = walker.nextNode(); continue; }
    // If we can find the username substring inside this text node, create a ranged rect
    if (usernameMatch) {
      const username = usernameMatch[1];
      const lower = t.toLowerCase();
      const idx = lower.indexOf(username.toLowerCase());
      if (idx >= 0) {
        try {
          const range = document.createRange();
          range.setStart(node, idx);
          range.setEnd(node, idx + username.length);
          const r = range.getBoundingClientRect();
          if (r.width > 0 && r.height > 0) rects.push(r);
        } catch {}
      }
    }
    // fallback: whole-node rect
    try {
      const range = document.createRange();
      range.selectNodeContents(node);
      const r = range.getBoundingClientRect();
      if (r.width > 0 && r.height > 0) rects.push(r);
    } catch {}
    node = walker.nextNode();
  }

  if (!rects.length) return anchor.getBoundingClientRect();
  // Prefer the smallest rect that still has reasonable area (username glyphs are narrow)
  rects.sort((a, b) => (a.width * a.height) - (b.width * b.height));
  return rects[0];
}

function findHovercardFor(username: string): HTMLElement | null {
  const target = username.toLowerCase();
  // Tier 1: faceplate-hovercard popovers (the actual Reddit web component popover)
  const popoverCandidates = deepQueryAll((el) => {
    const tag = el.tagName.toLowerCase();
    if (tag === "faceplate-hovercard") return true;
    if (el.getAttribute("role") === "dialog") return true;
    const tid = (el.getAttribute("data-testid") || "").toLowerCase();
    if (/hovercard|profile-card|user-card|user-hover/.test(tid)) return true;
    const cls = (el.getAttribute("class") || "").toLowerCase();
    if (/hovercard|profile-card|user-hover/.test(cls)) return true;
    return false;
  }) as HTMLElement[];

  for (const h of popoverCandidates) {
    if (!isVisibleRect(h)) continue;
    const link = h.querySelector(`a[href*="/user/${username}" i]`);
    const txt = (h.textContent || "").toLowerCase();
    // Hovercard must (a) reference the username AND (b) actually contain interactive content
    if (link || txt.includes(target) || txt.includes(`u/${target}`)) {
      // Must have buttons (Start Chat / Follow / etc.) — otherwise it's the anchor's own wrapper
      if (h.querySelector("button, [role='button']")) return h;
    }
  }
  return null;
}

function dispatchHoverSequence(target: Element, x: number, y: number) {
  const opts: MouseEventInit = {
    bubbles: true, cancelable: true, composed: true, view: window,
    clientX: x, clientY: y, button: 0,
  };
  const pOpts: PointerEventInit = { ...opts, pointerType: "mouse", isPrimary: true };
  try {
    target.dispatchEvent(new PointerEvent("pointerover", pOpts));
    target.dispatchEvent(new PointerEvent("pointerenter", pOpts));
    target.dispatchEvent(new MouseEvent("mouseover", opts));
    target.dispatchEvent(new MouseEvent("mouseenter", opts));
    target.dispatchEvent(new PointerEvent("pointermove", pOpts));
    target.dispatchEvent(new MouseEvent("mousemove", opts));
  } catch {}
}

function fireHoverOnAllAncestors(anchor: HTMLAnchorElement, x: number, y: number) {
  // Reddit's hovercard listener can live on the anchor, faceplate-tracker, OR faceplate-hovercard wrapper.
  // Walk up and fire hover on each potentially-bound node.
  const targets: Element[] = [];
  // Also include the actual element at point (the inner text span)
  const hit = document.elementFromPoint(x, y);
  if (hit) targets.push(hit);
  targets.push(anchor);
  let el: Element | null = anchor;
  for (let i = 0; i < 6 && el; i++) {
    el = el.parentElement;
    if (!el) break;
    const tag = el.tagName.toLowerCase();
    if (tag === "faceplate-tracker" || tag === "faceplate-hovercard" || tag === "faceplate-perfmark") {
      targets.push(el);
    }
  }
  // Dedupe
  const uniq = Array.from(new Set(targets));
  for (const t of uniq) dispatchHoverSequence(t, x, y);
}

/** Click an anchor while suppressing navigation (capture-phase preventDefault + temp href removal). */
async function clickWithoutNavigation(anchor: HTMLAnchorElement, x: number, y: number) {
  // Prevent navigation but allow Reddit's own click handlers to run.
  const blocker = (e: Event) => { e.preventDefault(); };
  const navBlock = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ""; };
  document.addEventListener("click", blocker, { capture: true });
  window.addEventListener("beforeunload", navBlock, { capture: true });
  const origHref = anchor.getAttribute("href");
  const origTarget = anchor.getAttribute("target");
  try {
    anchor.setAttribute("data-redreach-href", origHref || "");
    anchor.removeAttribute("href");
  } catch {}
  const opts: MouseEventInit = { bubbles: true, cancelable: true, composed: true, view: window, clientX: x, clientY: y, button: 0 };
  const pOpts: PointerEventInit = { ...opts, pointerType: "mouse", isPrimary: true };
  try {
    anchor.dispatchEvent(new PointerEvent("pointerdown", pOpts));
    anchor.dispatchEvent(new MouseEvent("mousedown", opts));
    await sleep(60);
    anchor.dispatchEvent(new PointerEvent("pointerup", pOpts));
    anchor.dispatchEvent(new MouseEvent("mouseup", opts));
    anchor.dispatchEvent(new MouseEvent("click", opts));
  } catch {}
  setTimeout(() => {
    try {
      if (origHref != null) anchor.setAttribute("href", origHref);
      if (origTarget != null) anchor.setAttribute("target", origTarget);
      anchor.removeAttribute("data-redreach-href");
      document.removeEventListener("click", blocker, { capture: true } as any);
      window.removeEventListener("beforeunload", navBlock, { capture: true } as any);
    } catch {}
  }, 250);
  await sleep(80);
}

async function openUserHovercard(anchor: HTMLAnchorElement, username: string): Promise<HTMLElement | null> {
  anchor.scrollIntoView({ block: "center", inline: "center", behavior: "smooth" });
  await sleep(500);

  // Re-measure AFTER scrolling
  const rect = getUsernameTextRect(anchor);
  LOG("hover target rect", { username, x: rect.left, y: rect.top, w: rect.width, h: rect.height });

  await moveCursorToRect(rect, 650);
  await sleep(180);

  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  // Pass 1: hover on the whole ancestor chain
  fireHoverOnAllAncestors(anchor, cx, cy);
  const hoverHit = await waitFor<HTMLElement>(() => findHovercardFor(username), 1500);
  if (hoverHit) { LOG("hovercard opened via hover"); return hoverHit; }

  // Pass 2: click the username (suppress navigation). Reddit also opens hovercard on click for some variants.
  LOG("hover did not open popover; trying click fallback");
  await clickWithoutNavigation(anchor, cx, cy);
  await sleep(300);
  fireHoverOnAllAncestors(anchor, cx, cy);
  const clickHit = await waitFor<HTMLElement>(() => findHovercardFor(username), 3500);
  if (clickHit) { LOG("hovercard opened via click"); return clickHit; }

  // Pass 3: try a small jitter and re-hover (some hovercards require movement)
  LOG("retrying hover with jitter");
  // Try multiple sample points across the username rect: start, middle, end
  const samples = [
    { x: rect.left + Math.max(2, rect.width * 0.1), y: rect.top + rect.height / 2 },
    { x: cx, y: cy },
    { x: rect.right - Math.max(2, rect.width * 0.1), y: rect.top + rect.height / 2 },
  ];
  for (const s of samples) {
    await moveCursorTo(s.x, s.y, 180);
    fireHoverOnAllAncestors(anchor, s.x, s.y);
    await sleep(220);
    const tryHit = await waitFor<HTMLElement>(() => findHovercardFor(username), 900);
    if (tryHit) { LOG("hovercard opened via sampled hover", s); return tryHit; }
  }

  // Final fallback: try clicking a series of sample points
  for (const s of samples) {
    await clickWithoutNavigation(anchor, s.x, s.y);
    await sleep(220);
    fireHoverOnAllAncestors(anchor, s.x, s.y);
    const tryHit = await waitFor<HTMLElement>(() => findHovercardFor(username), 900);
    if (tryHit) { LOG("hovercard opened via sampled click", s); return tryHit; }
  }

  // Aggressive sweep fallback: move across the username rect in small steps
  LOG("starting aggressive sweep across username rect", { username, rect });
  const steps = Math.max(5, Math.min(18, Math.floor(rect.width / 8)));
  for (let i = 0; i <= steps; i++) {
    const t = i / Math.max(1, steps);
    const sx = rect.left + Math.max(2, rect.width * 0.05) + t * (rect.width - Math.max(4, rect.width * 0.1));
    // add slight y jitter to hit different event listeners
    const sy = rect.top + rect.height / 2 + ((i % 2 === 0) ? -2 : 2);
    LOG("sweep-step", { i, sx: Math.round(sx), sy: Math.round(sy) });
    await moveCursorTo(sx, sy, 120);
    // try hover first
    fireHoverOnAllAncestors(anchor, sx, sy);
    await sleep(150);
    // inspect element at point for debugging
    try {
      const hit = document.elementFromPoint(Math.round(sx), Math.round(sy));
      LOG("elementFromPoint at sweep", { i, tag: hit?.tagName, cls: hit?.getAttribute?.("class"), text: (hit?.textContent||"").slice(0,40) });
    } catch (err) { LOG("elementFromPoint error", err); }
    const h = await waitFor<HTMLElement>(() => findHovercardFor(username), 600);
    if (h) { LOG("hovercard opened during sweep", { step: i }); return h; }
    // short click attempt on some steps
    if (i % 3 === 0) {
      LOG("sweep-step-click", { i });
      await clickWithoutNavigation(anchor, sx, sy);
      await sleep(180);
      const hc = await waitFor<HTMLElement>(() => findHovercardFor(username), 700);
      if (hc) { LOG("hovercard opened via sweep-click", { step: i }); return hc; }
    }
  }

  LOG("all hover attempts failed for", username, "rect", rect);
  return null;
}

function findChatButtonIn(root: HTMLElement): HTMLElement | null {
  const stack: (Element | ShadowRoot)[] = [root];
  const buttons: HTMLElement[] = [];
  while (stack.length) {
    const n = stack.pop()!;
    const all = (n as Element | ShadowRoot).querySelectorAll?.("*") ?? [];
    for (const el of Array.from(all)) {
      const tag = el.tagName.toLowerCase();
      const role = el.getAttribute("role");
      if (tag === "button" || tag === "a" || role === "button") buttons.push(el as HTMLElement);
      const sr = (el as any).shadowRoot as ShadowRoot | null;
      if (sr) stack.push(sr);
    }
  }
  const score = (el: HTMLElement): number => {
    const t = textOf(el).toLowerCase();
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    const label = `${t} ${aria}`;
    if (/\bfollow\b/.test(label) && !/chat|message/.test(label)) return -10;
    if (/^start chat$/.test(t) || /\bstart chat\b/.test(label)) return 100;
    if (/^chat$/.test(t) || /\bchat\b/.test(aria) || /^chat\b/.test(t)) return 80;
    if (/\bmessage\b/.test(label) || /send a message/.test(label)) return 50;
    return 0;
  };
  let best: HTMLElement | null = null;
  let bestScore = 0;
  for (const b of buttons) {
    if (!isVisibleRect(b)) continue;
    const s = score(b);
    if (s > bestScore) { bestScore = s; best = b; }
  }
  if (best) LOG("chat button picked:", textOf(best).slice(0, 40), "score", bestScore);
  return best;
}

async function findChatButton(hovercard: HTMLElement): Promise<HTMLElement | null> {
  return await waitFor<HTMLElement>(() => findChatButtonIn(hovercard), 4500);
}

async function findComposer(): Promise<HTMLElement | null> {
  return await waitFor<HTMLElement>(() => {
    const exactTextarea = deepQueryFirst((el) => {
      if (el.tagName !== "TEXTAREA") return false;
      if ((el as HTMLTextAreaElement).getAttribute("name") === "message") return true;
      const ph = ((el as HTMLTextAreaElement).placeholder || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return ph === "message" || aria.includes("write message");
    });
    if (exactTextarea && isVisibleRect(exactTextarea)) return exactTextarea as HTMLElement;

    // Prefer composers inside a chat drawer / dialog
    const ce = deepQueryFirst((el) => {
      if (!(el as HTMLElement).isContentEditable) return false;
      const role = (el.getAttribute("role") || "").toLowerCase();
      const ph = ((el as HTMLElement).getAttribute("aria-label") || (el as HTMLElement).getAttribute("placeholder") || "").toLowerCase();
      if (role === "textbox") return true;
      return /message|chat|type|invite|start chatting/.test(ph);
    });
    if (ce && isVisibleRect(ce)) return ce as HTMLElement;
    const ta = deepQueryFirst((el) => {
      if (el.tagName !== "TEXTAREA") return false;
      const ph = ((el as HTMLTextAreaElement).placeholder || "").toLowerCase();
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      return /message|chat|invite/.test(ph + " " + aria) || !ph; // first textarea in drawer
    });
    if (ta && isVisibleRect(ta)) return ta as HTMLElement;
    return null;
  }, 20000);
}

async function findSendButton(): Promise<HTMLElement | null> {
  return await waitFor<HTMLElement>(() => {
    const candidates = deepQueryAll((el) => {
      const tag = el.tagName.toLowerCase();
      if (!(tag === "button" || el.getAttribute("role") === "button")) return false;
      const aria = (el.getAttribute("aria-label") || "").toLowerCase();
      const t = textOf(el).toLowerCase();
      if (/^send$/.test(t) || /send message|send invite|send now/.test(t)) return true;
      if (/\bsend\b/.test(aria)) return true;
      const tid = (el.getAttribute("data-testid") || "").toLowerCase();
      if (tid.includes("send")) return true;
      return false;
    }) as HTMLElement[];
    const enabled = candidates.find((b) => !(b as HTMLButtonElement).disabled && isVisibleRect(b));
    return enabled || candidates[0] || null;
  }, 6000);
}

function pageContainsRateLimit(): boolean {
  const t = (document.body.innerText || "").toLowerCase();
  return /doing that too much|rate.?limit|try again later/.test(t);
}
function pageContainsBlocked(): boolean {
  const t = (document.body.innerText || "").toLowerCase();
  return /cannot send|not allowed|blocked you|can't send|unable to send/.test(t);
}

async function closeChatDrawer() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await sleep(200);
  const close = deepQueryFirst((el) => {
    const tag = el.tagName.toLowerCase();
    if (!(tag === "button" || el.getAttribute("role") === "button")) return false;
    const aria = (el.getAttribute("aria-label") || "").toLowerCase();
    return /close/.test(aria);
  });
  if (close) { try { (close as HTMLElement).click(); } catch {} }
}

function getComposerValue(c: HTMLElement): string {
  if (c.tagName === "TEXTAREA" || c.tagName === "INPUT") return (c as HTMLTextAreaElement).value || "";
  return c.textContent || "";
}

export async function sendChatTo(username: string, message: string): Promise<ChatSendResult> {
  try {
    LOG("sendChatTo", username);
    const anchor = findUsernameAnchor(username);
    if (!anchor) {
      LOG("no anchor for", username);
      return { ok: false, reason: "no_chat_button", message: `u/${username} not found on page` };
    }

    const hovercard = await openUserHovercard(anchor, username);
    if (!hovercard) {
      LOG("no hovercard opened for", username);
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return { ok: false, reason: "no_chat_button", message: "Hovercard did not open" };
    }

    let chatBtn = await findChatButton(hovercard);
    if (!chatBtn) {
      // re-hover & retry once
      const rect = getUsernameTextRect(anchor);
      await moveCursorToRect(rect, 300);
      fireHoverOnAllAncestors(anchor, rect.left + rect.width / 2, rect.top + rect.height / 2);
      await sleep(500);
      chatBtn = await findChatButton(hovercard);

      await sleep(5000);
    }
    if (!chatBtn) {
      LOG("no chat button inside hovercard");
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      return { ok: false, reason: "no_chat_button", message: "Start chat button not visible (user may have chat disabled)" };
    }

    await moveCursorToElement(chatBtn, 550);
    await sleep(180);
    await clickAt(chatBtn);
    LOG("clicked chat button");

    await sleep(5000);

    const composer = await findComposer();
    if (!composer) {
      LOG("composer never mounted");
      return { ok: false, reason: "no_composer", message: "Chat composer did not open" };
    }
    LOG("composer found:", composer.tagName, composer.getAttribute("aria-label") || composer.getAttribute("placeholder") || "");

    await clickAt(composer);
    (composer as HTMLElement).focus();
    if (composer.tagName === "TEXTAREA" || composer.tagName === "INPUT") {
      nativeSet(composer as HTMLTextAreaElement, message);
    } else {
      setContentEditable(composer as HTMLElement, message);
    }

    const typed = getComposerValue(composer);
    if (!typed.trim()) {
      LOG("composer empty after typing; retrying");
      (composer as HTMLElement).focus();
      if (composer.tagName === "TEXTAREA" || composer.tagName === "INPUT") {
        nativeSet(composer as HTMLTextAreaElement, message);
      } else {
        setContentEditable(composer as HTMLElement, message);
      }
    }

    const confirmed = getComposerValue(composer);
    if (!confirmed.trim()) {
      return { ok: false, reason: "error", message: "compose body was not written" };
    }

    const send = await findSendButton();
    if (!send) return { ok: false, reason: "no_send", message: "Send button not found" };
    await moveCursorToElement(send, 450);
    await sleep(180);

    const bodyBeforeSend = getComposerValue(composer);
    if (!bodyBeforeSend.trim()) {
      return { ok: false, reason: "error", message: "compose body is empty before submit" };
    }

    await clickAt(send);
    LOG("clicked send");

    const start = Date.now();
    while (Date.now() - start < 10000) {
      await sleep(400);
      if (pageContainsRateLimit()) { await closeChatDrawer(); return { ok: false, reason: "rate_limited", message: "Reddit rate-limited" }; }
      if (pageContainsBlocked()) { await closeChatDrawer(); return { ok: false, reason: "blocked", message: "Reddit blocked send" }; }
      const val = getComposerValue(composer);
      if (!val.trim()) {
        await sleep(400);
        await closeChatDrawer();
        LOG("send OK for", username);
        return { ok: true };
      }
    }
    await closeChatDrawer();
    return { ok: false, reason: "timeout", message: "Timed out waiting for send confirmation" };
  } catch (e: any) {
    LOG("sendChatTo error", e);
    return { ok: false, reason: "error", message: String(e?.message ?? e) };
  }
}

// Visible fake cursor + synthetic click helpers.
// All elements live on top of the page via a very high z-index and pointer-events:none.

const CURSOR_ID = "redreach-fake-cursor";
const RING_ID = "redreach-fake-cursor-ring";

let pos = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
let userActiveUntil = 0;

function ensureCursor() {
  let el = document.getElementById(CURSOR_ID) as HTMLDivElement | null;
  if (el) return el;
  el = document.createElement("div");
  el.id = CURSOR_ID;
  el.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:22px",
    "height:22px",
    "z-index:2147483647",
    "pointer-events:none",
    "transition:transform 60ms linear",
    "will-change:transform",
    `transform:translate(${pos.x}px, ${pos.y}px)`,
  ].join(";");
  el.innerHTML = `
    <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));">
      <path d="M2 2 L2 18 L7 13 L10 20 L13 19 L10 12 L17 12 Z" fill="#ef5b2d" stroke="#fff" stroke-width="1.2" stroke-linejoin="round"/>
    </svg>`;
  document.documentElement.appendChild(el);

  const ring = document.createElement("div");
  ring.id = RING_ID;
  ring.style.cssText = [
    "position:fixed",
    "left:0",
    "top:0",
    "width:28px",
    "height:28px",
    "margin-left:-14px",
    "margin-top:-14px",
    "border-radius:50%",
    "border:2px solid #ef5b2d",
    "z-index:2147483646",
    "pointer-events:none",
    "opacity:0",
    "transition:opacity 200ms, transform 200ms",
  ].join(";");
  document.documentElement.appendChild(ring);

  // Pause when real user moves their physical cursor.
  window.addEventListener(
    "mousemove",
    (ev) => {
      // Ignore events we likely dispatched (close to our last position)
      const dx = ev.clientX - pos.x;
      const dy = ev.clientY - pos.y;
      if (Math.hypot(dx, dy) > 8) {
        userActiveUntil = Date.now() + 3000;
      }
    },
    { passive: true, capture: true },
  );
  return el;
}

export function userInterruptingNow(): boolean {
  return Date.now() < userActiveUntil;
}

export async function waitForUserIdle(): Promise<void> {
  while (userInterruptingNow()) {
    await sleep(300);
  }
}

function setCursor(x: number, y: number) {
  pos = { x, y };
  const el = ensureCursor();
  el.style.transform = `translate(${x}px, ${y}px)`;
}

function easeInOutCubic(t: number) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

export async function moveCursorTo(x: number, y: number, durationMs = 700): Promise<void> {
  ensureCursor();
  const from = { ...pos };
  const start = performance.now();
  return new Promise((resolve) => {
    function tick(now: number) {
      const t = Math.min(1, (now - start) / durationMs);
      const e = easeInOutCubic(t);
      // Slight curve: add a small perpendicular offset
      const dx = x - from.x;
      const dy = y - from.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      const curve = Math.sin(t * Math.PI) * Math.min(40, len * 0.08);
      const cx = from.x + dx * e + nx * curve;
      const cy = from.y + dy * e + ny * curve;
      setCursor(cx, cy);
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    }
    requestAnimationFrame(tick);
  });
}

export async function moveCursorToElement(el: Element, durationMs = 700): Promise<DOMRect> {
  (el as HTMLElement).scrollIntoView({ block: "center", inline: "center" });
  // Wait for the browser to settle scroll/layout
  await sleep(250);
  const rect = el.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  await moveCursorTo(x, y, durationMs);
  return rect;
}

export async function moveCursorToRect(rect: DOMRect, durationMs = 700): Promise<void> {
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  await moveCursorTo(x, y, durationMs);
}

export function pointFromRect(rect: DOMRect): { x: number; y: number } {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

function pulseRing(x: number, y: number) {
  const ring = document.getElementById(RING_ID);
  if (!ring) return;
  ring.style.transform = `translate(${x}px, ${y}px) scale(0.4)`;
  ring.style.opacity = "0.9";
  requestAnimationFrame(() => {
    ring.style.transform = `translate(${x}px, ${y}px) scale(1.4)`;
    ring.style.opacity = "0";
  });
}

export async function clickAt(target: Element): Promise<void> {
  // Re-measure right before clicking (layout may have shifted).
  (target as HTMLElement).scrollIntoView?.({ block: "center", inline: "center" });
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  pulseRing(x, y);
  // Move the visible cursor to the actual click point.
  setCursor(x, y);
  const opts: MouseEventInit = {
    bubbles: true, cancelable: true, composed: true, view: window,
    button: 0, clientX: x, clientY: y,
  };
  const pointerOpts: PointerEventInit = { ...opts, pointerType: "mouse", isPrimary: true };
  // Prefer the intended target itself; fall back to elementFromPoint only if target is detached.
  const hit: Element = target.isConnected ? target : (document.elementFromPoint(x, y) || target);
  try {
    hit.dispatchEvent(new PointerEvent("pointerover", pointerOpts));
    hit.dispatchEvent(new PointerEvent("pointerenter", pointerOpts));
    hit.dispatchEvent(new MouseEvent("mouseover", opts));
    hit.dispatchEvent(new MouseEvent("mouseenter", opts));
    hit.dispatchEvent(new PointerEvent("pointerdown", pointerOpts));
    hit.dispatchEvent(new MouseEvent("mousedown", opts));
    (hit as HTMLElement).focus?.();
    await sleep(40);
    hit.dispatchEvent(new PointerEvent("pointerup", pointerOpts));
    hit.dispatchEvent(new MouseEvent("mouseup", opts));
    hit.dispatchEvent(new MouseEvent("click", opts));
    try { (hit as HTMLElement).click?.(); } catch {}
  } catch {
    try { (target as HTMLElement).click?.(); } catch {}
  }
}

export async function hoverAt(target: Element, dwellMs = 450): Promise<void> {
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  await hoverAtPoint(x, y, dwellMs, target);
}

export async function hoverAtRect(rect: DOMRect, dwellMs = 450): Promise<void> {
  await hoverAtPoint(rect.left + rect.width / 2, rect.top + rect.height / 2, dwellMs);
}

export async function hoverAtPoint(x: number, y: number, dwellMs = 450, fallbackTarget?: Element): Promise<void> {
  pulseRing(x, y);
  const opts: MouseEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    view: window,
    button: 0,
    clientX: x,
    clientY: y,
  };
  const pointerOpts: PointerEventInit = { ...opts, pointerType: "mouse", isPrimary: true };
  const hit: Element = document.elementFromPoint(x, y) || fallbackTarget || document.documentElement;
  try {
    hit.dispatchEvent(new PointerEvent("pointerover", pointerOpts));
    hit.dispatchEvent(new PointerEvent("pointerenter", pointerOpts));
    hit.dispatchEvent(new MouseEvent("mouseover", opts));
    hit.dispatchEvent(new MouseEvent("mouseenter", opts));
    hit.dispatchEvent(new PointerEvent("pointermove", pointerOpts));
    hit.dispatchEvent(new MouseEvent("mousemove", opts));
    await sleep(dwellMs);
  } catch {
    await sleep(dwellMs);
  }
}

export function nativeSet(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto =
    el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export function setContentEditable(el: HTMLElement, value: string) {
  el.focus();
  // Try to select all and replace
  try {
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(el);
    sel?.removeAllRanges();
    sel?.addRange(range);
    document.execCommand("delete", false);
    document.execCommand("insertText", false, value);
  } catch {
    el.textContent = value;
  }
  el.dispatchEvent(new InputEvent("input", { bubbles: true, data: value, inputType: "insertText" }));
}

export async function typeText(el: Element, text: string, minDelay = 28, maxDelay = 80) {
  try {
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      el.focus();
      const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
      const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
      // Type character-by-character to trigger controlled onChange handlers
      for (let i = 1; i <= text.length; i++) {
        const partial = text.slice(0, i);
        setter?.call(el, partial);
        el.dispatchEvent(new Event("input", { bubbles: true }));
        await sleep(minDelay + Math.random() * (maxDelay - minDelay));
      }
      el.dispatchEvent(new Event("change", { bubbles: true }));
      return;
    }

    // Content editable path
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
    for (const ch of text) {
      try {
        document.execCommand("insertText", false, ch);
      } catch {
        h.textContent = (h.textContent || "") + ch;
      }
      h.dispatchEvent(new InputEvent("input", { bubbles: true, data: ch, inputType: "insertText" }));
      await sleep(minDelay + Math.random() * (maxDelay - minDelay));
    }
  } catch (e) {
    try { (el as HTMLElement).textContent = text; } catch {}
    (el as HTMLElement).dispatchEvent(new InputEvent("input", { bubbles: true, data: text, inputType: "insertText" }));
  }
}

export async function waitFor<T extends Element = Element>(
  selectorOrFn: string | (() => T | null),
  timeoutMs = 8000,
): Promise<T | null> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const el = typeof selectorOrFn === "string"
      ? (document.querySelector(selectorOrFn) as T | null)
      : selectorOrFn();
    if (el) return el;
    await sleep(150);
  }
  return null;
}

// Deep query across shadow roots.
export function deepQueryAll(predicate: (el: Element) => boolean, root: Document | ShadowRoot = document): Element[] {
  const out: Element[] = [];
  const walker = document.createTreeWalker(root as any, NodeFilter.SHOW_ELEMENT);
  let n: Node | null = walker.currentNode;
  // Manual stack to handle shadow roots
  const stack: (Document | ShadowRoot)[] = [root];
  while (stack.length) {
    const r = stack.pop()!;
    const all = r.querySelectorAll("*");
    for (const el of Array.from(all)) {
      if (predicate(el)) out.push(el);
      const sr = (el as any).shadowRoot as ShadowRoot | null;
      if (sr) stack.push(sr);
    }
  }
  return out;
}

export function deepQueryFirst(predicate: (el: Element) => boolean): Element | null {
  const stack: (Document | ShadowRoot)[] = [document];
  while (stack.length) {
    const r = stack.pop()!;
    const all = r.querySelectorAll("*");
    for (const el of Array.from(all)) {
      if (predicate(el)) return el;
      const sr = (el as any).shadowRoot as ShadowRoot | null;
      if (sr) stack.push(sr);
    }
  }
  return null;
}

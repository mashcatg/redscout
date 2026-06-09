// Content script: detect clicks on user links and forward to background to trigger DM send
function findUserAnchor(el: Element | null): HTMLAnchorElement | null {
  while (el) {
    if (el instanceof HTMLAnchorElement && /\/user\//.test(el.href)) return el;
    el = el.parentElement;
  }
  return null;
}

function waitFor<T extends Element>(selector: string, timeout = 8000): Promise<T | null> {
  return new Promise(async (resolve) => {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = document.querySelector(selector) as T | null;
      if (el) return resolve(el);
      await new Promise((r) => setTimeout(r, 200));
    }
    resolve(null);
  });
}

async function autoFillAndSendIfRequested() {
  try {
    const payload = sessionStorage.getItem('redreach.auto_dm');
    if (!payload) return;
    sessionStorage.removeItem('redreach.auto_dm');
    const data = JSON.parse(payload) as { username: string };
    // Simple default message (can be improved to pull user template)
    const subjectText = 'Hey';
    const bodyText = `Hey ${data.username},\n\nSaw your comment on Reddit — quick question: ...`;

    const subject = await waitFor<HTMLInputElement>('input[name="subject"], input[name="title"], input[placeholder*="subject" i], input[placeholder*="title" i]', 8000);
    const textarea = await waitFor<HTMLTextAreaElement | HTMLDivElement>('textarea[name="text"], textarea[name="message"], textarea[placeholder*="message" i], shreddit-composer textarea, div[role="textbox"], textarea', 8000);
    if (subject) {
      try { (subject as HTMLInputElement).value = subjectText; subject.dispatchEvent(new Event('input', { bubbles: true })); } catch {}
    }
    if (!textarea) return;
    try {
      if (textarea instanceof HTMLTextAreaElement || (textarea as HTMLElement).tagName.toLowerCase() === 'textarea') {
        (textarea as HTMLTextAreaElement).value = bodyText;
        (textarea as HTMLTextAreaElement).dispatchEvent(new Event('input', { bubbles: true }));
      } else {
        (textarea as HTMLElement).textContent = bodyText;
        textarea.dispatchEvent(new InputEvent('input', { bubbles: true, data: bodyText, inputType: 'insertText' }));
      }
    } catch {}

    await new Promise((r) => setTimeout(r, 600));
    const send = Array.from(document.querySelectorAll('button, input[type="submit"], [role="button"]'))
      .find((el) => (/^send$/i.test((el.textContent || (el as any).value || '').trim()) || /send/i.test((el.textContent || (el as any).value || '')))) as HTMLElement | undefined;
    if (send) {
      try { send.click(); } catch { send.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })); }
    }
  } catch (e) { /* ignore */ }
}

// If we're already on a compose page and a pending auto_dm exists, run it.
if (location.pathname.includes('/message/compose')) {
  autoFillAndSendIfRequested();
}

// Capture username clicks and navigate this tab to compose page with an auto_dm flag.
function handleUserClick(ev: MouseEvent) {
  try {
    const a = findUserAnchor(ev.target as Element);
    if (!a) return;
    const m = a.href.match(/\/user\/(.+?)(?:[\/\?#]|$)/);
    if (!m) return;
    const username = decodeURIComponent(m[1]);
    // Allow modifier keys to retain normal navigation
    if (ev.metaKey || ev.ctrlKey || ev.shiftKey || ev.altKey) return;
    // stop the default navigation which could open a new tab and beat other handlers
    try { ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation && (ev as any).stopImmediatePropagation(); } catch (e) {}
    // debug
    try { console.debug('[redreach] intercepted username click', username, 'button', (ev as any).button); } catch {}
    // Notify background that we're navigating to compose from this tab
    try { chrome.runtime.sendMessage({ type: 'CLICK_NAV', username }); } catch (e) {}
    // Store a short-lived flag so the compose page knows to auto-send
    sessionStorage.setItem('redreach.auto_dm', JSON.stringify({ username }));
    // Navigate this tab to the compose URL so the user's cursor/click drives the flow
    const composeUrl = `https://www.reddit.com/message/compose/?to=${encodeURIComponent(username)}`;
    location.href = composeUrl;
  } catch (e) { /* ignore */ }
}

// Attach listeners to a given root (Document or ShadowRoot)
function attachListeners(root: Document | ShadowRoot) {
  try {
    root.addEventListener('pointerdown', (ev: Event) => { try { handleUserClick(ev as unknown as MouseEvent); } catch {} }, { capture: true, passive: false });
    root.addEventListener('mousedown', (ev: Event) => { try { handleUserClick(ev as unknown as MouseEvent); } catch {} }, { capture: true, passive: false });
    root.addEventListener('auxclick', (ev: Event) => { try { handleUserClick(ev as unknown as MouseEvent); } catch {} }, { capture: true, passive: false });
    root.addEventListener('click', (ev: Event) => { try { handleUserClick(ev as unknown as MouseEvent); } catch {} }, { capture: true, passive: false });
  } catch (e) { }
}

// Attach to document and existing shadow roots
attachListeners(document);
try {
  const all = Array.from(document.querySelectorAll('*')) as Element[];
  for (const el of all) {
    try {
      const sr = (el as any).shadowRoot as ShadowRoot | null;
      if (sr) attachListeners(sr);
    } catch (e) { }
  }
} catch (e) { }

// Watch for new shadow roots and attach listeners inside them
try {
  const mo = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of Array.from(m.addedNodes)) {
        try {
          if (node && (node as Element).shadowRoot) attachListeners((node as Element).shadowRoot!);
          // also if added node contains elements with shadowRoot
          const descendants = (node as Element)?.querySelectorAll?.('*') ?? [];
          for (const d of Array.from(descendants)) {
            try { if ((d as Element).shadowRoot) attachListeners((d as Element).shadowRoot!); } catch (e) {}
          }
        } catch (e) { }
      }
    }
  });
  mo.observe(document, { childList: true, subtree: true });
} catch (e) { }

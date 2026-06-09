// Injected into a Reddit DM compose page to fill subject + body and click Send.
// Detects success (URL change to /message/messages or success toast) and rate-limit errors.

type SendResult = { ok: true } | { ok: false; reason: "rate_limited" | "blocked" | "error"; message: string };

async function waitFor<T extends Element>(selector: string, timeoutMs = 8000): Promise<T | null> {
  const start = Date.now();
  return new Promise((resolve) => {
    const tick = () => {
      const el = document.querySelector<T>(selector);
      if (el) return resolve(el);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 200);
    };
    tick();
  });
}

function findInput(): HTMLTextAreaElement | HTMLInputElement | null {
  // New Reddit message compose: textarea[name="text"] inside form, plus input[name="subject"].
  return (
    document.querySelector<HTMLTextAreaElement>('textarea[name="text"]') ||
    document.querySelector<HTMLTextAreaElement>('textarea[placeholder*="message" i]') ||
    document.querySelector<HTMLTextAreaElement>("shreddit-composer textarea")
  );
}

function findSubject(): HTMLInputElement | null {
  return (
    document.querySelector<HTMLInputElement>('input[name="subject"]') ||
    document.querySelector<HTMLInputElement>('input[placeholder*="subject" i]')
  );
}

function findSendButton(): HTMLButtonElement | null {
  // Old reddit: button.btn[type="submit"]. New reddit: button containing "Send".
  const candidates = Array.from(
    document.querySelectorAll<HTMLButtonElement>('button, input[type="submit"]'),
  );
  return (
    candidates.find((b) => /^send$/i.test((b.textContent || b.getAttribute("value") || "").trim())) ||
    candidates.find((b) => /send/i.test(b.textContent || b.getAttribute("value") || ""))
  ) as HTMLButtonElement | null || null;
}

function nativeSet(el: HTMLInputElement | HTMLTextAreaElement, value: string) {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
}

export async function sendDm(subject: string, body: string): Promise<SendResult> {
  const sub = await waitFor<HTMLInputElement>('input[name="subject"], input[placeholder*="subject" i]', 8000);
  if (sub) nativeSet(sub, subject || "Hey");

  const txt = await waitFor<HTMLTextAreaElement>('textarea[name="text"], shreddit-composer textarea, textarea', 8000);
  if (!txt) return { ok: false, reason: "error", message: "Compose textarea not found" };
  nativeSet(txt, body);

  await new Promise((r) => setTimeout(r, 400 + Math.random() * 600));

  const btn = findSendButton();
  if (!btn) return { ok: false, reason: "error", message: "Send button not found" };

  btn.click();

  // Wait up to 10s for success/error signal.
  const start = Date.now();
  while (Date.now() - start < 10_000) {
    await new Promise((r) => setTimeout(r, 400));
    const errText = document.body.innerText.toLowerCase();
    if (errText.includes("you are doing that too much") || errText.includes("ratelimit")) {
      return { ok: false, reason: "rate_limited", message: "Reddit rate-limited" };
    }
    if (errText.includes("not allowed") || errText.includes("blocked")) {
      return { ok: false, reason: "blocked", message: "Reddit blocked send" };
    }
    if (location.pathname.includes("/message/messages") || location.pathname.includes("/message/sent")) {
      return { ok: true };
    }
    // success toasts
    const toast = document.querySelector('[role="alert"], faceplate-toast');
    if (toast && /sent|success/i.test(toast.textContent || "")) return { ok: true };
    // If textarea cleared, likely sent.
    const after = findInput();
    if (after && after.value.trim() === "") return { ok: true };
  }
  return { ok: false, reason: "error", message: "Timed out waiting for send confirmation" };
}

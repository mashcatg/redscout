// Detects logged-in Reddit username on any reddit.com tab and mounts a docked side panel.
// The dock keeps the extension visible on the right edge of Reddit pages.

function detectRedditUser(): string | null {
  // New Reddit: `<faceplate-tracker source="header">` etc. — username often in a link `/user/<name>/`.
  const link = document.querySelector<HTMLAnchorElement>(
    'a[href^="/user/"][href*="/submitted/"], a[href^="/user/"][data-testid="user-profile-link"]',
  );
  if (link) {
    const m = link.getAttribute("href")?.match(/^\/user\/([^/]+)/);
    if (m) return m[1];
  }
  // Header dropdown often contains the username text.
  const header = document.querySelector<HTMLElement>('faceplate-tracker[source="user_dropdown"]');
  if (header) {
    const name = header.querySelector("span")?.textContent?.trim();
    if (name && !name.toLowerCase().includes("log in")) return name;
  }
  return null;
}

const DOCK_ROOT_ID = "redreach-dock-root";
const DOCK_WIDTH = 384;

function injectDock() {
  if (document.getElementById(DOCK_ROOT_ID)) return;

  const root = document.createElement("div");
  root.id = DOCK_ROOT_ID;
  root.style.cssText = [
    "position: fixed",
    "top: 0",
    "right: 0",
    `width: ${DOCK_WIDTH}px`,
    "height: 100vh",
    "z-index: 2147483647",
    "pointer-events: none",
    "font-family: Bricolage Grotesque, Inter, system-ui, sans-serif",
    "display: none",
  ].join(";");

  const sheet = document.createElement("div");
  sheet.style.cssText = [
    "display: flex",
    "flex-direction: column",
    "width: 100%",
    "height: 100%",
    "background: #fcfbf8",
    "border-left: 1px solid rgba(231, 160, 129, 0.35)",
    "box-shadow: -16px 0 44px rgba(40, 22, 12, 0.14)",
    "pointer-events: auto",
  ].join(";");

  const header = document.createElement("div");
  header.style.cssText = [
    "display: flex",
    "align-items: center",
    "justify-content: space-between",
    "padding: 10px 12px",
    "border-bottom: 1px solid rgba(231, 160, 129, 0.2)",
    "background: linear-gradient(180deg, rgba(255,255,255,0.95), rgba(252,251,248,0.92))",
  ].join(";");

  const brand = document.createElement("div");
  brand.textContent = "redreach";
  brand.style.cssText = "font-size: 22px; line-height: 1; color: #18110d; letter-spacing: -0.04em;";

  const controls = document.createElement("div");
  controls.style.cssText = "display: flex; gap: 8px; align-items: center;";

  const collapse = document.createElement("button");
  collapse.type = "button";
  collapse.title = "Collapse panel";
  collapse.textContent = "◀";
  collapse.style.cssText = [
    "width: 30px",
    "height: 30px",
    "border-radius: 999px",
    "border: 1px solid rgba(231, 160, 129, 0.35)",
    "background: #fff",
    "color: #ef5b2d",
    "cursor: pointer",
  ].join(";");

  const iframe = document.createElement("iframe");
  iframe.src = chrome.runtime.getURL("src/popup/index.html");
  iframe.title = "RedReach panel";
  iframe.style.cssText = [
    "width: 100%",
    "height: calc(100vh - 52px)",
    "border: 0",
    "background: transparent",
  ].join(";");

  const handle = document.createElement("button");
  handle.type = "button";
  handle.title = "Open RedReach panel";
  handle.textContent = "redreach";
  handle.style.cssText = [
    "position: fixed",
    "top: 16px",
    "right: 16px",
    "z-index: 2147483647",
    "display: block",
    "padding: 12px 16px",
    "border-radius: 999px",
    "border: 1px solid rgba(231, 160, 129, 0.35)",
    "background: #fcfbf8",
    "color: #ef5b2d",
    "font-size: 14px",
    "box-shadow: -8px 0 24px rgba(40, 22, 12, 0.12)",
    "cursor: pointer",
  ].join(";");

  collapse.addEventListener("click", () => {
    root.style.display = "none";
  });

  handle.addEventListener("click", () => {
    root.style.display = "block";
    root.style.pointerEvents = "auto";
  });

  controls.appendChild(collapse);
  header.appendChild(brand);
  header.appendChild(controls);
  sheet.appendChild(header);
  sheet.appendChild(iframe);
  root.appendChild(sheet);
  document.documentElement.appendChild(root);
  document.body.appendChild(handle);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", injectDock, { once: true });
} else {
  injectDock();
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DETECT_REDDIT_USER") {
    sendResponse({ username: detectRedditUser() });
  }
  return true;
});

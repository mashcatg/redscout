// Injected programmatically into a reddit.com tab to scrape commenters via Reddit's public JSON.
// Returns ThreadScrape via sendResponse.

import type { Commenter, ThreadScrape } from "@/lib/messaging";

type RedditChild = {
  kind: string;
  data: {
    id?: string;
    name?: string;
    author?: string;
    body?: string;
    permalink?: string;
    depth?: number;
    title?: string;
    subreddit?: string;
    selftext?: string;
    replies?: { data: { children: RedditChild[] } } | "";
  };
};

const BOT_AUTHORS = new Set([
  "AutoModerator",
  "[deleted]",
  "[removed]",
  "RemindMeBot",
  "WikiTextBot",
  "sneakpeekbot",
  "Mentor-Mediabot",
]);

async function fetchListing(jsonUrl: string): Promise<any[]> {
  const res = await fetch(jsonUrl, { credentials: "include", headers: { Accept: "application/json" } });
  if (!res.ok) throw new Error(`Reddit ${res.status}`);
  return res.json();
}

function walk(children: RedditChild[], acc: Commenter[], depth: number) {
  for (const c of children) {
    if (c.kind === "more") continue;
    if (c.kind !== "t1") continue;
    const d = c.data;
    if (!d.author || BOT_AUTHORS.has(d.author)) {
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

export async function scrapeThread(): Promise<ThreadScrape> {
  // location.href like https://www.reddit.com/r/SEO/comments/<id>/<slug>/
  const url = new URL(location.href);
  const parts = url.pathname.split("/").filter(Boolean);
  const idx = parts.indexOf("comments");
  if (idx === -1) throw new Error("Not on a Reddit post URL");
  const subreddit = parts[1];
  const postId = parts[idx + 1];
  const slug = parts[idx + 2] ?? "";
  const jsonUrl = `https://www.reddit.com/r/${subreddit}/comments/${postId}/${slug}.json?limit=500&depth=10&sort=top`;

  const data = await fetchListing(jsonUrl);
  const postData = data[0]?.data?.children?.[0]?.data ?? {};
  const commentsListing = data[1]?.data?.children ?? [];

  const commenters: Commenter[] = [];
  walk(commentsListing as RedditChild[], commenters, 0);

  // Dedupe by username, keep first occurrence (= shallowest/highest-voted because of sort=top).
  const seen = new Set<string>();
  const unique = commenters.filter((c) => {
    const k = c.username.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });

  return {
    post_id: postId,
    post_title: postData.title ?? "",
    post_url: `https://www.reddit.com/r/${subreddit}/comments/${postId}/${slug}`,
    post_author: postData.author ?? "",
    post_subreddit: subreddit,
    post_body: (postData.selftext ?? "").slice(0, 4000),
    commenters: unique,
  };
}

// Exposed for chrome.scripting.executeScript({ func: scrapeThread, ... })
// When called via runtime message, sendResponse with the result.
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "SCRAPE_THREAD_INPAGE") {
    scrapeThread()
      .then((s) => sendResponse({ ok: true, data: s }))
      .catch((e) => sendResponse({ ok: false, error: String(e?.message ?? e) }));
    return true; // async
  }
});

// Typed messages between popup, background, and content scripts.
export type Commenter = {
  username: string;
  comment_id: string;
  comment_url: string;
  comment_body: string;
  is_first_level: boolean;
};

export type ThreadScrape = {
  post_id: string;
  post_title: string;
  post_url: string;
  post_author: string;
  post_subreddit: string;
  post_body: string;
  commenters: Commenter[];
};

export type CampaignSettings = {
  dm_limit: number;        // per campaign
  daily_limit: number;     // per day
  delay_min_sec: number;
  delay_max_sec: number;
  skip_post_author: boolean;
  skip_if_dmed: boolean;
  first_level_only: boolean;
  dry_run: boolean;
};

export type CampaignProgress = {
  status: "idle" | "scraping" | "queueing" | "running" | "paused" | "rate_limited" | "completed" | "error";
  campaign_id?: string;
  total: number;
  sent: number;
  failed: number;
  skipped: number;
  remaining: number;
  current_user?: string;
  next_send_at?: number; // epoch ms
  last_error?: string;
};

export type Msg =
  | { type: "SCRAPE_THREAD"; tabId: number }
  | { type: "START_CAMPAIGN"; campaignId: string; settings: CampaignSettings; messageTemplate: string }
  | { type: "PAUSE_CAMPAIGN" }
  | { type: "RESUME_CAMPAIGN" }
  | { type: "STOP_CAMPAIGN" }
  | { type: "GET_PROGRESS" }
  | { type: "PROGRESS_UPDATE"; progress: CampaignProgress };

export const DEFAULT_SETTINGS: CampaignSettings = {
  dm_limit: 100,
  daily_limit: 25,
  delay_min_sec: 100,
  delay_max_sec: 140,
  skip_post_author: true,
  skip_if_dmed: true,
  first_level_only: false,
  dry_run: false,
};

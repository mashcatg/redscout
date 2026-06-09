export type ApiPlatform = "brightdata" | "sociavault" | "deepseek" | "claude" | "firecrawl" | "other";

export type ApiCallContext = {
  supabase: unknown;
  userId: string;
  orgId?: string | null;
};

export type ApiCallLogEntry = {
  user_id: string;
  org_id?: string | null;
  api_platform: ApiPlatform;
  feature: string;
  operation: string;
  endpoint?: string | null;
  model?: string | null;
  ok: boolean;
  status_code?: number | null;
  latency_ms?: number | null;
  input_tokens?: number | null;
  output_tokens?: number | null;
  total_tokens?: number | null;
  cost_usd?: number | null;
  error_message?: string | null;
  request_meta?: Record<string, unknown> | null;
  response_meta?: Record<string, unknown> | null;
};

type SupabaseLike = {
  from: (table: string) => {
    insert: (row: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
  };
};

export async function recordApiCall(db: unknown, entry: ApiCallLogEntry) {
  try {
    const supabase = db as SupabaseLike;
    const { error } = await supabase.from("api_call_logs").insert({
      user_id: entry.user_id,
      org_id: entry.org_id ?? null,
      api_platform: entry.api_platform,
      feature: entry.feature,
      operation: entry.operation,
      endpoint: entry.endpoint ?? null,
      model: entry.model ?? null,
      ok: entry.ok,
      status_code: entry.status_code ?? null,
      latency_ms: entry.latency_ms ?? null,
      input_tokens: entry.input_tokens ?? null,
      output_tokens: entry.output_tokens ?? null,
      total_tokens: entry.total_tokens ?? null,
      cost_usd: entry.cost_usd ?? null,
      error_message: entry.error_message ?? null,
      request_meta: entry.request_meta ?? {},
      response_meta: entry.response_meta ?? {},
    });
    if (error) console.error("[api-log] insert failed", error.message);
  } catch (error) {
    console.error("[api-log] insert failed", error);
  }
}
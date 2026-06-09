import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const markInboxItemsBulk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: unknown) =>
    z.object({
      ids: z.array(z.string().uuid()).min(1).max(500),
      action: z.enum(["save", "unsave", "replied", "archive", "unarchive", "read", "reset"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const now = new Date().toISOString();
    const patch: {
      status?: "new" | "saved" | "replied" | "archived";
      saved_at?: string | null;
      replied_at?: string | null;
      is_read?: boolean;
    } = {};
    switch (data.action) {
      case "save": patch.status = "saved"; patch.saved_at = now; break;
      case "unsave": patch.status = "new"; patch.saved_at = null; break;
      case "replied": patch.status = "replied"; patch.replied_at = now; break;
      case "archive": patch.status = "archived"; break;
      case "unarchive": patch.status = "new"; break;
      case "read": patch.is_read = true; break;
      case "reset": patch.status = "new"; patch.replied_at = null; patch.saved_at = null; break;
    }
    const { error } = await supabase.from("inbox_items").update(patch).in("id", data.ids);
    if (error) throw new Error(error.message);
    return { ok: true, count: data.ids.length };
  });

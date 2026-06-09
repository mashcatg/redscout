import { useEffect, useState } from "react";
import { AlertTriangle, Clock, X } from "lucide-react";
import { Link } from "@tanstack/react-router";

type Plan = {
  isActive?: boolean;
  inGrace?: boolean;
  accessUntil?: string | null;
  deleteAt?: string | null;
  subscriptionStatus?: string | null;
  passType?: string | null;
};

function formatRemaining(targetIso: string): string {
  const ms = new Date(targetIso).getTime() - Date.now();
  if (ms <= 0) return "any moment";
  const totalMin = Math.floor(ms / 60000);
  const days = Math.floor(totalMin / (60 * 24));
  const hours = Math.floor((totalMin % (60 * 24)) / 60);
  const minutes = totalMin % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function ExpiryBanner({ orgId, plan }: { orgId: string; plan: Plan | undefined }) {
  const [, setTick] = useState(0);
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  if (!plan) return null;

  const isPass = plan.passType === "pass3day";
  const cancelled = plan.subscriptionStatus === "cancelled";
  const showCancelledActive = plan.isActive && cancelled && plan.accessUntil;
  const showExpired = !plan.isActive && plan.inGrace && plan.deleteAt;

  if (!showCancelledActive && !showExpired) return null;
  if (dismissed && showCancelledActive) return null;

  if (showExpired) {
    // Hard, undismissable banner during grace period.
    return (
      <div className="w-full border-b border-destructive/40 bg-destructive text-destructive-foreground">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2.5 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>
              {isPass ? "Your 3-Day Pass ended." : "Your subscription ended."}{" "}
              All workspace data will be permanently deleted in{" "}
              <strong>{formatRemaining(plan.deleteAt!)}</strong>
              {" "}(on {formatDate(plan.deleteAt!)}). Renew now to keep it.
            </span>
          </div>
          <Link
            to="/dashboard/$orgId/billing"
            params={{ orgId }}
            className="inline-flex h-7 items-center rounded-md bg-background px-3 text-xs font-semibold text-foreground hover:bg-background/90"
          >
            Renew access
          </Link>
        </div>
      </div>
    );
  }

  // Cancelled-but-still-active: soft amber banner with dismiss.
  return (
    <div className="w-full border-b border-amber-300/60 bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-2 text-sm">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 shrink-0" />
          <span>
            Subscription cancelled. You have access until{" "}
            <strong>{formatDate(plan.accessUntil!)}</strong>. Data will be
            deleted on {plan.deleteAt ? formatDate(plan.deleteAt) : "—"}.
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/dashboard/$orgId/billing"
            params={{ orgId }}
            className="inline-flex h-7 items-center rounded-md border border-amber-400 bg-white px-3 text-xs font-semibold text-amber-900 hover:bg-amber-100"
          >
            Resubscribe
          </Link>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="text-amber-900/70 hover:text-amber-900"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

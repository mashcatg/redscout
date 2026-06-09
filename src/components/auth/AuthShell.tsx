import { Link } from "@tanstack/react-router";
import { Check, Sparkles } from "lucide-react";
import BrandIcon from "@/components/BrandIcon";

export function AuthShell({
  eyebrow,
  title,
  subtitle,
  children,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_1fr] bg-[radial-gradient(circle_at_top,_rgba(255,95,45,0.10),_transparent_30%),linear-gradient(180deg,#fffaf5_0%,#fffdfb_60%,#fff8f2_100%)] text-foreground">
      {/* Left – form */}
      <div className="flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-2 mb-10">
            <BrandIcon className="h-7 w-7" />
            <span className="text-2xl font-bold tracking-tight">redScout</span>
          </Link>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
          <h1 className="mt-2 text-3xl sm:text-[2rem] font-semibold tracking-tight leading-tight">{title}</h1>
          {subtitle && <p className="mt-2 text-sm text-muted-foreground">{subtitle}</p>}
          <div className="mt-8">{children}</div>
        </div>
      </div>

      {/* Right – brand panel */}
      <aside className="hidden lg:flex relative overflow-hidden items-center justify-center px-12 py-12 border-l border-border/60 bg-[linear-gradient(160deg,#fff3e8_0%,#ffe4d2_55%,#ffd1b3_100%)]">
        <div className="pointer-events-none absolute -top-24 -right-20 h-80 w-80 rounded-full bg-primary/25 blur-3xl" />
        <div className="pointer-events-none absolute bottom-[-6rem] left-[-3rem] h-72 w-72 rounded-full bg-foreground/10 blur-3xl" />
        <div className="relative max-w-md">
          <div className="inline-flex items-center gap-2 rounded-full bg-white/70 backdrop-blur px-3 py-1 text-xs font-semibold text-primary border border-white/80 shadow-sm">
            <Sparkles className="h-3.5 w-3.5" /> Reddit growth OS
          </div>
          <h2 className="mt-5 text-3xl font-semibold leading-tight tracking-tight">
            Turn Reddit traffic into <span className="text-primary">paying customers</span>.
          </h2>
          <p className="mt-3 text-sm text-foreground/70">
            redScout monitors threads, scores intent, and surfaces the conversations worth replying to — so you don't waste hours scrolling.
          </p>
          <ul className="mt-6 space-y-3 text-sm">
            {[
              "AI-scored Reddit opportunities every day",
              "Rank Reddit threads on Google for your product",
              "Auto-DM warm leads — without sounding like a bot",
              "Cancel any time. 3-Day Pass for $5.",
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Check className="h-3 w-3" />
                </span>
                <span className="text-foreground/80">{line}</span>
              </li>
            ))}
          </ul>
          <div className="mt-8 rounded-xl border border-white/70 bg-white/70 backdrop-blur p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Used by founders at</p>
            <p className="mt-2 text-sm font-medium">Indie SaaS · B2B tools · Newsletters · Agencies</p>
          </div>
        </div>
      </aside>
    </div>
  );
}

export function GoogleButton({ onClick, label = "Continue with Google" }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold hover:bg-accent/40 transition"
    >
      <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
      </svg>
      {label}
    </button>
  );
}

export const inputBase =
  "w-full rounded-lg border border-border bg-white px-3.5 py-2.5 text-sm shadow-sm focus:outline-none focus:border-foreground focus:ring-2 focus:ring-primary/20 transition";

export const labelBase = "block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5";

export const primaryButton =
  "w-full rounded-lg bg-foreground text-background px-4 py-2.5 text-sm font-semibold hover:opacity-90 disabled:opacity-50 transition";

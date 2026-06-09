import { Link } from "@tanstack/react-router";
import { ArrowRight, Menu } from "lucide-react";
import { useState } from "react";
import BrandIcon from "@/components/BrandIcon";

const NAV = [
  { to: "/", label: "Home" },
  { to: "/features", label: "Features" },
  { to: "/pricing", label: "Pricing" },
  { to: "/reviews", label: "Reviews" },
] as const;

export function MarketingHeader() {
  const [open, setOpen] = useState(false);
  return (
    <header className="sticky top-0 z-50 border-b border-border/70 bg-background/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:h-18">
        <Link to="/" className="flex items-center gap-2">
          <BrandIcon className="h-9 w-auto object-contain" />
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-medium text-foreground/75 md:flex">
          {NAV.map((n) => (
            <Link
              key={n.to}
              to={n.to}
              className="hover:text-primary transition-colors"
              activeProps={{ className: "text-primary" }}
              activeOptions={{ exact: n.to === "/" }}
            >
              {n.label}
            </Link>
          ))}
          <a href="mailto:hello@redscout.tech" className="hover:text-primary transition-colors">Contact</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            to="/signup"
            className="hidden md:inline-flex items-center gap-1.5 rounded-full border border-foreground bg-foreground px-4 py-2 text-sm font-bold uppercase tracking-wider text-background transition hover:-translate-y-0.5 hover:shadow-lg"
          >
            Get started <ArrowRight className="h-3.5 w-3.5" />
          </Link>
          <button
            type="button"
            aria-label="Open menu"
            onClick={() => setOpen((v) => !v)}
            className="md:hidden inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/70"
          >
            <Menu className="h-4 w-4" />
          </button>
        </div>
      </div>
      {open && (
        <div className="md:hidden border-t border-border/70 bg-background/95 backdrop-blur-xl px-6 py-4 space-y-3">
          {NAV.map((n) => (
            <Link key={n.to} to={n.to} onClick={() => setOpen(false)} className="block text-sm font-semibold">
              {n.label}
            </Link>
          ))}
          <a href="mailto:hello@redscout.tech" className="block text-sm font-semibold">Contact</a>
          <Link to="/signup" onClick={() => setOpen(false)} className="block rounded-full bg-foreground text-background text-center py-2 text-sm font-bold">
            Get started
          </Link>
        </div>
      )}
    </header>
  );
}

export default MarketingHeader;

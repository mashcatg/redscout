import { Link } from "@tanstack/react-router";
import BrandIcon from "@/components/BrandIcon";

export function MarketingFooter() {
  return (
    <footer className="border-t border-border/70 bg-background/60">
      <div className="mx-auto max-w-7xl px-6 py-12 grid gap-8 md:grid-cols-4">
        <div>
          <Link to="/" className="flex items-center gap-2"><BrandIcon className="h-8 w-auto" /></Link>
          <p className="mt-3 text-xs text-muted-foreground max-w-xs">
            redScout — the Reddit growth OS for founders. Monitor, engage, and convert from one dashboard.
          </p>
        </div>
        <FooterCol title="Product" links={[
          { to: "/features", label: "Features" },
          { to: "/pricing", label: "Pricing" },
          { to: "/reviews", label: "Reviews" },
        ]} />
        <FooterCol title="Company" links={[
          { href: "mailto:hello@redscout.tech", label: "Contact" },
        ]} />
        <FooterCol title="Get started" links={[
          { to: "/signup", label: "Sign up" },
          { to: "/login", label: "Log in" },
        ]} />
      </div>
      <div className="border-t border-border/70 py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} redScout. All rights reserved.
      </div>
    </footer>
  );
}

function FooterCol({ title, links }: { title: string; links: Array<{ to?: string; href?: string; label: string }> }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{title}</p>
      <ul className="mt-3 space-y-2 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            {l.to ? (
              <Link to={l.to} className="hover:text-primary transition-colors">{l.label}</Link>
            ) : (
              <a href={l.href} className="hover:text-primary transition-colors">{l.label}</a>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default MarketingFooter;

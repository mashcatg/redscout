import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-4 label-eyebrow text-muted-foreground">Page not found</p>
        <a href="/" className="mt-6 inline-block border border-foreground px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-foreground hover:text-background transition">
          Go home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="label-eyebrow text-destructive">Error</p>
        <h1 className="mt-2 text-2xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <button
          onClick={() => { router.invalidate(); reset(); }}
          className="mt-6 border border-foreground px-4 py-2 text-sm font-bold uppercase tracking-wider hover:bg-foreground hover:text-background transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "redScout — Reddit Growth, SEO & DM Outreach for Founders" },
      { name: "description", content: "redScout is the Reddit growth OS for founders. Monitor threads, rank in parasite SEO, run AI-scored outreach, and warm up accounts safely." },
      { property: "og:site_name", content: "redScout" },
      { property: "og:type", content: "website" },
      { property: "og:title", content: "redScout — Reddit Growth, SEO & DM Outreach for Founders" },
      { property: "og:description", content: "redScout turns Reddit into a predictable growth channel: monitoring, AI scoring, parasite SEO, DM outreach, warmup, and analytics." },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "redScout — Reddit Growth, SEO & DM Outreach for Founders" },
      { name: "twitter:description", content: "redScout turns Reddit into a predictable growth channel: monitoring, AI scoring, parasite SEO, DM outreach, warmup, and analytics." },
      { name: "theme-color", content: "#ff5f2d" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/redscout_logo_icon.png", type: "image/png" },
      { rel: "apple-touch-icon", href: "/redscout_logo_icon.png" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,500;12..96,600;12..96,700;12..96,800&display=swap" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "redScout",
          url: "https://redscout.tech",
          logo: "https://redscout.tech/redscout_logo_icon.png",
          email: "hello@redscout.tech",
          sameAs: ["https://redscout.tech"],
          description: "Reddit growth OS for founders: monitoring, AI scoring, parasite SEO, DM outreach, warmup, and analytics.",
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head><HeadContent /></head>
      <body suppressHydrationWarning>{children}<Scripts /></body>
    </html>
  );
}

function AuthListener() {
  const router = useRouter();
  const qc = useQueryClient();
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        // Cancel + clear so unmounted-but-active queries don't refetch without a session
        qc.cancelQueries();
        qc.clear();
        router.invalidate();
        return;
      }
      router.invalidate();
      qc.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, qc]);
  return null;
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  return (
    <QueryClientProvider client={queryClient}>
      <AuthListener />
      <Outlet />
      <Toaster position="bottom-right" />
    </QueryClientProvider>
  );
}

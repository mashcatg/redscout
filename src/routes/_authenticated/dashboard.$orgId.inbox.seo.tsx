import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/InboxPage";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/inbox/seo")({
  component: SeoInbox,
});

function SeoInbox() {
  const { orgId } = Route.useParams();
  return (
    <InboxPage
      orgId={orgId}
      eyebrow="SEO Inbox"
      title="Top Reddit posts on Google"
      sources={["brightdata_serp"]}
      jobTypes={["keyword_serp", "competitor_serp"]}
    />
  );
}

import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/InboxPage";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/inbox/reddit")({
  component: RedditInbox,
});

function RedditInbox() {
  const { orgId } = Route.useParams();
  return (
    <InboxPage
      orgId={orgId}
      eyebrow="Reddit Inbox"
      title="Reddit mentions"
      sources={["sociavault_keyword", "sociavault_competitor"]}
      jobTypes={["keyword_reddit", "competitor_reddit"]}
      layout="split"
    />
  );
}

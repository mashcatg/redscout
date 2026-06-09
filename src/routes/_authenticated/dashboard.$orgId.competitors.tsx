import { createFileRoute } from "@tanstack/react-router";
import { InboxPage } from "@/components/InboxPage";

export const Route = createFileRoute("/_authenticated/dashboard/$orgId/competitors")({
  component: CompetitorsPage,
});

function CompetitorsPage() {
  const { orgId } = Route.useParams();
  return (
    <InboxPage
      orgId={orgId}
      eyebrow="Competitors"
      title="Competitor mentions"
      sources={["sociavault_competitor"]}
      jobTypes={["competitor_reddit"]}
      layout="split"
      competitorsOnly
      showCompetitorFilter
    />
  );
}

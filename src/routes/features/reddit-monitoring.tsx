import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/reddit-monitoring")({
  component: () => <FeaturePageShell page={featurePages.redditMonitoring} />,
  head: () => featureMeta(featurePages.redditMonitoring),
});

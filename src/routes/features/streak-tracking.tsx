import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/streak-tracking")({
  component: () => <FeaturePageShell page={featurePages.streakTracking} />,
  head: () => featureMeta(featurePages.streakTracking),
});

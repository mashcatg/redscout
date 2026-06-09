import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/dm-outreach")({
  component: () => <FeaturePageShell page={featurePages.dmOutreach} />,
  head: () => featureMeta(featurePages.dmOutreach),
});

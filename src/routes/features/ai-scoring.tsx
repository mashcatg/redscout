import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/ai-scoring")({
  component: () => <FeaturePageShell page={featurePages.aiScoring} />,
  head: () => featureMeta(featurePages.aiScoring),
});

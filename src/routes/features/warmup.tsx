import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/warmup")({
  component: () => <FeaturePageShell page={featurePages.warmup} />,
  head: () => featureMeta(featurePages.warmup),
});

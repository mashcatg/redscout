import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/seo-llm")({
  component: () => <FeaturePageShell page={featurePages.seoLlm} />,
  head: () => featureMeta(featurePages.seoLlm),
});

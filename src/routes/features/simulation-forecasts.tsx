import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/simulation-forecasts")({
  component: () => <FeaturePageShell page={featurePages.simulationForecasts} />,
  head: () => featureMeta(featurePages.simulationForecasts),
});

import { createFileRoute } from "@tanstack/react-router";
import { FeaturePageShell } from "@/components/marketing/FeaturePageShell";
import { featurePages } from "@/lib/feature-pages";
import { featureMeta } from "@/lib/seo";

export const Route = createFileRoute("/features/high-engaging-posts")({
  component: () => <FeaturePageShell page={featurePages.highEngagingPosts} />,
  head: () => featureMeta(featurePages.highEngagingPosts),
});

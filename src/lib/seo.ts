import type { FeaturePageData } from "./feature-pages";

const SITE_URL = "https://redscout.tech";

export function featureMeta(page: FeaturePageData) {
  const title = `${page.title} ${page.highlight} | redScout`;
  const description = page.description;
  const url = `${SITE_URL}/features/${page.slug}`;

  const faqJsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: page.faqs.map((f) => ({
      "@type": "Question",
      name: f.q,
      acceptedAnswer: { "@type": "Answer", text: f.a },
    })),
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
      { "@type": "ListItem", position: 3, name: page.title + " " + page.highlight, item: url },
    ],
  };

  return {
    meta: [
      { title },
      { name: "description", content: description },
      { property: "og:title", content: title },
      { name: "twitter:title", content: title },
      { property: "og:description", content: description },
      { name: "twitter:description", content: description },
      { property: "og:url", content: url },
      { property: "og:type", content: "article" },
      { property: "og:site_name", content: "redScout" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "keywords", content: `Reddit marketing, ${page.title} ${page.highlight}, redScout, Reddit growth, parasite SEO, Reddit DM outreach` },
    ],
    links: [{ rel: "canonical", href: url }],
    scripts: [
      { type: "application/ld+json", children: JSON.stringify(faqJsonLd) },
      { type: "application/ld+json", children: JSON.stringify(breadcrumbJsonLd) },
    ],
  };
}

import type { Metadata } from "next";
import type { AppSettings } from "@/services/settings-service";

export type SeoSettings = {
  siteUrl: string;
  title: string;
  description: string;
  keywords: string;
  googleVerification: string;
  index: boolean;
  homeTitle: string;
  homeDescription: string;
  blogTitle: string;
  blogDescription: string;
  noticesTitle: string;
  noticesDescription: string;
  tournamentsTitle: string;
  tournamentsDescription: string;
  ogImageDataUrl: string;
};

export const emptySeo = (): SeoSettings => ({
  siteUrl: "",
  title: "",
  description: "",
  keywords: "",
  googleVerification: "",
  index: true,
  homeTitle: "",
  homeDescription: "",
  blogTitle: "",
  blogDescription: "",
  noticesTitle: "",
  noticesDescription: "",
  tournamentsTitle: "",
  tournamentsDescription: "",
  ogImageDataUrl: "",
});

export function siteName(settings: AppSettings) {
  return settings.seo.title.trim() || settings.business.name;
}

export function siteDescription(settings: AppSettings) {
  return settings.seo.description.trim() || settings.business.description || `${settings.business.name} gaming floor, rates, and today's stations.`;
}

export function siteOrigin(settings: AppSettings) {
  return settings.seo.siteUrl.trim().replace(/\/$/, "");
}

export function keywordList(settings: AppSettings) {
  return settings.seo.keywords.split(",").map((word) => word.trim()).filter(Boolean);
}

export function pageMetadata(
  settings: AppSettings,
  page?: { title?: string; description?: string; path?: string; image?: string; noindex?: boolean; type?: "website" | "article" },
): Metadata {
  const name = siteName(settings);
  const description = page?.description?.trim() || siteDescription(settings);
  const titleText = page?.title?.trim() || name;
  const origin = siteOrigin(settings);
  const path = page?.path || "/";
  const image = page?.image || "/api/public/og";
  const index = settings.seo.index && !page?.noindex;
  return {
    title: titleText === name ? { absolute: name } : titleText,
    description,
    keywords: keywordList(settings),
    metadataBase: origin ? new URL(origin) : undefined,
    alternates: origin ? { canonical: path } : undefined,
    robots: { index, follow: index },
    openGraph: {
      title: titleText,
      description,
      siteName: name,
      type: page?.type || "website",
      url: origin ? `${origin}${path}` : undefined,
      images: [image],
    },
    twitter: { card: "summary_large_image", title: titleText, description, images: [image] },
  };
}

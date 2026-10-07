import type { MetadataRoute } from "next";
import { siteOrigin } from "@/lib/seo";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const settings = await getSettings();
  const origin = siteOrigin(settings);
  if (!settings.seo.index) {
    return { rules: { userAgent: "*", disallow: "/" } };
  }
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/login", "/api"] },
    sitemap: origin ? `${origin}/sitemap.xml` : undefined,
  };
}

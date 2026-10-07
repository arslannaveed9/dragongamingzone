import { connectDB } from "@/lib/mongodb";
import { pageMetadata, siteDescription, siteName, siteOrigin } from "@/lib/seo";
import { ensureBootstrap } from "@/services/bootstrap";
import { listGallery } from "@/services/gallery-service";
import { getLiveBoard, toPublicBoard } from "@/services/live-service";
import { getSettings } from "@/services/settings-service";
import { HomeView } from "@/components/public/home-view";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  return pageMetadata(settings, {
    title: settings.seo.homeTitle || siteName(settings),
    description: settings.seo.homeDescription || siteDescription(settings),
    path: "/",
  });
}

export default async function HomePage() {
  let initial = null;
  let initialGallery: { id: string; caption: string }[] = [];
  let jsonLd: Record<string, unknown> | null = null;
  try {
    const settings = await getSettings();
    const origin = siteOrigin(settings);
    jsonLd = {
      "@context": "https://schema.org",
      "@type": "EntertainmentBusiness",
      name: settings.business.name,
      description: siteDescription(settings),
      url: origin || undefined,
      telephone: settings.business.phone || undefined,
      image: origin ? `${origin}/api/public/og` : undefined,
      address: settings.business.address
        ? { "@type": "PostalAddress", streetAddress: settings.business.address }
        : undefined,
    };
    await connectDB();
    await ensureBootstrap();
    const [board, gallery] = await Promise.all([
      getLiveBoard().then((value) => JSON.parse(JSON.stringify(toPublicBoard(value)))),
      listGallery(),
    ]);
    initial = board;
    initialGallery = gallery;
  } catch {
    initial = null;
  }
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <HomeView initial={initial} initialGallery={initialGallery} />
    </>
  );
}

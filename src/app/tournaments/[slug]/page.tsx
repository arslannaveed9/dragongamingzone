import { cache } from "react";
import { TournamentDetailView } from "@/components/public/tournaments-view";
import { pageMetadata } from "@/lib/seo";
import { getPublishedTournament } from "@/services/tournament-service";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

type Context = { params: Promise<{ slug: string }> };

const loadTournament = cache(async (slug: string) => getPublishedTournament(decodeURIComponent(slug)));

export async function generateMetadata({ params }: Context) {
  const { slug } = await params;
  const [settings, item] = await Promise.all([getSettings(), loadTournament(slug)]);
  if (!item) return pageMetadata(settings, { title: "Tournament not found", path: `/tournaments/${slug}`, noindex: true });
  return pageMetadata(settings, {
    title: item.title,
    description: item.summary || `${item.game} at ${settings.business.name}. Entry ${item.entryFeeLabel}.`,
    path: `/tournaments/${item.slug}`,
    image: item.hasPoster ? `/api/public/tournaments/${item.slug}/poster` : undefined,
  });
}

export default async function TournamentPage({ params }: Context) {
  const { slug } = await params;
  const [settings, item] = await Promise.all([getSettings(), loadTournament(slug)]);
  const jsonLd = item
    ? {
        "@context": "https://schema.org",
        "@type": "SportsEvent",
        name: item.title,
        description: item.summary || item.rules,
        startDate: item.startsAtIso,
        endDate: item.endsAtIso,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: { "@type": "Place", name: settings.business.name, address: settings.business.address || undefined },
        offers: {
          "@type": "Offer",
          price: item.entryFee,
          priceCurrency: settings.system.currency || "PKR",
          availability: item.entryWindow === "closed" || item.entryWindow === "full" ? "https://schema.org/SoldOut" : "https://schema.org/InStock",
        },
      }
    : null;
  return (
    <>
      {jsonLd ? <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} /> : null}
      <TournamentDetailView item={item} whatsapp={settings.business.whatsapp} />
    </>
  );
}

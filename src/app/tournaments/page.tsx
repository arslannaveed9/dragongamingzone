import { TournamentsListView } from "@/components/public/tournaments-view";
import { pageMetadata, siteDescription } from "@/lib/seo";
import { listPublicTournaments } from "@/services/tournament-service";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  return pageMetadata(settings, {
    title: settings.seo.tournamentsTitle || "Tournaments",
    description: settings.seo.tournamentsDescription || siteDescription(settings),
    path: "/tournaments",
  });
}

export default async function TournamentsPage() {
  const settings = await getSettings();
  const board = await listPublicTournaments();
  return (
    <TournamentsListView
      {...board}
      heading={settings.seo.tournamentsTitle || "Tournaments"}
      intro={settings.seo.tournamentsDescription || "Ongoing and upcoming events, with entry fees and late entry fees."}
    />
  );
}

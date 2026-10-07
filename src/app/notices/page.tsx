import { NoticesView } from "@/components/public/notices-view";
import { pageMetadata, siteDescription } from "@/lib/seo";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  const settings = await getSettings();
  return pageMetadata(settings, {
    title: settings.seo.noticesTitle || "Notices",
    description: settings.seo.noticesDescription || siteDescription(settings),
    path: "/notices",
  });
}

export default function NoticesPage() {
  return <NoticesView />;
}

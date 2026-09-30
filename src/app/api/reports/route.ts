import { authed } from "@/lib/http";
import { getGamingDay } from "@/lib/gaming-day";
import { allTimeStats, buildReport } from "@/services/report-service";
import { getSettings } from "@/services/settings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function resolveReportRange(today: string, preset: string | null, from: string | null, to: string | null) {
  if (from || to) return { from: from || today, to: to || today };
  if (preset === "month") return { from: `${today.slice(0, 7)}-01`, to: today };
  if (preset === "last-month") {
    const [year, month] = today.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 2, 1));
    const end = new Date(Date.UTC(year, month - 1, 0));
    const stamp = (date: Date) => date.toISOString().slice(0, 10);
    return { from: stamp(start), to: stamp(end) };
  }
  if (preset === "year") {
    const [year, month] = today.split("-").map(Number);
    const start = new Date(Date.UTC(year, month - 12, 1));
    return { from: start.toISOString().slice(0, 10), to: today };
  }
  return { from: today, to: today };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  return authed("reports.view", async () => {
    if (url.searchParams.get("scope") === "all-time") return allTimeStats();
    const settings = await getSettings();
    const today = getGamingDay(new Date(), settings.operatingHours);
    const range = resolveReportRange(today, url.searchParams.get("preset"), url.searchParams.get("from"), url.searchParams.get("to"));
    return buildReport(range.from, range.to);
  });
}

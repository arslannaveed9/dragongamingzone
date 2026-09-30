import { figuresUnlocked } from "@/lib/figures";
import { authed } from "@/lib/http";
import { getLiveBoard } from "@/services/live-service";
import { figuresPasswordConfigured } from "@/services/settings-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const gamingDay = new URL(request.url).searchParams.get("gamingDay") || undefined;
  return authed("stations.view", async () => {
    const board = await getLiveBoard(gamingDay);
    const show = (await figuresUnlocked()) && (await figuresPasswordConfigured());
    if (show) return { ...board, figuresUnlocked: true };
    return {
      ...board,
      figuresUnlocked: false,
      stations: board.stations.map((station) => ({
        ...station,
        current: station.current ? { ...station.current, finalAmount: null } : null,
        next: station.next ? { ...station.next, finalAmount: null } : null,
      })),
    };
  }, { sweep: true });
}

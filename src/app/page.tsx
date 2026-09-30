import { connectDB } from "@/lib/mongodb";
import { ensureBootstrap } from "@/services/bootstrap";
import { getLiveBoard, toPublicBoard } from "@/services/live-service";
import { HomeView } from "@/components/public/home-view";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let initial = null;
  try {
    await connectDB();
    await ensureBootstrap();
    initial = JSON.parse(JSON.stringify(toPublicBoard(await getLiveBoard())));
  } catch {
    initial = null;
  }
  return <HomeView initial={initial} />;
}

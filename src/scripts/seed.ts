/**
 * Development-only sample stations.
 * Run with SEED_DEV=true. Refuses to insert if any station already exists.
 * Production stations must be created from the admin panel.
 */
import { connectDB } from "@/lib/mongodb";
import { ensureBootstrap } from "@/services/bootstrap";
import { Station } from "@/models/station";
import { StationType } from "@/models/station-type";

async function main() {
  if (process.env.SEED_DEV !== "true") {
    console.error("Refusing to seed. Set SEED_DEV=true to insert development sample stations.");
    process.exit(1);
  }
  await connectDB();
  await ensureBootstrap();
  const existing = await Station.countDocuments();
  if (existing > 0) {
    console.log("Stations already exist. Nothing was inserted.");
    return;
  }

  console.log("Inserting DEVELOPMENT sample stations. These are examples, not production data.");
  const types = await StationType.create([
    { name: "PS5", slug: "ps5", sortOrder: 1 },
    { name: "PS4", slug: "ps4", sortOrder: 2 },
    { name: "PC", slug: "pc", sortOrder: 3 },
  ]);
  const byName = Object.fromEntries(types.map((type: { name: string; _id: unknown }) => [type.name, type._id]));
  await Station.create([
    station("PS5-01", byName.PS5, 0),
    station("PS5-02", byName.PS5, 1),
    station("PS4-01", byName.PS4, 2),
    station("PC-01", byName.PC, 3),
    station("PC-02", byName.PC, 4),
  ]);
  console.log("Sample stations created. Change their prices in Stations → Setup before using them for real customers.");
}

function station(name: string, typeId: unknown, sortOrder: number) {
  return {
    name,
    typeId,
    sortOrder,
    maxControllers: 4,
    operationalStatus: "active",
    pricing: { per30Min: 150, perHour: 250, additionalPer30Min: 30, additionalPerHour: 50, controllerOverrides: [] },
  };
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

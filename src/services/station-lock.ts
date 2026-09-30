import { randomUUID } from "crypto";
import { AppError } from "@/lib/errors";
import { Station } from "@/models/station";

const STALE_MS = 20_000;

async function acquire(stationId: string): Promise<string> {
  const token = randomUUID();
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const staleBefore = new Date(Date.now() - STALE_MS);
    const result = await Station.updateOne(
      {
        _id: stationId,
        $or: [{ lockToken: null }, { lockedAt: { $lte: staleBefore } }],
      },
      { $set: { lockToken: token, lockedAt: new Date() } },
    );
    if (result.modifiedCount === 1) return token;
    await new Promise((resolve) => setTimeout(resolve, 40 + attempt * 20));
  }
  throw new AppError(409, "STATION_BUSY", "This station is being updated. Try again.");
}

/** Serializes booking writes per station, including on a standalone MongoDB server. */
export async function withStationLocks<T>(stationIds: string[], fn: () => Promise<T>): Promise<T> {
  const ids = [...new Set(stationIds)].filter(Boolean).sort();
  const tokens = new Map<string, string>();
  const acquired: string[] = [];
  try {
    for (const id of ids) {
      tokens.set(id, await acquire(id));
      acquired.push(id);
    }
    return await fn();
  } finally {
    for (const id of [...acquired].reverse()) {
      await Station.updateOne(
        { _id: id, lockToken: tokens.get(id) },
        { $set: { lockToken: null, lockedAt: null } },
      );
    }
  }
}

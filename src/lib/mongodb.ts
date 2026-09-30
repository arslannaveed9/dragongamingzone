import mongoose from "mongoose";
import { AppError } from "@/lib/errors";

type Cache = {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
};

const globalCache = globalThis as typeof globalThis & { __gzMongoose?: Cache };

function cache(): Cache {
  if (!globalCache.__gzMongoose) {
    globalCache.__gzMongoose = { conn: null, promise: null };
  }
  return globalCache.__gzMongoose;
}

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new AppError(500, "CONFIG", "Database is not configured. Set MONGODB_URI.");
  }
  const state = cache();
  if (state.conn) return state.conn;
  if (!state.promise) {
    state.promise = mongoose.connect(uri, { bufferCommands: false }).catch((error) => {
      state.promise = null;
      throw error;
    });
  }
  state.conn = await state.promise;
  await import("@/models/register");
  return state.conn;
}

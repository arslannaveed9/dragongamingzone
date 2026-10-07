import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const tournamentSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, trim: true },
    game: { type: String, required: true, trim: true },
    format: { type: String, enum: ["solo", "team"], default: "solo" },
    teamSize: { type: Number, default: 1 },
    summary: { type: String, default: "" },
    rules: { type: String, default: "" },
    startsAt: { type: Date, required: true },
    endsAt: { type: Date, required: true },
    checkInAt: { type: Date, default: null },
    entryOpensAt: { type: Date, default: null },
    entryClosesAt: { type: Date, default: null },
    entryFee: { type: Number, default: 0 },
    lateEntryFee: { type: Number, default: 0 },
    lateEntryClosesAt: { type: Date, default: null },
    maxEntries: { type: Number, default: 0 },
    entriesTaken: { type: Number, default: 0 },
    prizePool: { type: Number, default: 0 },
    prizeFirst: { type: String, default: "" },
    prizeSecond: { type: String, default: "" },
    prizeThird: { type: String, default: "" },
    prizeFirstAmount: { type: Number, default: 0 },
    prizeSecondAmount: { type: Number, default: 0 },
    prizeThirdAmount: { type: Number, default: 0 },
    otherCost: { type: Number, default: 0 },
    otherCostNote: { type: String, default: "" },
    joinNote: { type: String, default: "" },
    posterDataUrl: { type: String, default: "" },
    published: { type: Boolean, default: true },
    cancelled: { type: Boolean, default: false },
    featured: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type TournamentDocument = InferSchemaType<typeof tournamentSchema> & { _id: Types.ObjectId; createdAt: Date };

// A model compiled before these money fields existed cannot persist them.
// schema.add writes the defaults once and then ignores later edits, so replace that model.
const TOURNAMENT_MODEL_VERSION = 2;
type VersionedModel = mongoose.Model<TournamentDocument> & { modelVersion?: number };
const cached = mongoose.models.Tournament as VersionedModel | undefined;
if (cached && cached.modelVersion !== TOURNAMENT_MODEL_VERSION) {
  mongoose.deleteModel("Tournament");
}

export const Tournament = (mongoose.models.Tournament ||
  mongoose.model("Tournament", tournamentSchema)) as VersionedModel;
Tournament.modelVersion = TOURNAMENT_MODEL_VERSION;

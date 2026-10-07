import mongoose, { Schema, type InferSchemaType, type Types } from "mongoose";

const tournamentEntrySchema = new Schema(
  {
    tournamentId: { type: Schema.Types.ObjectId, required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, default: "", trim: true },
    teamName: { type: String, default: "", trim: true },
    kind: { type: String, enum: ["regular", "late"], default: "regular" },
    feeDue: { type: Number, default: 0 },
    amountPaid: { type: Number, default: 0 },
    place: { type: Number, default: 0 },
    note: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export type TournamentEntryDocument = InferSchemaType<typeof tournamentEntrySchema> & { _id: Types.ObjectId };
export const TournamentEntry = mongoose.models.TournamentEntry || mongoose.model("TournamentEntry", tournamentEntrySchema);

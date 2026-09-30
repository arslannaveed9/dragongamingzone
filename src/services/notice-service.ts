import { DateTime } from "luxon";
import { AppError } from "@/lib/errors";
import { Notice } from "@/models/notice";
import { writeAudit } from "@/services/audit-service";
import type { Actor } from "@/services/auth-service";
import { getSettings } from "@/services/settings-service";

export type NoticeView = {
  id: string;
  audience: "staff" | "public";
  title: string;
  body: string;
  active: boolean;
  authorName: string;
  createdAt: string;
  postedAt: string;
};

function plain(doc: {
  _id: unknown;
  audience: string;
  title: string;
  body: string;
  active?: boolean;
  authorName?: string;
  createdAt?: Date;
}, timezone: string): NoticeView {
  const createdAt = doc.createdAt ? new Date(doc.createdAt).toISOString() : "";
  const postedAt = doc.createdAt
    ? DateTime.fromJSDate(new Date(doc.createdAt)).setZone(timezone).toFormat("d LLL yyyy, h:mm a")
    : "";
  return {
    id: String(doc._id),
    audience: doc.audience === "public" ? "public" : "staff",
    title: doc.title,
    body: doc.body,
    active: doc.active !== false,
    authorName: doc.authorName || "",
    createdAt,
    postedAt,
  };
}

export async function listNotices(filter: { audience?: "staff" | "public"; activeOnly?: boolean }) {
  const settings = await getSettings();
  const query: Record<string, unknown> = {};
  if (filter.audience) query.audience = filter.audience;
  if (filter.activeOnly) query.active = true;
  const rows = await Notice.find(query).sort({ createdAt: -1 }).limit(100).lean();
  return rows.map((row) => plain(row as never, settings.operatingHours.timezone));
}

export async function createNotice(input: { audience: "staff" | "public"; title: string; body: string }, actor: Actor) {
  const created = await Notice.create({
    audience: input.audience,
    title: input.title,
    body: input.body,
    active: true,
    authorName: actor.name,
  });
  await writeAudit({
    actor,
    action: "notice.created",
    entity: "notice",
    entityId: String(created._id),
    newValue: { audience: input.audience, title: input.title },
  });
  const settings = await getSettings();
  return plain(created, settings.operatingHours.timezone);
}

export async function setNoticeActive(id: string, active: boolean, actor: Actor) {
  const existing = await Notice.findById(id);
  if (!existing) throw new AppError(404, "NOT_FOUND", "Notice not found.");
  existing.active = active;
  await existing.save();
  await writeAudit({
    actor,
    action: active ? "notice.shown" : "notice.hidden",
    entity: "notice",
    entityId: id,
    newValue: { active, title: existing.title },
  });
  const settings = await getSettings();
  return plain(existing, settings.operatingHours.timezone);
}

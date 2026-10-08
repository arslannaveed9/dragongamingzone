export type ChangeLine = { label: string; before: string | null; after: string | null };

const LABELS: Record<string, string> = {
  customerName: "Customer",
  customerPhone: "Phone",
  stationName: "Station",
  stationTypeName: "Station type",
  gamingDay: "Gaming day",
  startAt: "Start",
  endAt: "End",
  durationMinutes: "Duration (minutes)",
  controllerCount: "Controllers",
  status: "Status",
  paused: "Paused",
  paymentStatus: "Payment status",
  amountPaid: "Received",
  finalAmount: "Total",
  "pricing.finalAmount": "Total",
  notes: "Notes",
  cancelReason: "Cancel reason",
  reason: "Reason",
  amount: "Amount",
  method: "Method",
  title: "Title",
  name: "Name",
  slug: "Slug",
  operationalStatus: "Station status",
  caption: "Caption",
  published: "Published",
  imported: "Imported bookings",
  skipped: "Skipped rows",
  invalid: "Invalid rows",
  revenue: "Revenue",
  payments: "Payments removed",
  orders: "Counter sales removed",
  bookingNumber: "Booking",
};

const SKIP = new Set([
  "id",
  "_id",
  "customerId",
  "stationId",
  "stationTypeId",
  "createdByName",
  "updatedBy",
  "updatedByName",
  "remainingMs",
  "autoCompleted",
  "breakdown",
  "appliedDiscount",
  "appliedRuleName",
  "currency",
  "createdAt",
  "updatedAt",
  "pausedAt",
  "cancelledAt",
  "completedAt",
]);

function text(value: unknown): string {
  if (value == null || value === "") return "";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") return String(value);
  if (typeof value === "string") return value;
  return "";
}

function collect(value: unknown, prefix = ""): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (SKIP.has(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      if (!prefix) Object.assign(out, collect(child, key));
      continue;
    }
    const rendered = text(child);
    if (LABELS[path] || LABELS[key] || !prefix) out[path] = rendered;
  }
  return out;
}

function labelFor(path: string) {
  if (LABELS[path]) return LABELS[path];
  const key = path.split(".").pop() || path;
  if (LABELS[key]) return LABELS[key];
  return key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/^./, (char) => char.toUpperCase());
}

/** Field-level before and after lines for one audit entry. */
export function describeChanges(oldValue: unknown, newValue: unknown): ChangeLine[] {
  const before = collect(oldValue);
  const after = collect(newValue);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])];
  const lines: ChangeLine[] = [];
  for (const key of keys) {
    const from = key in before ? before[key] : null;
    const to = key in after ? after[key] : null;
    if (from === to) continue;
    if (!from && !to) continue;
    lines.push({ label: labelFor(key), before: from, after: to });
  }
  return lines;
}

export function actionLabel(action: string) {
  return action
    .split(".")
    .map((part) => part.replace(/_/g, " "))
    .join(" · ")
    .replace(/^./, (char) => char.toUpperCase());
}

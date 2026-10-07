import { readXlsxSheets, type SheetGrid } from "@/lib/xlsx";

export type LegacyBooking = {
  id: string;
  station: string;
  customer: string;
  phone: string;
  source: "walk_in" | "reservation";
  start: string;
  end: string;
  durationMinutes: number;
  controllers: number;
  baseAmount: number;
  controllerAmount: number;
  totalAmount: number;
  discount: number;
  collected: number;
  refund: number;
  method: "cash" | "other";
  paymentStatus: "paid" | "partial" | "unpaid" | "refunded";
  notes: string;
};

const COLUMNS: Record<string, keyof LegacyBooking | "ignore"> = {
  "booking id": "id",
  station: "station",
  customer: "customer",
  phone: "phone",
  type: "source",
  "actual start": "start",
  "scheduled start": "ignore",
  "actual end": "end",
  "duration (min)": "durationMinutes",
  controllers: "controllers",
  "base amount": "baseAmount",
  "extra controller": "controllerAmount",
  "total amount": "totalAmount",
  discount: "discount",
  collected: "collected",
  refund: "refund",
  "payment method": "method",
  "payment status": "paymentStatus",
  notes: "notes",
};

function money(value: string | undefined) {
  const amount = Number(String(value || "").replace(/,/g, ""));
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
}

function paymentStatus(value: string): LegacyBooking["paymentStatus"] {
  const label = value.trim().toLowerCase();
  if (label === "partial") return "partial";
  if (label === "unpaid") return "unpaid";
  if (label === "refunded") return "refunded";
  return "paid";
}

export function legacyBookingsFromSheets(sheets: SheetGrid[]): LegacyBooking[] {
  const bookings: LegacyBooking[] = [];
  const seen = new Set<string>();
  for (const sheet of sheets) {
    const entries = Object.entries(sheet.rows);
    for (const [rowText, cells] of entries) {
      if ((cells.A || "").trim().toLowerCase() !== "booking id") continue;
      const fields = new Map<keyof LegacyBooking, string>();
      let scheduled = "";
      for (const [column, label] of Object.entries(cells)) {
        const key = COLUMNS[label.trim().toLowerCase()];
        if (key && key !== "ignore") fields.set(key, column);
        if (label.trim().toLowerCase() === "scheduled start") scheduled = column;
      }
      const headerRow = Number(rowText);
      for (const [nextText, next] of entries) {
        const row = Number(nextText);
        if (row <= headerRow) continue;
        const id = (next[fields.get("id") || ""] || "").trim();
        if (!id || id.toLowerCase() === "booking id") continue;
        if (!/^[a-z0-9-]{8,}$/i.test(id)) break;
        if (seen.has(id)) continue;
        seen.add(id);
        const start = (next[fields.get("start") || ""] || next[scheduled] || "").trim();
        const type = (next[fields.get("source") || ""] || "").trim().toLowerCase();
        bookings.push({
          id,
          station: (next[fields.get("station") || ""] || "").trim(),
          customer: (next[fields.get("customer") || ""] || "").trim() || "Walk-in",
          phone: (next[fields.get("phone") || ""] || "").trim(),
          source: type === "future" || type === "reservation" ? "reservation" : "walk_in",
          start,
          end: (next[fields.get("end") || ""] || "").trim(),
          durationMinutes: Math.round(money(next[fields.get("durationMinutes") || ""])),
          controllers: Math.max(1, Math.round(money(next[fields.get("controllers") || ""])) || 1),
          baseAmount: money(next[fields.get("baseAmount") || ""]),
          controllerAmount: money(next[fields.get("controllerAmount") || ""]),
          totalAmount: money(next[fields.get("totalAmount") || ""]),
          discount: money(next[fields.get("discount") || ""]),
          collected: money(next[fields.get("collected") || ""]),
          refund: money(next[fields.get("refund") || ""]),
          method: (next[fields.get("method") || ""] || "").trim().toLowerCase() === "cash" ? "cash" : "other",
          paymentStatus: paymentStatus(next[fields.get("paymentStatus") || ""] || ""),
          notes: (next[fields.get("notes") || ""] || "").trim().slice(0, 500),
        });
      }
    }
  }
  return bookings;
}

export function readLegacyReport(buffer: Buffer) {
  return legacyBookingsFromSheets(readXlsxSheets(buffer));
}

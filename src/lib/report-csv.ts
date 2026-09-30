export type CsvDay = { gamingDay: string; bookings: number; hours: number; revenue: number };

function cell(value: string | number) {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function reportToCsv(report: {
  from: string;
  to: string;
  summary: { bookings: number; hours: number; revenue: number; utilization: number };
  series: { gamingDay: string; bookings: number; hours: number; revenue: number }[];
  months: { month: string; bookings: number; hours: number; revenue: number }[];
  stations: { name: string; typeName: string; bookings: number; hours: number; revenue: number; utilization: number }[];
}) {
  const lines = ["kind,label,bookings,hours,revenue,extra"];
  lines.push(["summary", `${report.from} to ${report.to}`, report.summary.bookings, report.summary.hours, report.summary.revenue, report.summary.utilization].map(cell).join(","));
  for (const day of report.series) lines.push(["daily", day.gamingDay, day.bookings, day.hours, day.revenue, ""].map(cell).join(","));
  for (const month of report.months) lines.push(["monthly", month.month, month.bookings, month.hours, month.revenue, ""].map(cell).join(","));
  for (const station of report.stations) {
    lines.push(["station", station.name, station.bookings, station.hours, station.revenue, `${station.typeName} ${station.utilization}%`].map(cell).join(","));
  }
  return `${lines.join("\n")}\n`;
}

export function parseReportCsv(text: string): CsvDay[] {
  const rows = text.replace(/^\uFEFF/, "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (rows.length === 0) return [];
  const header = rows[0].toLowerCase();
  const days: CsvDay[] = [];
  if (header.startsWith("kind,")) {
    for (const line of rows.slice(1)) {
      const [kind, label, bookings, hours, revenue] = splitCsv(line);
      if (kind !== "daily" || !/^\d{4}-\d{2}-\d{2}$/.test(label)) continue;
      days.push({ gamingDay: label, bookings: Number(bookings) || 0, hours: Number(hours) || 0, revenue: Number(revenue) || 0 });
    }
    return days;
  }
  const columns = splitCsv(rows[0]).map((column) => column.toLowerCase());
  const dayIndex = columns.findIndex((column) => column === "gamingday" || column === "date" || column === "label");
  const bookingsIndex = columns.indexOf("bookings");
  const hoursIndex = columns.indexOf("hours");
  const revenueIndex = columns.indexOf("revenue");
  if (dayIndex < 0) return [];
  for (const line of rows.slice(1)) {
    const cells = splitCsv(line);
    const gamingDay = cells[dayIndex] || "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(gamingDay)) continue;
    days.push({
      gamingDay,
      bookings: Number(cells[bookingsIndex] || 0) || 0,
      hours: Number(cells[hoursIndex] || 0) || 0,
      revenue: Number(cells[revenueIndex] || 0) || 0,
    });
  }
  return days;
}

function splitCsv(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else current += char;
  }
  cells.push(current);
  return cells;
}

import { describe, expect, it } from "vitest";
import { parseReportCsv, reportToCsv } from "@/lib/report-csv";

describe("report csv", () => {
  const report = {
    from: "2026-09-01",
    to: "2026-09-02",
    summary: { bookings: 3, hours: 2, revenue: 450, utilization: 10 },
    series: [
      { gamingDay: "2026-09-01", bookings: 1, hours: 1, revenue: 150 },
      { gamingDay: "2026-09-02", bookings: 2, hours: 1, revenue: 300 },
    ],
    months: [{ month: "2026-09", bookings: 3, hours: 2, revenue: 450 }],
    stations: [{ name: "PS5, 01", typeName: "PS5", bookings: 3, hours: 2, revenue: 450, utilization: 10 }],
  };

  it("round-trips daily rows, including commas in station names", () => {
    const days = parseReportCsv(reportToCsv(report));
    expect(days).toEqual([
      { gamingDay: "2026-09-01", bookings: 1, hours: 1, revenue: 150 },
      { gamingDay: "2026-09-02", bookings: 2, hours: 1, revenue: 300 },
    ]);
  });

  it("reads a plain date spreadsheet", () => {
    const days = parseReportCsv("date,bookings,hours,revenue\n2026-09-01,4,2.5,600\n");
    expect(days).toEqual([{ gamingDay: "2026-09-01", bookings: 4, hours: 2.5, revenue: 600 }]);
  });
});
import { describe, expect, it } from "vitest";
import { describeChanges } from "@/lib/audit-changes";

describe("describeChanges", () => {
  it("shows only the fields that changed", () => {
    expect(
      describeChanges(
        { customerName: "Ali", status: "scheduled", finalAmount: 500 },
        { customerName: "Sara", status: "scheduled", finalAmount: 700 },
      ),
    ).toEqual([
      { label: "Customer", before: "Ali", after: "Sara" },
      { label: "Total", before: "500", after: "700" },
    ]);
  });

  it("shows a recorded value when the other side was not stored", () => {
    expect(describeChanges(null, { amount: 200, method: "cash" })).toEqual([
      { label: "Amount", before: null, after: "200" },
      { label: "Method", before: null, after: "cash" },
    ]);
  });
});
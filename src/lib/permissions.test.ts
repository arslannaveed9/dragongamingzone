import { describe, expect, it } from "vitest";
import { pagesForRole, permissionForPath } from "@/lib/permissions";

describe("staff page plan", () => {
  it("shows only the floor pages to a new staff user", () => {
    expect(pagesForRole("staff").map((page) => page.label)).toEqual([
      "Dashboard",
      "Bookings",
    ]);
  });

  it("keeps setup and finance pages off the staff sidebar", () => {
    const labels = pagesForRole("staff").map((page) => page.label);
    for (const hidden of ["Stations", "Customers", "Reports", "Pricing", "Discounts", "POS", "Settings", "Audit Logs", "Users"]) {
      expect(labels).not.toContain(hidden);
    }
  });

  it("blocks a staff URL even when the sidebar link is missing", () => {
    expect(permissionForPath("/dashboard/settings")).toBe("settings.manage");
    expect(permissionForPath("/dashboard/bookings/abc")).toBe("bookings.view");
    expect(permissionForPath("/dashboard")).toBe("dashboard.view");
  });
});

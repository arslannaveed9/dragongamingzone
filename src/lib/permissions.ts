export const ROLES = ["owner", "admin", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

/**
 * Permissions are checked on the server for every mutation.
 * Adding a role later means extending this map — routes should never
 * compare role strings directly.
 */
export const PERMISSIONS = {
  "dashboard.view": ["owner", "admin", "manager", "staff"],
  "stations.view": ["owner", "admin", "manager", "staff"],
  "stations.manage": ["owner", "admin", "manager"],
  "bookings.view": ["owner", "admin", "manager", "staff"],
  "bookings.create": ["owner", "admin", "manager", "staff"],
  "bookings.update": ["owner", "admin", "manager", "staff"],
  "bookings.cancel": ["owner", "admin", "manager", "staff"],
  "bookings.backdate": ["owner", "admin", "manager"],
  "bookings.reduce_time": ["owner", "admin", "manager"],
  "bookings.correct": ["owner", "admin"],
  "pricing.manage": ["owner", "admin"],
  "discounts.manage": ["owner", "admin", "manager"],
  "customers.manage": ["owner", "admin", "manager"],
  "reports.view": ["owner", "admin", "manager"],
  "settings.manage": ["owner", "admin"],
  "users.manage": ["owner", "admin"],
  "audit.view": ["owner", "admin"],
  "notices.manage": ["owner"],
  "tournaments.manage": ["owner"],
  "payments.record": ["owner", "admin", "manager", "staff"],
  "payments.refund": ["owner", "admin", "manager"],
  "pos.view": ["owner", "admin", "manager"],
  "pos.manage": ["owner", "admin", "manager"],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly Role[]).includes(role);
}

export function isRole(value: string): value is Role {
  return (ROLES as readonly string[]).includes(value);
}

/** Admins may manage staff and managers. Only an owner may create or edit owners. */
export function canManageRole(actor: Role, target: Role): boolean {
  if (actor === "owner") return true;
  if (actor === "admin") return target !== "owner";
  return false;
}

export function assignableRoles(actor: Role): Role[] {
  return ROLES.filter((role) => canManageRole(actor, role));
}

/** Sidebar pages, in display order. The same list decides what a role can open. `sidebar: false` keeps the URL protected without a menu link. */
export const NAV_PAGES: { href: string; label: string; permission: Permission; note: string; sidebar?: boolean }[] = [
  { href: "/dashboard", label: "Dashboard", permission: "dashboard.view", note: "Floor grid, timeline, and today's totals" },
  { href: "/dashboard/stations", label: "Stations", permission: "stations.manage", note: "Add stations, controllers, and rates" },
  { href: "/dashboard/bookings", label: "Bookings", permission: "bookings.view", note: "Booking history and details" },
  { href: "/dashboard/customers", label: "Customers", permission: "customers.manage", note: "Search customers and their visits" },
  { href: "/dashboard/reports", label: "Reports", permission: "reports.view", note: "Gaming-day revenue, hours, and utilization" },
  { href: "/dashboard/pricing", label: "Pricing", permission: "pricing.manage", note: "Special rate rules" },
  { href: "/dashboard/discounts", label: "Discounts", permission: "discounts.manage", note: "Time and weekday discounts" },
  { href: "/dashboard/pos", label: "POS", permission: "pos.view", note: "Sell drinks and snacks at the counter", sidebar: false },
  { href: "/dashboard/notices", label: "Notices", permission: "notices.manage", note: "Messages for staff and the public site" },
  { href: "/dashboard/tournaments", label: "Tournaments", permission: "tournaments.manage", note: "Entry fees, late fees, prizes, and the public tournaments page" },
  { href: "/dashboard/gallery", label: "Gallery", permission: "settings.manage", note: "Photos shown on the public homepage" },
  { href: "/dashboard/blog", label: "Blog", permission: "settings.manage", note: "Posts on the public blog" },
  { href: "/dashboard/settings", label: "Settings", permission: "settings.manage", note: "Business info, hours, and currency" },
  { href: "/dashboard/audit", label: "Audit Logs", permission: "audit.view", note: "Who changed bookings, prices, and settings" },
  { href: "/dashboard/users", label: "Users", permission: "users.manage", note: "Accounts, passwords, and login sessions" },
];

export const ROLE_LABEL: Record<Role, string> = {
  staff: "Staff",
  manager: "Manager",
  admin: "Admin",
  owner: "Owner",
};

/** What an owner should expect when they create an account of this role. */
export const ROLE_PLAN: Record<Role, string> = {
  staff: "Floor cashier. They start walk-ins and take reservations. The counter, customer directory, station setup, reports, prices, discounts, settings, the audit log, and other accounts stay hidden. They also cannot backdate a booking, shorten a session, or issue a refund.",
  manager: "Floor lead. Everything staff can do, plus reports, discounts, station setup, product setup, refunds, and corrections to past bookings.",
  admin: "Operations. Everything a manager can do, plus pricing rules, business settings, the audit log, and staff accounts. An admin cannot create or edit an owner.",
  owner: "Full access, including other owner accounts.",
};

export function pagesForRole(role: Role) {
  return NAV_PAGES.filter((page) => page.sidebar !== false && can(role, page.permission));
}

export function permissionForPath(pathname: string): Permission | null {
  const match = [...NAV_PAGES]
    .sort((a, b) => b.href.length - a.href.length)
    .find((page) => (page.href === "/dashboard" ? pathname === "/dashboard" : pathname === page.href || pathname.startsWith(`${page.href}/`)));
  return match?.permission ?? null;
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ClipboardList,
  Gamepad2,
  Images,
  LayoutDashboard,
  Newspaper,
  Trophy,
  LogOut,
  Megaphone,
  Menu,
  Percent,
  Receipt,
  ScrollText,
  Settings,
  Tags,
  Users,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { can, NAV_PAGES, type Permission, type Role } from "@/lib/permissions";
import { api, openBooking, usePoll } from "@/components/admin/client";
import { BookingDialog } from "@/components/admin/booking-dialog";
import { ThemeToggle } from "@/components/theme-toggle";

const ICONS: Record<string, typeof LayoutDashboard> = {
  "/dashboard": LayoutDashboard,
  "/dashboard/stations": Gamepad2,
  "/dashboard/bookings": ClipboardList,
  "/dashboard/customers": Users,
  "/dashboard/reports": Receipt,
  "/dashboard/pricing": Tags,
  "/dashboard/discounts": Percent,
  "/dashboard/notices": Megaphone,
  "/dashboard/tournaments": Trophy,
  "/dashboard/gallery": Images,
  "/dashboard/blog": Newspaper,
  "/dashboard/settings": Settings,
  "/dashboard/audit": ScrollText,
  "/dashboard/users": Users,
};

const LINKS: { href: string; label: string; icon: typeof LayoutDashboard; permission: Permission }[] = NAV_PAGES.filter((page) => page.sidebar !== false).map((page) => ({
  ...page,
  icon: ICONS[page.href] || LayoutDashboard,
}));

export function AdminShell({
  user,
  businessName,
  children,
}: {
  user: { id: string; name: string; email: string; role: Role };
  businessName: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [bookingOpen, setBookingOpen] = useState(false);
  const [preset, setPreset] = useState<{ mode?: "walk_in" | "reservation"; stationId?: string; gamingDay?: string; startTime?: string; bookingId?: string }>();
  const { data: staffNotices } = usePoll<{ id: string; title: string; body: string }[]>("/api/notices", 20000);

  useEffect(() => {
    const onBook = (event: Event) => {
      setPreset((event as CustomEvent).detail || { mode: "walk_in" });
      setBookingOpen(true);
    };
    window.addEventListener("gz-book", onBook);
    return () => window.removeEventListener("gz-book", onBook);
  }, []);

  const links = LINKS.filter((link) => can(user.role, link.permission));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  const nav = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="m-3 shrink-0 rounded-2xl bg-slate-950 p-4 text-cyan-50 ring-1 ring-cyan-700/50">
        <p className="font-heading text-xl font-bold leading-tight">{businessName}</p>
      </div>
      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain px-3 pb-2">
        {links.map((link) => {
          const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-base ${active ? "bg-sidebar-accent font-semibold text-foreground shadow-[inset_3px_0_0_0_var(--sidebar-primary)]" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"}`}
            >
              <Icon className="size-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="shrink-0 border-t border-border p-3">
        <p className="truncate text-sm font-medium">{user.name}</p>
        <p className="truncate text-xs capitalize text-muted-foreground">{user.role}</p>
        <Button variant="ghost" size="sm" className="mt-2 w-full justify-start" onClick={logout}>
          <LogOut className="size-4" />
          Sign out
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <aside className="fixed inset-y-0 left-0 hidden w-64 overflow-hidden border-r border-sidebar-border bg-sidebar md:block">{nav}</aside>
      <div className="min-w-0 md:pl-64">
        <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
          <div className="flex items-center gap-2 px-3 py-3 sm:gap-3 sm:px-4 md:px-6">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="shrink-0 md:hidden" aria-label="Open menu">
                  <Menu className="size-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-[min(18rem,88vw)] gap-0 overflow-hidden p-0">
                <SheetHeader className="sr-only">
                  <SheetTitle>Navigation</SheetTitle>
                </SheetHeader>
                {nav}
              </SheetContent>
            </Sheet>
            <div className="min-w-0 flex-1" />
            <ThemeToggle />
            <Button size="sm" className="shrink-0 px-2.5 sm:px-3.5" onClick={() => openBooking({ mode: "walk_in" })}>
              <Plus className="size-4" />
              <span className="sm:hidden">Walk-in</span>
              <span className="hidden sm:inline">New walk-in</span>
            </Button>
          </div>
          {staffNotices && staffNotices.length > 0 && (
            <div className="space-y-1 border-t border-cyan-800/40 bg-slate-950 px-4 py-2.5 text-cyan-50 md:px-6">
              {staffNotices.slice(0, 3).map((notice) => (
                <p key={notice.id} className="text-sm">
                  <span className="font-semibold">{notice.title}.</span> {notice.body}
                </p>
              ))}
            </div>
          )}
        </header>
        <main className="min-w-0 px-3 py-4 md:px-6 md:py-6">{children}</main>
      </div>
      <BookingDialog open={bookingOpen} onOpenChange={setBookingOpen} preset={preset} />
    </div>
  );
}

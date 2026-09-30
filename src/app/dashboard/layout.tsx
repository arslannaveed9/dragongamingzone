import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminShell } from "@/components/admin/shell";
import { can, permissionForPath } from "@/lib/permissions";
import { connectDB } from "@/lib/mongodb";
import { getSessionActor } from "@/services/auth-service";
import { ensureBootstrap } from "@/services/bootstrap";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  await connectDB();
  await ensureBootstrap();
  const user = await getSessionActor();
  if (!user) redirect("/login");
  const pathname = (await headers()).get("x-pathname") || "";
  const permission = permissionForPath(pathname);
  if (permission && !can(user.role, permission)) redirect("/dashboard");
  const settings = await getSettings();
  return <AdminShell user={user} businessName={settings.business.name}>{children}</AdminShell>;
}

import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { getSessionActor } from "@/services/auth-service";
import { getSettings } from "@/services/settings-service";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const user = await getSessionActor();
  if (user) redirect("/dashboard");
  const settings = await getSettings();
  return <LoginForm businessName={settings.business.name} />;
}

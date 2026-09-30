import type { Metadata } from "next";
import { Exo_2, Outfit } from "next/font/google";
import { cookies } from "next/headers";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const exo = Exo_2({
  variable: "--font-exo",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const { getSettings } = await import("@/services/settings-service");
    const settings = await getSettings();
    return {
      title: { default: settings.business.name, template: `%s · ${settings.business.name}` },
      description: settings.business.description || settings.business.name,
    };
  } catch {
    return { title: "Dragon Gaming Zone", description: "Dragon Gaming Zone" };
  }
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const theme = (await cookies()).get("gz-theme")?.value;
  const dark = theme !== "light";

  return (
    <html lang="en" className={`${outfit.variable} ${exo.variable}${dark ? " dark" : ""} h-full antialiased`} suppressHydrationWarning>
      <body className="min-h-full bg-background font-sans text-foreground">
        <TooltipProvider>{children}</TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

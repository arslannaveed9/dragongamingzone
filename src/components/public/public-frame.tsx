import type { ReactNode } from "react";

export function PublicShell({ children }: { children: ReactNode }) {
  return <main className="mx-auto min-h-screen max-w-6xl px-4 py-6">{children}</main>;
}

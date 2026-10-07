"use client";

import Link from "next/link";
import { usePoll } from "@/components/admin/client";
import { PublicShell } from "@/components/public/public-frame";
import { SiteHeader } from "@/components/public/site-header";

type Notice = { id: string; title: string; body: string; postedAt: string };
type Live = {
  withinHours: boolean;
  closedGap: boolean;
  settings: { business: { name: string; description: string; logoDataUrl: string } };
};

export function NoticesView() {
  const live = usePoll<Live>("/api/public/live", 30000);
  const { data, loading } = usePoll<Notice[]>("/api/public/notices", 20000);
  const business = live.data?.settings.business;
  const name = business?.name || "Dragon Gaming Zone";
  const open = Boolean(live.data?.withinHours && !live.data.closedGap);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader name={name} logo={business?.logoDataUrl || ""} openLabel={live.data ? (open ? "Open now" : "Closed") : undefined} open={open} />
      <PublicShell>
      <section className="mt-8">
        <p className="gz-kicker text-cyan-700 dark:text-cyan-300">From the floor</p>
        <h1 className="gz-title">Notices</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">Updates from the gaming zone. The live floor is on the home page.</p>
      </section>
      <section className="mt-6 space-y-3">
        {loading && !data && <p className="text-sm text-muted-foreground">Loading notices...</p>}
        {(data || []).map((notice) => (
          <article key={notice.id} className="gz-panel px-5 py-4">
            <p className="text-sm text-cyan-800 dark:text-cyan-300">{notice.postedAt}</p>
            <h2 className="mt-1 font-heading text-2xl font-semibold">{notice.title}</h2>
            <p className="mt-2 whitespace-pre-wrap text-base text-muted-foreground">{notice.body}</p>
          </article>
        ))}
        {data?.length === 0 && (
          <div className="gz-panel px-5 py-10 text-center">
            <p className="font-heading text-xl font-semibold">No notices right now</p>
            <p className="mt-2 text-sm text-muted-foreground">Check the floor for who is playing and what is free.</p>
            <Link href="/" className="mt-4 inline-block text-sm font-medium text-cyan-800 underline-offset-2 hover:underline dark:text-cyan-300">Back to the floor</Link>
          </div>
        )}
      </section>
      </PublicShell>
    </div>
  );
}

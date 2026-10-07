import Link from "next/link";
import { SiteHeader } from "@/components/public/site-header";
import type { PublicTournament } from "@/services/tournament-service";

function formatLabel(item: PublicTournament) {
  if (item.format === "team") return `Teams of ${item.teamSize}`;
  return "Solo";
}

function Card({ item }: { item: PublicTournament }) {
  return (
    <Link href={`/tournaments/${item.slug}`} className="flex h-full flex-col overflow-hidden rounded-2xl border border-border bg-card">
      {item.hasPoster ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={`/api/public/tournaments/${item.slug}/poster`} alt="" className="aspect-[16/8] w-full object-cover" />
      ) : null}
      <span className="flex flex-1 flex-col p-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">{item.game} · {formatLabel(item)}</span>
        <span className="mt-2 font-heading text-2xl font-bold">{item.title}</span>
        <span className="mt-2 text-sm text-muted-foreground">{item.whenLabel}</span>
        <span className="mt-4 grid grid-cols-2 gap-2 text-sm">
          <span className="rounded-xl bg-muted px-3 py-2"><span className="block text-muted-foreground">Entry fee</span><span className="font-semibold">{item.entryFeeLabel}</span></span>
          <span className="rounded-xl bg-muted px-3 py-2"><span className="block text-muted-foreground">Late entry</span><span className="font-semibold">{item.lateEntryFeeLabel}</span></span>
        </span>
        <span className="mt-3 text-sm font-medium">{item.entryWindowLabel}{item.spotsLabel ? ` · ${item.spotsLabel}` : ""}</span>
        {item.summary ? <span className="mt-3 text-muted-foreground">{item.summary}</span> : null}
      </span>
    </Link>
  );
}

function Section({ title, items, empty }: { title: string; items: PublicTournament[]; empty: string }) {
  return (
    <section className="mt-10">
      <h2 className="font-heading text-2xl font-bold">{title}</h2>
      {items.length > 0 ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {items.map((item) => <Card key={item.id} item={item} />)}
        </div>
      ) : (
        <p className="mt-4 rounded-2xl border border-dashed border-border px-6 py-8 text-muted-foreground">{empty}</p>
      )}
    </section>
  );
}

export function TournamentsListView({
  ongoing,
  upcoming,
  finished,
  heading,
  intro,
}: {
  ongoing: PublicTournament[];
  upcoming: PublicTournament[];
  finished: PublicTournament[];
  heading: string;
  intro: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-10 sm:py-16">
        <p className="gz-kicker text-cyan-800 dark:text-cyan-300">Tournaments</p>
        <h1 className="gz-title">{heading}</h1>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">{intro}</p>
        <Section title="Ongoing" items={ongoing} empty="No tournament is running right now." />
        <Section title="Upcoming" items={upcoming} empty="No upcoming tournaments yet." />
        {finished.length > 0 ? <Section title="Finished" items={finished} empty="" /> : null}
      </main>
    </div>
  );
}

export function TournamentDetailView({ item, whatsapp }: { item: PublicTournament | null; whatsapp: string }) {
  const digits = whatsapp.replace(/\D/g, "");
  const chat = item && digits ? `https://wa.me/${digits}?text=${encodeURIComponent(`I want to enter ${item.title}`)}` : "";
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 sm:py-16">
        <Link href="/tournaments" className="text-sm font-medium text-cyan-800 underline-offset-2 hover:underline dark:text-cyan-300">All tournaments</Link>
        {item ? (
          <article className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-cyan-800 dark:text-cyan-300">{item.phase} · {item.game} · {formatLabel(item)}</p>
            <h1 className="mt-3 font-heading text-4xl font-bold sm:text-5xl">{item.title}</h1>
            <p className="mt-3 text-muted-foreground">{item.whenLabel}</p>
            {item.summary ? <p className="mt-4 text-lg text-muted-foreground">{item.summary}</p> : null}
            {item.hasPoster ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/public/tournaments/${item.slug}/poster`} alt="" className="mt-6 aspect-[16/8] w-full rounded-2xl object-cover" />
            ) : null}
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Entry fee</p>
                <p className="font-heading text-3xl font-bold">{item.entryFeeLabel}</p>
                {item.entryClosesLabel ? <p className="mt-1 text-sm text-muted-foreground">Closes {item.entryClosesLabel}</p> : null}
              </div>
              <div className="rounded-2xl border border-border bg-card p-4">
                <p className="text-sm text-muted-foreground">Late entry fee</p>
                <p className="font-heading text-3xl font-bold">{item.lateEntryFeeLabel}</p>
                {item.lateClosesLabel ? <p className="mt-1 text-sm text-muted-foreground">Closes {item.lateClosesLabel}</p> : null}
              </div>
            </div>
            <p className="mt-4 text-sm font-medium">{item.entryWindowLabel}{item.spotsLabel ? ` · ${item.spotsLabel}` : ""}</p>
            <dl className="mt-6 space-y-2 text-sm">
              {item.checkInLabel ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Check-in</dt><dd>{item.checkInLabel}</dd></div> : null}
              {item.entryOpensLabel ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Entry opens</dt><dd>{item.entryOpensLabel}</dd></div> : null}
              {item.prizePoolLabel ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Prize pool</dt><dd>{item.prizePoolLabel}</dd></div> : null}
              {item.prizeFirst ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">1st</dt><dd>{item.prizeFirst}</dd></div> : null}
              {item.prizeSecond ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">2nd</dt><dd>{item.prizeSecond}</dd></div> : null}
              {item.prizeThird ? <div className="flex justify-between gap-4"><dt className="text-muted-foreground">3rd</dt><dd>{item.prizeThird}</dd></div> : null}
            </dl>
            {item.rules ? <div className="mt-8 whitespace-pre-wrap text-base leading-relaxed">{item.rules}</div> : null}
            {item.joinNote ? <p className="mt-6 text-base">{item.joinNote}</p> : null}
            {chat ? (
              <a href={chat} target="_blank" rel="noreferrer" className="mt-6 inline-flex h-10 items-center rounded-lg bg-primary px-3.5 text-sm font-medium text-primary-foreground">Enter on WhatsApp</a>
            ) : null}
          </article>
        ) : (
          <div className="mt-8">
            <h1 className="gz-title">Tournament not found</h1>
            <p className="mt-2 text-muted-foreground">That tournament is hidden or no longer listed.</p>
          </div>
        )}
      </main>
    </div>
  );
}

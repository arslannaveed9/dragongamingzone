"use client";

import { formatHm } from "@/components/admin/client";

export type TimelineBlock = {
  id: string;
  status: string;
  start: number;
  end: number;
  label?: string;
};

function tickStyle(ratio: number): React.CSSProperties {
  const transform = ratio <= 0.02 ? "none" : ratio >= 0.98 ? "translateX(-100%)" : "translateX(-50%)";
  return { left: `${ratio * 100}%`, transform };
}

export function blockTone(status: string) {
  if (status === "scheduled") return "bg-amber-300 text-amber-950";
  if (status === "paused") return "bg-violet-300 text-violet-950";
  if (status === "completed" || status === "cancelled" || status === "no_show") return "bg-zinc-500/80 text-white";
  if (status === "maintenance" || status === "disabled") return "bg-rose-400/80 text-rose-950";
  return "bg-cyan-300 text-cyan-950";
}

export function DayTimeline({
  ticks,
  timeFormat,
  rows,
  nowRatio,
  nowLabel,
  onEmptyClick,
  onBlockClick,
}: {
  ticks: { label: string; ratio: number }[];
  timeFormat: "12h" | "24h";
  rows: { id: string; name: string; blocks: TimelineBlock[] }[];
  nowRatio?: number | null;
  nowLabel?: string;
  onEmptyClick?: (rowId: string, event: React.MouseEvent<HTMLDivElement>) => void;
  onBlockClick?: (blockId: string) => void;
}) {
  const showNow = nowRatio != null && nowRatio >= 0 && nowRatio <= 1;
  const segments = Math.max(1, ticks.length - 1);
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <div className="min-w-[1480px]">
        <div className="grid grid-cols-[7.5rem_1fr] border-b border-border text-[11px] text-muted-foreground">
          <div className="px-3 py-2">Station</div>
          <div className="relative h-10">
            {ticks.map((tick) => (
              <span key={`${tick.label}-${tick.ratio}`} className="absolute top-4 whitespace-nowrap" style={tickStyle(tick.ratio)}>
                {formatHm(tick.label, timeFormat)}
              </span>
            ))}
            {showNow && (
              <span className="absolute top-0 z-30 -translate-x-1/2 rounded bg-rose-500 px-1.5 py-0.5 text-[10px] font-bold whitespace-nowrap text-white" style={{ left: `${nowRatio * 100}%` }}>
                {nowLabel || "Now"}
              </span>
            )}
          </div>
        </div>
        {rows.map((row) => (
          <div key={row.id} className="grid grid-cols-[7.5rem_1fr] border-b border-border last:border-b-0">
            <div className="flex items-center px-3 text-sm font-medium">{row.name}</div>
            <div
              className={`relative h-12 ${onEmptyClick ? "cursor-pointer" : ""}`}
              style={{ backgroundImage: "linear-gradient(to right, var(--border) 1px, transparent 1px)", backgroundSize: `${100 / segments}% 100%` }}
              onClick={onEmptyClick ? (event) => onEmptyClick(row.id, event) : undefined}
            >
              {showNow && <div className="pointer-events-none absolute inset-y-0 z-10 w-0.5 -translate-x-1/2 bg-rose-500" style={{ left: `${nowRatio * 100}%` }} />}
              {row.blocks.map((block) => {
                const className = `absolute top-2 z-20 flex h-8 items-center overflow-hidden rounded-md px-2 text-left text-xs font-medium ${blockTone(block.status)}`;
                const style = { left: `${block.start * 100}%`, width: `${Math.max(1.4, (block.end - block.start) * 100)}%` };
                if (!onBlockClick) return <div key={block.id} className={className} style={style}>{block.label}</div>;
                return (
                  <button
                    key={block.id}
                    type="button"
                    className={`${className} cursor-pointer`}
                    style={style}
                    onClick={(event) => { event.stopPropagation(); onBlockClick(block.id); }}
                  >
                    {block.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex flex-wrap gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
        <Legend swatch="bg-cyan-300" label="Playing" />
        <Legend swatch="bg-amber-300" label="Reserved" />
        {showNow && <Legend swatch="bg-rose-500" label="Now" />}
      </div>
    </div>
  );
}

function Legend({ swatch, label }: { swatch: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`size-2 rounded-sm ${swatch}`} />
      {label}
    </span>
  );
}

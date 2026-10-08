"use client";

import { describeChanges } from "@/lib/audit-changes";

function show(value: string | null) {
  if (!value) return "—";
  if (/^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  return value;
}

export function AuditDetail({ oldValue, newValue }: { oldValue: unknown; newValue: unknown }) {
  const lines = describeChanges(oldValue, newValue);
  if (!lines.length) return <p className="text-sm text-muted-foreground">This entry records the action only.</p>;
  return (
    <dl className="grid gap-1 text-sm">
      {lines.map((line) => (
        <div key={line.label} className="grid gap-1 sm:grid-cols-[9rem_1fr] sm:gap-3">
          <dt className="text-muted-foreground">{line.label}</dt>
          <dd>
            {line.before != null && line.after != null ? (
              <>
                <span>{show(line.before)}</span>
                <span className="px-1 text-muted-foreground">→</span>
                <span className="font-medium">{show(line.after)}</span>
              </>
            ) : (
              <span className="font-medium">{show(line.after ?? line.before)}</span>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}

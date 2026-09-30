"use client";

import { STATUS_LABEL, statusClass } from "@/components/admin/client";

export function StatusPill({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold ${statusClass(status)}`}>
      <span className="size-2 rounded-full bg-current" />
      {STATUS_LABEL[status] || status}
    </span>
  );
}

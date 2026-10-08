"use client";

import { Fragment, useState } from "react";
import { AuditDetail } from "@/components/admin/audit-detail";
import { usePoll } from "@/components/admin/client";
import { actionLabel } from "@/lib/audit-changes";

type Row = {
  id: string;
  userName: string;
  action: string;
  entity: string;
  entityId: string;
  oldValue: unknown;
  newValue: unknown;
  createdAt: string;
};

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState<string | null>(null);
  const { data } = usePoll<{ items: Row[]; total: number; pageSize: number }>(`/api/audit?page=${page}&pageSize=40`);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>{["When", "Who", "Action", "Record", ""].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-muted-foreground">No activity yet.</td></tr>}
            {data?.items.map((row) => {
              const open = openId === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                    <td className="px-3 py-2">{row.userName}</td>
                    <td className="px-3 py-2">{actionLabel(row.action)}</td>
                    <td className="px-3 py-2">{row.entity} {row.entityId.slice(-6)}</td>
                    <td className="px-3 py-2 text-right">
                      <button type="button" className="text-sm font-medium text-primary" onClick={() => setOpenId(open ? null : row.id)}>
                        {open ? "Hide" : "Details"}
                      </button>
                    </td>
                  </tr>
                  {open ? (
                    <tr key={`${row.id}-detail`} className="border-t border-border bg-muted/30">
                      <td colSpan={5} className="px-3 py-3">
                        <p className="mb-2 text-xs text-muted-foreground">{row.action}</p>
                        <AuditDetail oldValue={row.oldValue} newValue={row.newValue} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex gap-2">
        <button className="text-sm underline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</button>
        <button className="text-sm underline" disabled={!data || page * data.pageSize >= data.total} onClick={() => setPage((value) => value + 1)}>Next</button>
      </div>
    </div>
  );
}

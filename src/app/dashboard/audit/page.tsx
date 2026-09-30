"use client";

import { useState } from "react";
import { usePoll } from "@/components/admin/client";

type Row = { id: string; userName: string; action: string; entity: string; entityId: string; createdAt: string };

export default function AuditPage() {
  const [page, setPage] = useState(1);
  const { data } = usePoll<{ items: Row[]; total: number; pageSize: number }>(`/api/audit?page=${page}&pageSize=40`);
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Audit log</h1>
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>{["When", "Who", "Action", "Record"].map((heading) => <th key={heading} className="px-3 py-2">{heading}</th>)}</tr>
          </thead>
          <tbody>
            {data?.items.length === 0 && <tr><td colSpan={4} className="px-3 py-6 text-muted-foreground">No activity yet.</td></tr>}
            {data?.items.map((row) => (
              <tr key={row.id} className="border-t border-border">
                <td className="px-3 py-2 whitespace-nowrap">{new Date(row.createdAt).toLocaleString()}</td>
                <td className="px-3 py-2">{row.userName}</td>
                <td className="px-3 py-2">{row.action}</td>
                <td className="px-3 py-2">{row.entity} {row.entityId.slice(-6)}</td>
              </tr>
            ))}
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

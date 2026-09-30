"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, usePoll } from "@/components/admin/client";
import {
  assignableRoles,
  NAV_PAGES,
  pagesForRole,
  ROLE_LABEL,
  ROLE_PLAN,
  type Role,
} from "@/lib/permissions";

type UserRow = { id: string; name: string; email: string; role: Role; active: boolean };

export default function UsersPage() {
  const { data, reload } = usePoll<UserRow[]>("/api/users");
  const me = usePoll<{ user: { role: Role } }>("/api/auth/me");
  const actorRole = me.data?.user.role || "admin";
  const roles = assignableRoles(actorRole);
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" as Role });
  const selected = roles.includes(form.role) ? form.role : roles[0] || "staff";
  const visible = pagesForRole(selected);
  const hidden = NAV_PAGES.filter((page) => page.sidebar !== false && !visible.some((item) => item.href === page.href));

  async function create() {
    try {
      await api("/api/users", { method: "POST", body: JSON.stringify({ ...form, role: selected, active: true }) });
      setForm({ name: "", email: "", password: "", role: "staff" });
      toast.success("Account created.");
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create the account.");
    }
  }

  async function toggle(user: UserRow) {
    try {
      await api(`/api/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: user.name, email: user.email, role: user.role, active: !user.active }),
      });
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the account.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">New accounts start as staff unless you choose another role. The list below is exactly what that person will see in the sidebar.</p>
      </div>
      <div className="grid gap-2 rounded-xl border border-border bg-card p-4 md:grid-cols-5">
        <Input placeholder="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <Input placeholder="Email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} />
        <Input placeholder="Password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} />
        <select className="h-9 rounded-lg border border-input bg-card px-2 text-sm" value={selected} onChange={(event) => setForm({ ...form, role: event.target.value as Role })}>
          {roles.map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
        </select>
        <Button onClick={create}>Add user</Button>
      </div>
      <section className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium">{ROLE_LABEL[selected]} pages</h2>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{ROLE_PLAN[selected]}</p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Shown</p>
            <ul className="mt-2 space-y-2 text-sm">
              {visible.map((page) => (
                <li key={page.href}>
                  <span className="font-medium">{page.label}</span>
                  <span className="text-muted-foreground"> — {page.note}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Hidden</p>
            {hidden.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Nothing is hidden.</p> : (
              <ul className="mt-2 space-y-2 text-sm text-muted-foreground">
                {hidden.map((page) => <li key={page.href}>{page.label}</li>)}
              </ul>
            )}
          </div>
        </div>
      </section>
      {(data || []).map((user) => (
        <div key={user.id} className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-sm">
          <div>
            <p className="font-medium">{user.name} <span className="text-muted-foreground">{user.email}</span></p>
            <p className="text-muted-foreground">{ROLE_LABEL[user.role] || user.role} · {user.active ? "active" : "inactive"} · {pagesForRole(user.role).length} pages</p>
          </div>
          <Button size="sm" variant="outline" onClick={() => toggle(user)}>{user.active ? "Deactivate" : "Activate"}</Button>
        </div>
      ))}
    </div>
  );
}

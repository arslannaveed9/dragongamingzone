"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { api, usePoll } from "@/components/admin/client";
import {
  assignableRoles,
  canManageRole,
  NAV_PAGES,
  pagesForRole,
  ROLE_LABEL,
  ROLE_PLAN,
  type Role,
} from "@/lib/permissions";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt: string | null;
  sessionCount: number;
};

type SessionRow = {
  id: string;
  createdAt: string | null;
  expiresAt: string;
  device: string;
  ip: string;
  current: boolean;
};

function when(value: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

export default function UsersPage() {
  const { data, reload } = usePoll<UserRow[]>("/api/users");
  const me = usePoll<{ user: { id: string; role: Role } }>("/api/auth/me");
  const actorRole = me.data?.user.role;
  const roles = actorRole ? assignableRoles(actorRole) : [];
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "staff" as Role });
  const [openId, setOpenId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", email: "", role: "staff" as Role, password: "" });
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [busy, setBusy] = useState(false);
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
      if (openId === user.id) await loadSessions(user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update the account.");
    }
  }

  async function loadSessions(userId: string) {
    const rows = await api<SessionRow[]>(`/api/users/${userId}/sessions`);
    setSessions(rows);
  }

  async function openUser(user: UserRow) {
    if (openId === user.id) {
      setOpenId(null);
      return;
    }
    setOpenId(user.id);
    setEdit({ name: user.name, email: user.email, role: user.role, password: "" });
    setSessions([]);
    try {
      await loadSessions(user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load logins.");
    }
  }

  async function saveUser(user: UserRow) {
    setBusy(true);
    try {
      const body: { name: string; email: string; role: Role; active: boolean; password?: string } = {
        name: edit.name,
        email: edit.email,
        role: roles.includes(edit.role) ? edit.role : user.role,
        active: user.active,
      };
      if (edit.password) body.password = edit.password;
      await api(`/api/users/${user.id}`, { method: "PATCH", body: JSON.stringify(body) });
      if (edit.password && me.data?.user.id === user.id) {
        window.location.assign("/login");
        return;
      }
      toast.success(edit.password ? "Account saved. Open logins were ended." : "Account saved.");
      setEdit({ ...edit, password: "" });
      await reload();
      await loadSessions(user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the account.");
    } finally {
      setBusy(false);
    }
  }

  async function endSession(user: UserRow, session: SessionRow) {
    try {
      const result = await api<{ self: boolean }>(`/api/users/${user.id}/sessions/${session.id}`, { method: "DELETE" });
      if (result.self) {
        window.location.assign("/login");
        return;
      }
      toast.success("Login ended.");
      await reload();
      await loadSessions(user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not end that login.");
    }
  }

  async function endAll(user: UserRow) {
    try {
      const result = await api<{ self: boolean; revoked: number }>(`/api/users/${user.id}/sessions`, {
        method: "POST",
        body: JSON.stringify({ action: "revoke-all" }),
      });
      if (result.self) {
        window.location.assign("/login");
        return;
      }
      toast.success(result.revoked ? "All logins ended." : "No open logins.");
      await reload();
      await loadSessions(user.id);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not end the logins.");
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Users</h1>
        <p className="text-sm text-muted-foreground">New accounts start as staff unless you choose another role. Open an account to change its name, email, role, or password, and to end its logins.</p>
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
      {(data || []).map((user) => {
        const manageable = actorRole ? canManageRole(actorRole, user.role) : false;
        const open = openId === user.id;
        return (
          <div key={user.id} className="rounded-xl border border-border bg-card px-4 py-3 text-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="font-medium">{user.name} <span className="text-muted-foreground">{user.email}</span></p>
                <p className="text-muted-foreground">
                  {ROLE_LABEL[user.role] || user.role} · {user.active ? "active" : "inactive"} · {user.sessionCount} signed in · last login {when(user.lastLoginAt)}
                </p>
              </div>
              {manageable ? (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => openUser(user)}>{open ? "Close" : "Edit"}</Button>
                  <Button size="sm" variant="outline" onClick={() => toggle(user)}>{user.active ? "Deactivate" : "Activate"}</Button>
                </div>
              ) : null}
            </div>
            {open && manageable ? (
              <div className="mt-4 space-y-4 border-t border-border pt-4">
                <div className="grid gap-2 md:grid-cols-2">
                  <Input placeholder="Name" value={edit.name} onChange={(event) => setEdit({ ...edit, name: event.target.value })} />
                  <Input placeholder="Email" value={edit.email} onChange={(event) => setEdit({ ...edit, email: event.target.value })} />
                  <select className="h-9 rounded-lg border border-input bg-card px-2 text-sm" value={roles.includes(edit.role) ? edit.role : user.role} onChange={(event) => setEdit({ ...edit, role: event.target.value as Role })}>
                    {(roles.includes(user.role) ? roles : [user.role, ...roles]).map((role) => <option key={role} value={role}>{ROLE_LABEL[role]}</option>)}
                  </select>
                  <Input placeholder="New password" type="password" autoComplete="new-password" value={edit.password} onChange={(event) => setEdit({ ...edit, password: event.target.value })} />
                </div>
                <p className="text-muted-foreground">Leave the password blank to keep the current one. Saving a new password ends every open login for this account.</p>
                <Button onClick={() => saveUser(user)} disabled={busy}>Save account</Button>
                <div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <h2 className="font-medium">Login sessions</h2>
                    <Button size="sm" variant="outline" onClick={() => endAll(user)} disabled={sessions.length === 0}>End all logins</Button>
                  </div>
                  {sessions.length === 0 ? <p className="mt-2 text-muted-foreground">No open logins.</p> : (
                    <ul className="mt-3 space-y-2">
                      {sessions.map((session) => (
                        <li key={session.id} className="flex flex-col gap-2 rounded-lg border border-border px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="font-medium">{session.device}{session.current ? " · this browser" : ""}</p>
                            <p className="text-muted-foreground">Signed in {when(session.createdAt)}{session.ip && session.ip !== "::1" && !session.ip.endsWith("127.0.0.1") ? ` · ${session.ip}` : ""} · ends {when(session.expiresAt)}</p>
                          </div>
                          <Button size="sm" variant="outline" onClick={() => endSession(user, session)}>End login</Button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

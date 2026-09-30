"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, notifyRefresh, usePoll } from "@/components/admin/client";

type Notice = {
  id: string;
  audience: "staff" | "public";
  title: string;
  body: string;
  active: boolean;
  authorName: string;
  postedAt: string;
};

export default function NoticesPage() {
  const { data, reload } = usePoll<Notice[]>("/api/notices?all=1");
  const [audience, setAudience] = useState<"staff" | "public">("staff");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  async function post() {
    if (!title.trim() || !body.trim()) {
      toast.error("Add a title and a message.");
      return;
    }
    setSaving(true);
    try {
      await api("/api/notices", {
        method: "POST",
        body: JSON.stringify({ audience, title: title.trim(), body: body.trim() }),
      });
      setTitle("");
      setBody("");
      toast.success(audience === "staff" ? "Staff will see this at the top of the panel." : "Posted on the public notices page.");
      notifyRefresh();
      await reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not post the notice.");
    } finally {
      setSaving(false);
    }
  }

  async function setActive(notice: Notice, active: boolean) {
    await api(`/api/notices/${notice.id}`, { method: "PATCH", body: JSON.stringify({ active }) });
    notifyRefresh();
    await reload();
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="gz-kicker text-cyan-800 dark:text-cyan-200">Messages</p>
        <h1 className="gz-title">Notices</h1>
        <p className="mt-2 max-w-3xl text-base text-muted-foreground">
          A staff notice shows at the top of this panel for everyone signed in. A public notice shows on the website notices page. Older notices stay here after you hide them.
        </p>
      </div>

      <section className="gz-panel space-y-4 p-4">
        <h2 className="font-heading text-lg font-semibold">New notice</h2>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant={audience === "staff" ? "default" : "outline"} onClick={() => setAudience("staff")}>For staff</Button>
          <Button type="button" variant={audience === "public" ? "default" : "outline"} onClick={() => setAudience("public")}>For the public site</Button>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notice-title">Title</Label>
          <Input id="notice-title" value={title} placeholder={audience === "staff" ? "Floor closes at 2 AM" : "Tournament this Friday"} onChange={(event) => setTitle(event.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notice-body">Message</Label>
          <Textarea id="notice-body" value={body} placeholder="Write the notice in plain words." onChange={(event) => setBody(event.target.value)} />
        </div>
        <Button type="button" disabled={saving} onClick={() => void post()}>{saving ? "Posting..." : "Post notice"}</Button>
      </section>

      <section className="space-y-2">
        <h2 className="font-heading text-lg font-semibold">Previous notices</h2>
        {(data || []).map((notice) => (
          <article key={notice.id} className="gz-panel flex flex-wrap items-start justify-between gap-3 px-4 py-3">
            <div className="max-w-3xl text-sm">
              <p className="font-medium">
                {notice.title}
                <span className="ml-2 font-normal text-muted-foreground">{notice.audience === "staff" ? "Staff" : "Public"}{notice.active ? "" : " · hidden"}</span>
              </p>
              <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{notice.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">{notice.postedAt}{notice.authorName ? ` · ${notice.authorName}` : ""}</p>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={() => void setActive(notice, !notice.active)}>
              {notice.active ? "Hide" : "Show again"}
            </Button>
          </article>
        ))}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">No notices yet.</p>}
      </section>
    </div>
  );
}

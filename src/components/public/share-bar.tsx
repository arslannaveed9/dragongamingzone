"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ShareBar({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  }

  function share() {
    const link = `https://wa.me/?text=${encodeURIComponent(`${title} ${window.location.href}`)}`;
    window.open(link, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="mt-8 flex flex-wrap gap-2">
      <Button type="button" variant="outline" onClick={() => void copy()}>{copied ? "Link copied" : "Copy link"}</Button>
      <Button type="button" variant="outline" onClick={share}>Share on WhatsApp</Button>
    </div>
  );
}

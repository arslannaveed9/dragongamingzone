"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/components/admin/client";

export function LoginForm({ businessName }: { businessName: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      await api("/api/auth/login", { method: "POST", body: JSON.stringify({ email, password }) });
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not sign in.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center px-4">
      <form onSubmit={submit} className="gz-panel w-full max-w-md space-y-4 p-7">
        <div>
          <h1 className="font-heading text-3xl font-bold leading-tight">{businessName}</h1>
          <p className="mt-1 text-base text-muted-foreground">Staff sign in</p>
        </div>
        <div>
          <Label>Email</Label>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </div>
        <div>
          <Label>Password</Label>
          <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pending}>{pending ? "Signing in..." : "Sign in"}</Button>
        <Link href="/" className="block text-center text-sm text-muted-foreground">Back to the floor board</Link>
      </form>
    </main>
  );
}

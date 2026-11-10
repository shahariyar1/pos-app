"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, errorMessage } from "@/lib/fetcher";
import { SHOP_NAME } from "@/lib/shop";

/** The owner's door. Customers never see the counter, dashboard or other customers. */
export function OwnerLogin() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await api("/api/auth/owner-login", { method: "POST", body: JSON.stringify({ password }) });
      router.push("/pos");
      router.refresh();
    } catch (err) {
      toast.error(errorMessage(err));
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-sm">
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-1 text-center">
              <span className="mx-auto grid size-12 place-items-center rounded-full bg-accent text-primary">
                <Lock className="size-5" aria-hidden />
              </span>
              <h1 className="text-xl font-semibold">{SHOP_NAME}</h1>
              <p className="text-sm text-muted-foreground">Owner login</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="owner-password">Password</Label>
              <Input id="owner-password" type="password" autoFocus autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy || !password}>
              {busy ? "Checking…" : "Log in"}
            </Button>
            <p className="text-center text-sm">
              <a href="/login" className="text-muted-foreground underline">
                I am a customer
              </a>
            </p>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

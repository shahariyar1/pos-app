"use client";

import { useState } from "react";
import useSWR from "swr";
import { Phone } from "lucide-react";
import { toast } from "sonner";
import { EntitySearch } from "@/components/entity-search";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { api, errorMessage, fetcher, qs, revalidate } from "@/lib/fetcher";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import type { Customer, CustomersResponse, OwnerAccount } from "@/types";

const STATUS = {
  pending: { label: "Waiting", cls: "bg-warn-soft text-warn" },
  active: { label: "Active", cls: "bg-success-soft text-success" },
  blocked: { label: "Blocked", cls: "bg-destructive/10 text-destructive" },
} as const;

type Mode = "match" | "new" | "other";

/** Approve a sign-up: link to a customer you already have (keeps their due and history) or create a new one. */
function ApproveDialog({ account, onClose }: { account: OwnerAccount | null; onClose: () => void }) {
  const [mode, setMode] = useState<Mode>(account?.match ? "match" : "new");
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Customer | null>(null);
  const [busy, setBusy] = useState(false);
  const dq = useDebounce(text.trim(), 200);
  const { data } = useSWR<CustomersResponse>(account && mode === "other" ? `/api/customers${qs({ q: dq, limit: 6 })}` : null, fetcher);

  if (!account) return null;
  const current = account;

  async function approve() {
    const customerId = mode === "match" ? current.match?._id : mode === "other" ? picked?._id : undefined;
    if (mode === "other" && !customerId) {
      toast.error("Pick the customer to link");
      return;
    }
    setBusy(true);
    try {
      await api(`/api/accounts/${current._id}/approve`, { method: "POST", body: JSON.stringify({ customerId }) });
      toast.success(`${current.shopName} approved`);
      revalidate("/api/");
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  const option = (value: Mode, title: string, hint: string) => (
    <button
      type="button"
      role="radio"
      aria-checked={mode === value}
      onClick={() => setMode(value)}
      className={cn("w-full rounded-lg border p-3 text-left", mode === value ? "border-primary bg-accent/50" : "hover:bg-muted/50")}
    >
      <span className="font-medium">{title}</span>
      <span className="block text-sm text-muted-foreground">{hint}</span>
    </button>
  );

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Approve {current.shopName}</DialogTitle>
          <DialogDescription>
            {current.address} · {current.phone || "no phone yet"}
          </DialogDescription>
        </DialogHeader>

        <div role="radiogroup" aria-label="Which customer is this?" className="space-y-2">
          {current.match &&
            option("match", `Link to ${current.match.name}`, current.match.dueBalance ? `Already your customer, owes ${formatMoney(current.match.dueBalance)}. They will see their real due.` : "Already your customer. They will see their history.")}
          {option("new", "Create a new customer", "A fresh customer record with no due.")}
          {option("other", "Link to a different customer", "Search for the customer record this shop belongs to.")}
        </div>

        {mode === "other" && (
          <div className="space-y-1.5">
            <Label htmlFor="ap-search">Customer</Label>
            <EntitySearch<Customer>
              id="ap-search"
              autoFocus
              placeholder="Search by name"
              value={text}
              onValueChange={(v) => {
                setText(v);
                setPicked(null);
              }}
              results={data?.data ?? []}
              getKey={(c) => c._id}
              onPick={(c) => {
                setPicked(c);
                setText(c.name);
              }}
              renderItem={(c) => (
                <div className="flex justify-between gap-2">
                  <span className="font-medium">{c.name}</span>
                  {c.dueBalance > 0 && <span className="text-xs text-warn">Owes {formatMoney(c.dueBalance)}</span>}
                </div>
              )}
            />
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={approve} disabled={busy}>
            {busy ? "Approving…" : "Approve"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const randomPin = () => String(Math.floor(100000 + Math.random() * 900000));

function ResetDialog({ account, onClose }: { account: OwnerAccount | null; onClose: () => void }) {
  const [password, setPassword] = useState(randomPin);
  const [busy, setBusy] = useState(false);
  if (!account) return null;
  const current = account;

  async function save() {
    setBusy(true);
    try {
      await api(`/api/accounts/${current._id}/reset-password`, { method: "POST", body: JSON.stringify({ password }) });
      toast.success(`New password set for ${current.shopName}`, { description: `Tell them: ${password}`, duration: 20_000 });
      onClose();
    } catch (e) {
      toast.error(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New password for {current.shopName}</DialogTitle>
          <DialogDescription>Tell the customer this password. They can log in with their shop name or phone.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="rp-pw">Password</Label>
          <div className="flex gap-2">
            <Input id="rp-pw" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Button variant="outline" onClick={() => setPassword(randomPin())}>
              New
            </Button>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={save} disabled={busy || password.length < 6}>
            {busy ? "Saving…" : "Set password"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const FILTERS = [
  { value: "pending", label: "Waiting" },
  { value: "active", label: "Active" },
  { value: "blocked", label: "Blocked" },
  { value: "all", label: "All" },
] as const;

/** Customer logins: approve new sign-ups, block, reset passwords. */
export function AccountsPanel() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["value"]>("pending");
  const [approving, setApproving] = useState<OwnerAccount | null>(null);
  const [resetting, setResetting] = useState<OwnerAccount | null>(null);
  const [removing, setRemoving] = useState<OwnerAccount | null>(null);
  const { data, isLoading } = useSWR<{ data: OwnerAccount[] }>(`/api/accounts${qs({ status: filter === "all" ? undefined : filter })}`, fetcher);

  async function setStatus(a: OwnerAccount, status: "active" | "blocked") {
    try {
      await api(`/api/accounts/${a._id}/status`, { method: "POST", body: JSON.stringify({ status }) });
      toast.success(status === "blocked" ? `${a.shopName} blocked` : `${a.shopName} can log in again`);
      revalidate("/api/");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  async function confirmRemove() {
    if (!removing) return;
    try {
      await api(`/api/accounts/${removing._id}`, { method: "DELETE" });
      toast.success("Login removed");
      revalidate("/api/");
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRemoving(null);
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Filter sign-ups">
        {FILTERS.map((f) => (
          <Button key={f.value} size="sm" variant={filter === f.value ? "default" : "outline"} onClick={() => setFilter(f.value)}>
            {f.label}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <Skeleton className="h-28 rounded-xl" />
      ) : data?.data.length ? (
        <ul className="space-y-3">
          {data.data.map((a) => (
            <li key={a._id} className="space-y-2 rounded-xl border bg-card p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold">{a.shopName}</p>
                  <p className="text-sm text-muted-foreground">{a.address}</p>
                </div>
                <Badge className={cn("border-transparent font-medium", STATUS[a.status].cls)}>{STATUS[a.status].label}</Badge>
              </div>
              <p className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                {a.phone ? (
                  <a href={`tel:${a.phone}`} className="flex items-center gap-1 font-medium text-primary underline">
                    <Phone className="size-3.5" aria-hidden /> {a.phone}
                  </a>
                ) : (
                  <span className="text-muted-foreground">No phone yet</span>
                )}
                <span className="text-xs text-muted-foreground">Signed up {formatDateTime(a.createdAt)}</span>
                {a.lastLoginAt && <span className="text-xs text-muted-foreground">Last login {formatDateTime(a.lastLoginAt)}</span>}
              </p>
              {a.status === "pending" && a.match && (
                <p className="rounded-md bg-accent px-3 py-2 text-sm text-accent-foreground">
                  You already have a customer called <strong>{a.match.name}</strong>
                  {a.match.dueBalance ? ` who owes ${formatMoney(a.match.dueBalance)}` : ""}. Make sure this is really them before linking.
                </p>
              )}
              {a.customerName && (
                <p className="text-sm text-muted-foreground">
                  Customer: {a.customerName}
                  {a.due ? ` · ${a.due > 0 ? "owes" : "credit"} ${formatMoney(Math.abs(a.due))}` : ""}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                {a.status === "pending" && <Button size="sm" onClick={() => setApproving(a)}>Approve</Button>}
                {a.status === "active" && (
                  <>
                    <Button size="sm" variant="outline" onClick={() => setResetting(a)}>Reset password</Button>
                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setStatus(a, "blocked")}>Block</Button>
                  </>
                )}
                {a.status === "blocked" && a.customerName && <Button size="sm" variant="outline" onClick={() => setStatus(a, "active")}>Unblock</Button>}
                {a.status !== "active" && (
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setRemoving(a)}>
                    {a.status === "pending" ? "Reject" : "Remove"}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
          {filter === "pending" ? "No new customers are waiting." : "Nothing here."}
        </p>
      )}

      <ApproveDialog key={`a-${approving?._id ?? "x"}`} account={approving} onClose={() => setApproving(null)} />
      <ResetDialog key={`r-${resetting?._id ?? "x"}`} account={resetting} onClose={() => setResetting(null)} />

      <AlertDialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{removing?.status === "pending" ? "Reject" : "Remove"} {removing?.shopName}?</AlertDialogTitle>
            <AlertDialogDescription>
              Their login is deleted. Any customer record, memos and due you already have are not touched.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={confirmRemove}>{removing?.status === "pending" ? "Reject sign-up" : "Remove login"}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

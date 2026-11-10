"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Search, UserCog } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DsrDialog } from "@/features/dsr/dsr-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useDebounce } from "@/hooks/use-debounce";
import { fetcher, qs } from "@/lib/fetcher";
import { dayRange, formatMoney, todayStr } from "@/lib/utils";
import type { DashboardStats, DsrResponse } from "@/types";
import { ProfitCard } from "./profit-card";
import { SalesTable } from "./sales-table";

function Stat({ label, value, sub }: { label: string; value?: string; sub?: string }) {
  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">{label}</p>
        {value === undefined ? <Skeleton className="h-8 w-32" /> : <p className="text-2xl font-semibold">{value}</p>}
        {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

export function DashboardScreen() {
  // Dates are set after mount so the server (UTC) and the shop's clock can't disagree during hydration.
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [status, setStatus] = useState("all");
  const [q, setQ] = useState("");
  const [dsr, setDsr] = useState<string | null>(null);
  const [dsrOpen, setDsrOpen] = useState(false);
  const debouncedQ = useDebounce(q.trim(), 250);

  useEffect(() => {
    const t = todayStr();
    setFrom(t);
    setTo(t);
  }, []);

  const range = from && to ? dayRange(from, to) : null;
  const { data: stats } = useSWR<DashboardStats>(range ? `/api/dashboard${qs(range)}` : null, fetcher);
  const isToday = from === todayStr() && to === todayStr();

  // What each DSR sold TODAY (independent of the date range chosen above)
  const today = from ? dayRange(todayStr(), todayStr()) : null;
  const { data: dsrToday } = useSWR<DsrResponse>(today ? `/api/dsr${qs(today)}` : null, fetcher);
  const picked = dsr ? dsrToday?.data.find((d) => d.name === dsr) : undefined;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Dashboard</h1>

      <section aria-label="Totals" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Stat label={isToday ? "Sales today" : "Sales"} value={stats && formatMoney(stats.revenue)} sub={stats && `${stats.invoices} memos · ${stats.itemsSold} items`} />
        <Stat label="Money collected" value={stats && formatMoney(stats.collected)} sub="Payments on memos and old dues" />
        <Stat label="Unpaid by customers" value={stats && formatMoney(stats.outstandingDue)} sub={stats && `${stats.customersWithDue} customers`} />
        <Stat label="Returns" value={stats && formatMoney(stats.returnsTotal)} sub={stats && `${stats.returnsCount} returned`} />
        <ProfitCard stats={stats} />
      </section>

      <section aria-label="Sales" className="space-y-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="from">From</Label>
            <Input id="from" type="date" className="bg-card" value={from ?? ""} max={to ?? undefined} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="to">To</Label>
            <Input id="to" type="date" className="bg-card" value={to ?? ""} min={from ?? undefined} onChange={(e) => setTo(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="status">Payment</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger id="status" className="w-44 bg-card">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All memos</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="unpaid">Part paid or due</SelectItem>
                <SelectItem value="partial">Part paid</SelectItem>
                <SelectItem value="due">Fully due</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="relative min-w-52 flex-1 space-y-1.5">
            <Label htmlFor="sale-q">Search</Label>
            <Search className="pointer-events-none absolute left-3 top-[2.1rem] size-4 text-muted-foreground" aria-hidden />
            <Input id="sale-q" className="bg-card pl-9" placeholder="Invoice or customer" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>

        <div className="space-y-2 rounded-xl border bg-card p-3" aria-label="DSR">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">DSR · money received today</p>
            <Button variant="ghost" size="sm" onClick={() => setDsrOpen(true)}>
              <UserCog className="size-4" aria-hidden /> Manage DSR
            </Button>
          </div>
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by DSR">
            <Button size="sm" variant={dsr === null ? "default" : "outline"} onClick={() => setDsr(null)}>
              All
              <span className="text-xs opacity-80">{dsrToday ? formatMoney(dsrToday.all.paid) : ""}</span>
            </Button>
            {dsrToday?.data.map((d) => (
              <Button key={d._id} size="sm" variant={dsr === d.name ? "default" : "outline"} onClick={() => setDsr(d.name)}>
                {d.name}
                <span className="text-xs opacity-80">{formatMoney(d.paid)}</span>
              </Button>
            ))}
            {dsrToday && dsrToday.data.length === 0 && <p className="text-sm text-muted-foreground">No DSR yet. Use Manage DSR to add one.</p>}
          </div>
          {(picked || (dsr === null && dsrToday)) && (() => {
            const t = picked ?? dsrToday!.all;
            return (
              <div className="grid gap-2 rounded-lg bg-accent px-3 py-3 text-accent-foreground sm:grid-cols-3" aria-live="polite">
                <p className="sm:col-span-3">
                  <strong>{picked ? picked.name : "Everyone"}</strong> received <strong className="text-lg">{formatMoney(t.paid)}</strong> today
                </p>
                <p className="text-sm">Sold <strong>{formatMoney(t.sold)}</strong> in {t.memos} memo{t.memos === 1 ? "" : "s"}</p>
                <p className="text-sm">Still due <strong className={t.due > 0 ? "text-warn" : ""}>{formatMoney(t.due)}</strong></p>
                <p className="text-xs opacity-80 sm:text-right">Received counts money taken today, even on older memos.</p>
              </div>
            );
          })()}
        </div>

        {range && <SalesTable filters={{ from: range.from, to: range.to, status, q: debouncedQ, dsr }} />}
        <DsrDialog open={dsrOpen} onOpenChange={setDsrOpen} />
      </section>
    </div>
  );
}

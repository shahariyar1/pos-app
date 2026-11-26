"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DsrDialog } from "@/features/dsr/dsr-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { fetcher, qs } from "@/lib/fetcher";
import { dayRange, formatMoney, todayStr } from "@/lib/utils";
import type { DsrResponse } from "@/types";

function dateBefore(value: string, days: number) {
  const d = new Date(value + "T12:00:00");
  d.setDate(d.getDate() - days);
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}

function Metric({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return <Card><CardContent className="space-y-1 p-3">
    <p className="text-xs text-muted-foreground">{label}</p>
    <p className="text-lg font-semibold">{value}</p>
    {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
  </CardContent></Card>;
}

export function DsrReports({ onSelectDsr }: { onSelectDsr: (name: string) => void }) {
  const [period, setPeriod] = useState("today");
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [manageOpen, setManageOpen] = useState(false);

  useEffect(() => {
    const today = todayStr();
    setFrom(today);
    setTo(today);
  }, []);

  const range = from && to ? dayRange(from, to) : null;
  const { data, mutate } = useSWR<DsrResponse>(range ? "/api/dsr" + qs(range) : null, fetcher);
  const selected = data?.data.find((d) => d.name === selectedName) ?? data?.data[0];

  function setPreset(value: string) {
    const today = todayStr();
    setPeriod(value);
    if (value === "today") { setFrom(today); setTo(today); }
    if (value === "yesterday") { const y = dateBefore(today, 1); setFrom(y); setTo(y); }
    if (value === "month") { setFrom(today.slice(0, 7) + "-01"); setTo(today); }
  }

  return <section aria-label="Individual DSR reports" className="space-y-3 rounded-xl border bg-card p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div><h2 className="font-semibold">DSR reports</h2><p className="text-xs text-muted-foreground">Separate report for each salesperson</p></div>
      <Button variant="ghost" size="sm" onClick={() => setManageOpen(true)}>Manage DSR</Button>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant={period === "today" ? "default" : "outline"} onClick={() => setPreset("today")}>Today</Button>
      <Button size="sm" variant={period === "yesterday" ? "default" : "outline"} onClick={() => setPreset("yesterday")}>Yesterday</Button>
      <Button size="sm" variant={period === "month" ? "default" : "outline"} onClick={() => setPreset("month")}>This month</Button>
      <Button size="sm" variant={period === "custom" ? "default" : "outline"} onClick={() => setPeriod("custom")}>Date-wise</Button>
    </div>
    {period === "custom" && <div className="flex flex-wrap gap-3">
      <div className="space-y-1"><Label htmlFor="dsr-from">From</Label><Input id="dsr-from" type="date" value={from ?? ""} max={to ?? undefined} onChange={(e) => setFrom(e.target.value)} /></div>
      <div className="space-y-1"><Label htmlFor="dsr-to">To</Label><Input id="dsr-to" type="date" value={to ?? ""} min={from ?? undefined} onChange={(e) => setTo(e.target.value)} /></div>
    </div>}
    {data ? data.data.length ? <>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.data.map((person) => <button key={person._id} type="button" onClick={() => { setSelectedName(person.name); onSelectDsr(person.name); }}
          className={"rounded-xl border p-3 text-left transition-colors " + ((selected?.name === person.name) ? "border-primary bg-accent" : "bg-background hover:bg-accent/50")}>
          <p className="font-semibold">{person.name}</p>
          <p className="mt-2 text-xs text-muted-foreground">Money collected</p>
          <p className="text-xl font-semibold">{formatMoney(person.paid)}</p>
          <div className="mt-2 flex flex-wrap justify-between gap-2 text-xs text-muted-foreground">
            <span>Sales {formatMoney(person.sold)}</span><span>Profit {formatMoney(person.netProfit)}</span>
          </div>
        </button>)}
      </div>
      {selected && <Card className="border-primary/40"><CardContent className="space-y-3 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">{selected.name} · Detailed report</h3>
          <span className="text-xs text-muted-foreground">{from} — {to}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Metric label="Money collected" value={formatMoney(selected.paid)} />
          <Metric label="Total sales" value={formatMoney(selected.sold)} sub={selected.memos + " memos"} />
          <Metric label="Still due" value={formatMoney(selected.due)} />
          <Metric label="Sales margin" value={formatMoney(selected.grossProfit)} />
          <Metric label="Return impact" value={formatMoney(selected.returnsImpact)} />
          <Metric label="Net profit" value={formatMoney(selected.netProfit)} />
        </div>
        <p className="text-xs text-muted-foreground">Net profit = item sale margin − discount − return impact. Returns are assigned to the salesperson on the original memo.</p>
      </CardContent></Card>}
    </> : <p className="text-sm text-muted-foreground">No DSR added yet. Use Manage DSR to add Shawon or Babu Bhai.</p> : <Skeleton className="h-24 w-full" />}
    <DsrDialog open={manageOpen} onOpenChange={(open) => { setManageOpen(open); if (!open) mutate(); }} />
  </section>;
}

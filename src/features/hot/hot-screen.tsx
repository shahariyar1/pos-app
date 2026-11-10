"use client";

import { useEffect, useState } from "react";
import useSWR from "swr";
import { Flame, HeartCrack, LayoutGrid, Search, ShieldCheck, Snowflake } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useDebounce } from "@/hooks/use-debounce";
import { fetcher, qs } from "@/lib/fetcher";
import { cn, dayRange, formatMoney, todayStr } from "@/lib/utils";
import type { AllResponse, DamageResponse, HotResponse, ProductsResponse, SlowResponse } from "@/types";

type Period = "day" | "month" | "year";
type View = "all" | "best" | "slow" | "damage";
type Sort = "sold" | "warranty-most" | "warranty-least" | "name";

function rangeFor(period: Period, value: string) {
  if (period === "day" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return dayRange(value, value);
  if (period === "month" && /^\d{4}-\d{2}$/.test(value)) {
    const [y, m] = value.split("-").map(Number);
    return dayRange(`${value}-01`, `${value}-${String(new Date(y, m, 0).getDate()).padStart(2, "0")}`);
  }
  if (period === "year" && /^\d{4}$/.test(value)) return dayRange(`${value}-01-01`, `${value}-12-31`);
  return null;
}

const LABELS: Record<Period, string> = { day: "Day", month: "Month", year: "Year" };
const PERIOD_WORD: Record<Period, string> = { day: "this day", month: "this month", year: "this year" };

/** "Warranty 90 days" counting down. Green is plenty, amber is running low, red is nearly over or over. */
function WarrantyBadge({ days }: { days: number }) {
  const tone = days <= 7 ? "bg-destructive/10 text-destructive" : days <= 30 ? "bg-warn-soft text-warn" : "bg-success-soft text-success";
  const text = days < 0 ? "Warranty over" : days === 0 ? "Warranty ends today" : `Warranty ${days} day${days === 1 ? "" : "s"}`;
  return (
    <Badge className={cn("gap-1 border-transparent font-medium", tone)}>
      <ShieldCheck className="size-3" aria-hidden /> {text}
    </Badge>
  );
}

const dateOnly = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });

/** "today", "yesterday", "12 days ago", "3 months ago" */
function ago(iso: string) {
  const start = new Date(new Date().toDateString()).getTime();
  const then = new Date(new Date(iso).toDateString()).getTime();
  const days = Math.round((start - then) / 86_400_000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  if (days < 730) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

/** Best sellers, and the products that are not moving, for a day, a month or a year. */
export function HotScreen() {
  const [view, setView] = useState<View>("best");
  const [sort, setSort] = useState<Sort>("sold");
  const [warrantyOnly, setWarrantyOnly] = useState(false);
  const [period, setPeriod] = useState<Period>("month");
  const [values, setValues] = useState<Record<Period, string> | null>(null);
  const [group, setGroup] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [inStock, setInStock] = useState(true);
  const dq = useDebounce(q.trim(), 250);

  // Dates are set after mount so the server clock can't disagree with the shop's clock
  useEffect(() => {
    const t = todayStr();
    setValues({ day: t, month: t.slice(0, 7), year: t.slice(0, 4) });
  }, []);

  const range = values ? rangeFor(period, values[period]) : null;
  const { data: best, isLoading: loadingBest } = useSWR<HotResponse>(
    range && view === "best" ? `/api/hot${qs({ ...range, group, limit: 30 })}` : null,
    fetcher,
  );
  const { data: slow, isLoading: loadingSlow } = useSWR<SlowResponse>(
    range && view === "slow" ? `/api/hot/slow${qs({ ...range, group, q: dq, inStock: inStock ? "true" : "false", limit: 100 })}` : null,
    fetcher,
  );
  const { data: all, isLoading: loadingAll } = useSWR<AllResponse>(
    range && view === "all" ? `/api/hot/all${qs({ ...range, group, q: dq, inStock: inStock ? "true" : "false", sort, warrantyOnly: warrantyOnly ? "true" : undefined })}` : null,
    fetcher,
  );
  const { data: damage, isLoading: loadingDamage } = useSWR<DamageResponse>(
    range && view === "damage" ? `/api/hot/damage${qs({ ...range, group, q: dq })}` : null,
    fetcher,
  );
  const { data: groupsData } = useSWR<ProductsResponse>("/api/products?limit=1", fetcher);
  const max = best?.data[0]?.qty ?? 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {view === "all" ? (
          <LayoutGrid className="size-6 text-primary" aria-hidden />
        ) : view === "best" ? (
          <Flame className="size-6 text-warn" aria-hidden />
        ) : view === "slow" ? (
          <Snowflake className="size-6 text-primary" aria-hidden />
        ) : (
          <HeartCrack className="size-6 text-destructive" aria-hidden />
        )}
        <h1 className="text-2xl font-semibold">Hot</h1>
        <span className="text-sm text-muted-foreground">
          {view === "all" ? "every product, with its warranty" : view === "best" ? "best selling products" : view === "slow" ? "products that are not selling" : "products that came back damaged"}
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-lg border bg-card p-1 sm:w-fit" role="group" aria-label="View">
        <Button size="sm" className="shrink-0 flex-1 sm:flex-none" variant={view === "all" ? "default" : "ghost"} onClick={() => setView("all")}>
          <LayoutGrid className="size-4" aria-hidden /> All
        </Button>
        <Button size="sm" className="shrink-0 flex-1 sm:flex-none" variant={view === "best" ? "default" : "ghost"} onClick={() => setView("best")}>
          <Flame className="size-4" aria-hidden /> Best selling
        </Button>
        <Button size="sm" className="shrink-0 flex-1 sm:flex-none" variant={view === "slow" ? "default" : "ghost"} onClick={() => setView("slow")}>
          <Snowflake className="size-4" aria-hidden /> Not selling
        </Button>
        <Button size="sm" className="shrink-0 flex-1 sm:flex-none" variant={view === "damage" ? "default" : "ghost"} onClick={() => setView("damage")}>
          <HeartCrack className="size-4" aria-hidden /> Damage
        </Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="flex gap-1 rounded-lg border bg-card p-1" role="group" aria-label="Period">
          {(Object.keys(LABELS) as Period[]).map((p) => (
            <Button key={p} size="sm" variant={period === p ? "default" : "ghost"} onClick={() => setPeriod(p)}>
              {LABELS[p]}
            </Button>
          ))}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="hot-value">{period === "day" ? "Date" : period === "month" ? "Month" : "Year"}</Label>
          {values &&
            (period === "year" ? (
              <Input id="hot-value" type="number" min="2000" max="2100" className="w-28 bg-card" value={values.year} onChange={(e) => setValues({ ...values, year: e.target.value })} />
            ) : (
              <Input
                id="hot-value"
                type={period === "day" ? "date" : "month"}
                className="w-48 bg-card"
                value={values[period]}
                onChange={(e) => setValues({ ...values, [period]: e.target.value })}
              />
            ))}
        </div>
      </div>

      {groupsData && groupsData.groups.length > 0 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by group">
          <Button size="sm" variant={group === null ? "default" : "outline"} onClick={() => setGroup(null)}>
            All
          </Button>
          {groupsData.groups.map((g) => (
            <Button key={g} size="sm" variant={group === g ? "default" : "outline"} onClick={() => setGroup(g)}>
              {g}
            </Button>
          ))}
        </div>
      )}

      {view === "all" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Lines listed</p>
                {all ? <p className="text-2xl font-semibold">{all.total}</p> : <Skeleton className="h-8 w-24" />}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Units in stock</p>
                {all ? <p className="text-2xl font-semibold">{all.stockUnits}</p> : <Skeleton className="h-8 w-24" />}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Warranty ending within 15 days</p>
                {all ? <p className={cn("text-2xl font-semibold", all.expiring > 0 && "text-warn")}>{all.expiring}</p> : <Skeleton className="h-8 w-24" />}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search products" placeholder="Search name, code or location" className="bg-card pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={inStock} onCheckedChange={setInStock} aria-label="Only products in stock" />
              Only products in stock
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={warrantyOnly} onCheckedChange={setWarrantyOnly} aria-label="Only products with a warranty" />
              Only products with a warranty
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Sort by">
            <span className="text-sm text-muted-foreground">Sort by</span>
            <Button size="sm" variant={sort === "sold" ? "default" : "outline"} onClick={() => setSort("sold")}>
              Most sold
            </Button>
            <Button size="sm" variant={sort === "warranty-most" ? "default" : "outline"} onClick={() => { setSort("warranty-most"); setWarrantyOnly(true); }}>
              Most warranty left
            </Button>
            <Button size="sm" variant={sort === "warranty-least" ? "default" : "outline"} onClick={() => { setSort("warranty-least"); setWarrantyOnly(true); }}>
              Least warranty left
            </Button>
            <Button size="sm" variant={sort === "name" ? "default" : "outline"} onClick={() => setSort("name")}>
              Name
            </Button>
          </div>

          {loadingAll ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : all?.data.length ? (
            <>
              <ul className="space-y-2">
                {all.data.map((r) => (
                  <li key={r.key} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{r.code}</span>
                        {r.group && <Badge variant="outline">{r.group}</Badge>}
                        {r.location && <span>Location {r.location}</span>}
                        {r.daysLeft !== null && <WarrantyBadge days={r.daysLeft} />}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{r.qty} in stock</p>
                      <p className="text-xs text-muted-foreground">
                        {r.sold} sold {PERIOD_WORD[period]}
                      </p>
                      <p className={cn("text-xs", r.lastSold ? "text-muted-foreground" : "text-destructive")}>
                        {r.lastSold ? `Last sold ${dateOnly(r.lastSold)}` : "Never sold"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {all.data.some((r) => r.daysLeft !== null) && (
                <p className="text-xs text-muted-foreground">
                  A product with a warranty is listed once for each day its units arrived, so the same product can appear twice (for example 4 units with 29 days left and 10 with 90 days left). The sold number is for the whole product.
                </p>
              )}
              {all.total > all.data.length && (
                <p className="text-center text-sm text-muted-foreground">
                  Showing {all.data.length} of {all.total} lines. Use the search or a group to narrow it down.
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">Nothing matches.</p>
          )}
        </>
      ) : view === "best" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Units sold</p>
                {best ? <p className="text-2xl font-semibold">{best.totalQty}</p> : <Skeleton className="h-8 w-24" />}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Sales value</p>
                {best ? <p className="text-2xl font-semibold">{formatMoney(best.totalRevenue)}</p> : <Skeleton className="h-8 w-32" />}
              </CardContent>
            </Card>
          </div>

          {loadingBest ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : best?.data.length ? (
            <ol className="space-y-2">
              {best.data.map((r, i) => (
                <li key={r.productId} className="rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={cn("grid size-9 shrink-0 place-items-center rounded-full text-sm font-bold", i < 3 ? "bg-warn-soft text-warn" : "bg-muted text-muted-foreground")}
                      aria-label={`Rank ${i + 1}`}
                    >
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{r.code}</span>
                        {r.group && <Badge variant="outline">{r.group}</Badge>}
                        <span className={cn(r.stock <= 0 && "font-medium text-destructive")}>{r.stock <= 0 ? "Out of stock" : `${r.stock} left`}</span>
                        {r.lastSold && <span>Last sold {dateOnly(r.lastSold)}</span>}
                      </p>
                      {!!r.batches?.length && (
                        <p className="mt-1 flex flex-wrap gap-1.5">
                          {r.batches.map((b) => (
                            <span key={b.daysLeft} className="inline-flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 text-xs">
                              {b.qty} left <WarrantyBadge days={b.daysLeft} />
                            </span>
                          ))}
                        </p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{r.qty} sold</p>
                      <p className="text-xs text-muted-foreground">{best.totalQty ? Math.round((r.qty / best.totalQty) * 100) : 0}% · {formatMoney(r.revenue)}</p>
                    </div>
                  </div>
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-warn" style={{ width: `${Math.max(4, (r.qty / max) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No sales in this period yet.</p>
          )}
        </>
      ) : view === "damage" ? (
        <>
          <div className={cn("grid gap-3", damage?.unlocked ? "sm:grid-cols-3" : "sm:grid-cols-2")}>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Damaged units</p>
                {damage ? <p className="text-2xl font-semibold">{damage.totalQty}</p> : <Skeleton className="h-8 w-24" />}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Refunded for them</p>
                {damage ? <p className="text-2xl font-semibold">{formatMoney(damage.totalRefund)}</p> : <Skeleton className="h-8 w-32" />}
              </CardContent>
            </Card>
            {damage?.unlocked && (
              <Card>
                <CardContent className="space-y-1">
                  <p className="text-sm text-muted-foreground">Cost you lost</p>
                  <p className="text-2xl font-semibold text-destructive">{formatMoney(damage.totalCost ?? 0)}</p>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search damaged products" placeholder="Search product, memo or customer" className="bg-card pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>

          {loadingDamage ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : damage?.data.length ? (
            <ul className="space-y-2">
              {damage.data.map((r) => (
                <li key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{r.productName}</p>
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                      {r.code && <span>{r.code}</span>}
                      {r.group && <Badge variant="outline">{r.group}</Badge>}
                      {r.invoiceNo && <span>{r.invoiceNo}</span>}
                      {r.customerName && <span>{r.customerName}</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-destructive">{r.qty} damaged</p>
                    <p className="text-xs text-muted-foreground">
                      {dateOnly(r.createdAt)} · {ago(r.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Refund {formatMoney(r.refundAmount)}
                      {r.costValue !== undefined && ` · cost ${formatMoney(r.costValue)}`}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">No damaged products {PERIOD_WORD[period]}.</p>
          )}
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Products not sold {PERIOD_WORD[period]}</p>
                {slow ? <p className="text-2xl font-semibold">{slow.total}</p> : <Skeleton className="h-8 w-24" />}
              </CardContent>
            </Card>
            <Card>
              <CardContent className="space-y-1">
                <p className="text-sm text-muted-foreground">Units sitting on the shelf</p>
                {slow ? <p className="text-2xl font-semibold">{slow.stockUnits}</p> : <Skeleton className="h-8 w-24" />}
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-52 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Input aria-label="Search products" placeholder="Search a product to check it" className="bg-card pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={inStock} onCheckedChange={setInStock} aria-label="Only products in stock" />
              Only products in stock
            </label>
          </div>

          {loadingSlow ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : slow?.data.length ? (
            <>
              <ul className="space-y-2">
                {slow.data.map((r) => (
                  <li key={`${r.productId}:${r.daysLeft}`} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.name}</p>
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted-foreground">
                        <span>{r.code}</span>
                        {r.group && <Badge variant="outline">{r.group}</Badge>}
                        {r.location && <span>Location {r.location}</span>}
                        {r.daysLeft !== null && <WarrantyBadge days={r.daysLeft} />}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={cn("text-sm font-semibold", r.lastSold === null && "text-destructive")}>
                        {r.lastSold ? dateOnly(r.lastSold) : "Never sold"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {r.lastSold ? `${ago(r.lastSold)} · ` : ""}
                        {r.stock} in stock
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
              {slow.total > slow.data.length && (
                <p className="text-center text-sm text-muted-foreground">
                  Showing the {slow.data.length} that have gone longest without a sale, out of {slow.total}. Use the search or a group to narrow it down.
                </p>
              )}
            </>
          ) : (
            <p className="rounded-lg border border-dashed p-10 text-center text-muted-foreground">
              Everything {inStock ? "in stock " : ""}sold at least once {PERIOD_WORD[period]}. Nice.
            </p>
          )}
        </>
      )}
    </div>
  );
}

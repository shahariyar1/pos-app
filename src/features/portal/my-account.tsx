"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { Field } from "@/components/form-field";
import { StatusBadge } from "@/components/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { api, errorMessage, fetcher, revalidate } from "@/lib/fetcher";
import { cn, formatDateTime, formatMoney } from "@/lib/utils";
import { profileFormSchema, type ProfileFormValues } from "@/lib/validations";
import type { PortalMe, PortalStatement } from "@/types";

function ProfileForm({ me }: { me: PortalMe }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm<ProfileFormValues>({ resolver: zodResolver(profileFormSchema), defaultValues: { phone: me.phone, address: me.address } });

  useEffect(() => reset({ phone: me.phone, address: me.address }), [me.phone, me.address, reset]);

  async function onSubmit(values: ProfileFormValues) {
    try {
      await api("/api/portal/me", { method: "PATCH", body: JSON.stringify(values) });
      toast.success("Saved");
      revalidate("/api/portal/me");
    } catch (e) {
      toast.error(errorMessage(e));
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <Field label="Phone number" htmlFor="a-phone" error={errors.phone?.message} hint="Needed to place orders. Never used for spam.">
        <Input id="a-phone" type="tel" inputMode="tel" placeholder="01XXXXXXXXX" aria-invalid={!!errors.phone} {...register("phone")} />
      </Field>
      <Field label="Shop address" htmlFor="a-address" error={errors.address?.message}>
        <Input id="a-address" aria-invalid={!!errors.address} {...register("address")} />
      </Field>
      <Button type="submit" disabled={isSubmitting || !isDirty}>
        {isSubmitting ? "Saving…" : "Save changes"}
      </Button>
    </form>
  );
}

/** The customer's own page: what they owe, what they bought, what they paid. */
export function MyAccount() {
  const router = useRouter();
  const { data: me } = useSWR<PortalMe>("/api/portal/me", fetcher);
  const { data: st, isLoading } = useSWR<PortalStatement>("/api/portal/statement", fetcher);
  const due = st?.due ?? me?.due ?? null;

  async function logout() {
    await api("/api/portal/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold">{me?.shopName ?? "My account"}</h1>
          <p className="text-sm text-muted-foreground">{me?.address}</p>
        </div>
        <Button variant="outline" onClick={logout}>
          Log out
        </Button>
      </div>

      <Card className={cn(due !== null && due > 0 && "border-warn/40")}>
        <CardContent className="space-y-1">
          <p className="text-sm text-muted-foreground">{due !== null && due < 0 ? "Your credit with the shop" : "What you owe the shop"}</p>
          {due === null ? (
            <Skeleton className="h-9 w-40" />
          ) : (
            <p className={cn("text-3xl font-bold", due > 0 ? "text-warn" : "text-success")}>{due === 0 ? "All clear" : formatMoney(Math.abs(due))}</p>
          )}
          {due !== null && due > 0 && <p className="text-xs text-muted-foreground">Please pay the shop when you can. It is added to your next order total.</p>}
        </CardContent>
      </Card>

      <section aria-label="Things you bought" className="space-y-2">
        <h2 className="text-lg font-semibold">What you bought</h2>
        {isLoading ? (
          <Skeleton className="h-24 rounded-xl" />
        ) : st?.memos.length ? (
          <ul className="space-y-2">
            {st.memos.map((m) => (
              <li key={m._id} className="rounded-xl border bg-card">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 p-3">
                    <span>
                      <span className="font-medium">{m.invoiceNo}</span>
                      <span className="block text-xs text-muted-foreground">{formatDateTime(m.createdAt)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-right">
                        <span className="block font-semibold">{formatMoney(m.subtotal - (m.discount ?? 0) - (m.returnTotal ?? 0))}</span>
                        {m.dueAfter > 0 && <span className="block text-xs text-warn">Due {formatMoney(m.dueAfter)}</span>}
                      </span>
                      <StatusBadge status={m.status} />
                    </span>
                  </summary>
                  <div className="space-y-2 border-t p-3 text-sm">
                    <ul className="space-y-1">
                      {m.items.map((i, idx) => (
                        <li key={idx} className="flex justify-between gap-2">
                          <span>
                            {i.name} <span className="text-muted-foreground">× {i.qty}</span>
                          </span>
                          <span>{formatMoney(i.qty * i.unitPrice)}</span>
                        </li>
                      ))}
                    </ul>
                    <dl className="space-y-0.5 border-t pt-2 text-muted-foreground">
                      {!!m.discount && (
                        <div className="flex justify-between">
                          <dt>Discount</dt>
                          <dd>- {formatMoney(m.discount)}</dd>
                        </div>
                      )}
                      {!!m.returnTotal && (
                        <div className="flex justify-between">
                          <dt>Returned items</dt>
                          <dd>- {formatMoney(m.returnTotal)}</dd>
                        </div>
                      )}
                      {m.previousDue !== 0 && (
                        <div className="flex justify-between">
                          <dt>Earlier due</dt>
                          <dd>{formatMoney(m.previousDue)}</dd>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <dt>Paid</dt>
                        <dd>{formatMoney(m.paid)}</dd>
                      </div>
                    </dl>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        ) : (
          <p className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">Nothing bought yet. Your memos will appear here after the shop confirms an order.</p>
        )}
      </section>

      {!!st?.payments.length && (
        <section aria-label="Payments" className="space-y-2">
          <h2 className="text-lg font-semibold">Payments you made</h2>
          <ul className="divide-y rounded-xl border bg-card">
            {st.payments.map((p) => (
              <li key={p._id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                <span>
                  {formatDateTime(p.createdAt)}
                  {p.note && <span className="block text-xs text-muted-foreground">{p.note}</span>}
                </span>
                <span className="font-medium text-success">{formatMoney(p.amount)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-label="Your details" className="space-y-2">
        <h2 className="text-lg font-semibold">Your details</h2>
        <Card>
          <CardContent>{me ? <ProfileForm me={me} /> : <Skeleton className="h-32" />}</CardContent>
        </Card>
      </section>
    </div>
  );
}

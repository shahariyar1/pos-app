"use client";

import { useEffect } from "react";
import useSWR from "swr";
import { EntitySearch } from "@/components/entity-search";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useDebounce } from "@/hooks/use-debounce";
import { fetcher, qs } from "@/lib/fetcher";
import { formatMoney } from "@/lib/utils";
import { useCart } from "@/stores/cart-store";
import type { Customer, CustomersResponse } from "@/types";

/**
 * Customer / store name field at the top of the memo.
 * Typing searches existing customers; an exact match (or a click) loads their previous due automatically.
 * A name that matches nobody becomes a new customer at checkout.
 */
export function CustomerPicker() {
  const customer = useCart((s) => s.customer);
  const setCustomer = useCart((s) => s.setCustomer);
  const term = useDebounce(customer.name.trim(), 200);

  const { data } = useSWR<CustomersResponse>(term ? `/api/customers${qs({ q: term, limit: 6 })}` : null, fetcher);
  const results = data?.data ?? [];

  // Typed an exact name without clicking? Link it so the previous due still appears.
  const exact = !customer._id ? results.find((c) => c.name.toLowerCase() === term.toLowerCase()) : undefined;
  const stillTyping = term !== customer.name.trim();
  useEffect(() => {
    if (exact && !stillTyping) setCustomer({ _id: exact._id, name: exact.name, dueBalance: exact.dueBalance, address: exact.address || customer.address });
  }, [exact, stillTyping, setCustomer, customer.address]);

  const isNew = !!term && !customer._id && !!data && !exact && !stillTyping;

  return (
    <div className="space-y-1.5">
      <Label htmlFor="memo-customer">Customer or store</Label>
      <EntitySearch<Customer>
        id="memo-customer"
        placeholder="Type a name"
        value={customer.name}
        // editing the text un-links the customer so a stale due is never applied to a different name
        onValueChange={(name) => setCustomer({ name, dueBalance: 0, address: customer.address })}
        results={results}
        getKey={(c) => c._id}
        onPick={(c) => setCustomer({ _id: c._id, name: c.name, dueBalance: c.dueBalance, address: c.address || customer.address })}
        renderItem={(c) => (
          <div className="flex items-center justify-between gap-2">
            <span className="font-medium">{c.name}</span>
            {c.dueBalance > 0 && <span className="text-xs text-warn">Owes {formatMoney(c.dueBalance)}</span>}
          </div>
        )}
      />
      {isNew && <p className="text-xs text-muted-foreground">New customer. They will be saved with this memo.</p>}
      {customer._id && customer.dueBalance !== 0 && (
        <p className="rounded-md bg-warn-soft px-2.5 py-1.5 text-sm text-warn">
          {customer.dueBalance > 0
            ? `Previous due ${formatMoney(customer.dueBalance)} is added to the total`
            : `Store credit ${formatMoney(-customer.dueBalance)} is applied to the total`}
        </p>
      )}
      <div className="space-y-1.5 pt-2">
        <Label htmlFor="memo-address">Address (optional)</Label>
        <Input
          id="memo-address"
          autoComplete="off"
          placeholder="Shop or delivery address"
          value={customer.address ?? ""}
          onChange={(e) => setCustomer({ ...customer, address: e.target.value })}
        />
      </div>
    </div>
  );
}

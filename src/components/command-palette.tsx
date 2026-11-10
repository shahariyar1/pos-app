"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Flame, Inbox, LayoutDashboard, Package, ShoppingCart, User, Users } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useDebounce } from "@/hooks/use-debounce";
import { fetcher } from "@/lib/fetcher";
import { formatMoney } from "@/lib/utils";
import { useCart } from "@/stores/cart-store";
import { useUi } from "@/stores/ui-store";
import type { SearchResponse } from "@/types";

const PAGES = [
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/orders", label: "Orders", icon: Inbox },
  { href: "/hot", label: "Hot", icon: Flame },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
];

export function CommandPalette() {
  const router = useRouter();
  const open = useUi((s) => s.paletteOpen);
  const setOpen = useUi((s) => s.setPaletteOpen);
  const setCustomer = useCart((s) => s.setCustomer);
  const [q, setQ] = useState("");
  const dq = useDebounce(q.trim(), 150);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(!open);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  const { data } = useSWR<SearchResponse>(open && dq ? `/api/search?q=${encodeURIComponent(dq)}` : null, fetcher);

  const go = (href: string) => {
    setOpen(false);
    setQ("");
    router.push(href);
  };

  const pages = PAGES.filter((p) => p.label.toLowerCase().includes(q.trim().toLowerCase()));

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (!o) setQ("");
      }}
    >
      <DialogContent showCloseButton={false} className="overflow-hidden p-0 sm:max-w-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Search</DialogTitle>
          <DialogDescription>Find products, customers and pages</DialogDescription>
        </DialogHeader>
        <Command shouldFilter={false}>
          <CommandInput value={q} onValueChange={setQ} placeholder="Type a product code, name or customer…" />
          <CommandList>
            <CommandEmpty>{dq && !data ? "Searching…" : "No matches."}</CommandEmpty>

            {data?.products.length ? (
              <CommandGroup heading="Products">
                {data.products.map((p) => (
                  <CommandItem key={p._id} value={`p-${p._id}`} onSelect={() => go(`/pos?q=${encodeURIComponent(p.code)}`)}>
                    <Package className="size-4" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <span className="font-medium">{p.name}</span>{" "}
                      <span className="text-muted-foreground">{p.code}</span>
                    </div>
                    <span className="text-sm text-muted-foreground">
                      {p.location || "No location"} · {p.stock} in stock · {formatMoney(p.salePrice)}
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {data?.customers.length ? (
              <CommandGroup heading="Customers">
                {data.customers.map((c) => (
                  <CommandItem
                    key={c._id}
                    value={`c-${c._id}`}
                    onSelect={() => {
                      setCustomer({ _id: c._id, name: c.name, dueBalance: c.dueBalance });
                      go("/pos");
                    }}
                  >
                    <User className="size-4" aria-hidden />
                    <span className="flex-1 font-medium">{c.name}</span>
                    {c.dueBalance > 0 && <span className="text-sm text-warn">Owes {formatMoney(c.dueBalance)}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ) : null}

            {pages.length > 0 && (
              <CommandGroup heading="Go to">
                {pages.map(({ href, label, icon: Icon }) => (
                  <CommandItem key={href} value={`page-${href}`} onSelect={() => go(href)}>
                    <Icon className="size-4" aria-hidden /> {label}
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

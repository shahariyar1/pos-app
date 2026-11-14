"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import useSWR, { SWRConfig, mutate } from "swr";
import { ClipboardList, Hourglass, LogOut, ShoppingCart, Store, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { OfflineBanner } from "@/components/offline-banner";
import { useMounted } from "@/hooks/use-mounted";
import { ApiError, api, fetcher } from "@/lib/fetcher";
import { SHOP_NAME, SHOP_PHONES } from "@/lib/shop";
import { cn } from "@/lib/utils";
import { portalCount, usePortalCart } from "@/stores/portal-cart";
import type { PortalMe } from "@/types";

const NAV = [
  { href: "/shop", label: "Shop", icon: Store },
  { href: "/shop/cart", label: "Cart", icon: ShoppingCart },
  { href: "/shop/orders", label: "My orders", icon: ClipboardList },
  { href: "/shop/account", label: "My account", icon: User },
];

function Notice({ icon: Icon, title, children }: { icon: typeof Hourglass; title: string; children: React.ReactNode }) {
  return (
    <main className="grid min-h-dvh place-items-center p-4">
      <Card className="w-full max-w-md">
        <CardContent className="space-y-3 text-center">
          <Icon className="mx-auto size-10 text-warn" aria-hidden />
          <h1 className="text-lg font-semibold">{title}</h1>
          <div className="space-y-3 text-sm text-muted-foreground">{children}</div>
        </CardContent>
      </Card>
    </main>
  );
}

/** Customer layout: shop, cart, orders, account. No counter, dashboard or other customers. */
export function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const mounted = useMounted();
  const count = usePortalCart((s) => portalCount(s.items));
  const { data: me, error } = useSWR<PortalMe>("/api/portal/me", fetcher);

  async function logout() {
    await api("/api/portal/logout", { method: "POST" }).catch(() => {});
    router.push("/login");
    router.refresh();
  }

  const logoutButton = (
    <Button variant="outline" onClick={logout}>
      <LogOut className="size-4" aria-hidden /> Log out
    </Button>
  );

  if (error instanceof ApiError && error.status === 403) {
    return (
      <Notice icon={Hourglass} title="This account is blocked">
        <p>{error.message}</p>
        <p>Call {SHOP_PHONES}.</p>
        {logoutButton}
      </Notice>
    );
  }

  if (me?.status === "pending") {
    return (
      <Notice icon={Hourglass} title="Waiting for approval">
        <p>
          {SHOP_NAME} has your request for <strong>{me.shopName}</strong>. Once it is approved you can see products and place orders.
        </p>
        <p>To speed it up, call {SHOP_PHONES}.</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button onClick={() => mutate("/api/portal/me")}>Check again</Button>
          {logoutButton}
        </div>
      </Notice>
    );
  }

  return (
    <SWRConfig value={{ fetcher, keepPreviousData: true, revalidateOnFocus: true }}>
      <div className="min-h-dvh">
        <header className="sticky top-0 z-20 border-b bg-background/90 backdrop-blur">
          <div className="mx-auto flex h-14 max-w-5xl items-center gap-3 px-4">
            <Link href="/shop" className="font-semibold text-primary">
              {SHOP_NAME}
            </Link>
            <nav aria-label="Main" className="ml-4 hidden gap-1 sm:flex">
              {NAV.map(({ href, label, icon: Icon }) => {
                const active = href === "/shop" ? pathname === "/shop" : pathname.startsWith(href);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn("relative flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium", active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted")}
                  >
                    <Icon className="size-4" aria-hidden /> {label}
                    {href === "/shop/cart" && mounted && count > 0 && (
                      <span className="rounded-full bg-primary px-1.5 text-[11px] font-semibold text-primary-foreground">{count}</span>
                    )}
                  </Link>
                );
              })}
            </nav>
            <span className="ml-auto hidden max-w-48 truncate text-sm text-muted-foreground sm:block">{me?.shopName}</span>
            <Button variant="ghost" size="icon" className="ml-auto sm:ml-0" aria-label="Log out" onClick={logout}>
              <LogOut className="size-4" />
            </Button>
          </div>
        </header>

        <OfflineBanner />
        <main className="mx-auto max-w-5xl p-4 pb-24 sm:pb-6">{children}</main>

        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-4 border-t bg-card sm:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = href === "/shop" ? pathname === "/shop" : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium", active ? "text-primary" : "text-muted-foreground")}
              >
                <Icon className="size-5" aria-hidden />
                {label}
                {href === "/shop/cart" && mounted && count > 0 && (
                  <span className="absolute right-[28%] top-1 rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">{count}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </SWRConfig>
  );
}

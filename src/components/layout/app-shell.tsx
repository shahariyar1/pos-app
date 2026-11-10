"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Inbox, LayoutDashboard, LogOut, Package, Search, ShoppingCart, Users } from "lucide-react";
import useSWR, { SWRConfig } from "swr";
import { CommandPalette } from "@/components/command-palette";
import { OfflineBanner } from "@/components/offline-banner";
import { Button } from "@/components/ui/button";
import { useMounted } from "@/hooks/use-mounted";
import { api, fetcher } from "@/lib/fetcher";
import { cn } from "@/lib/utils";
import { cartCount, useCart } from "@/stores/cart-store";
import { useUi } from "@/stores/ui-store";

const NAV = [
  { href: "/pos", label: "Sell", icon: ShoppingCart },
  { href: "/orders", label: "Orders", icon: Inbox },
  { href: "/hot", label: "Hot", icon: Flame },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/customers", label: "Customers", icon: Users },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const mounted = useMounted();
  const count = useCart((s) => cartCount(s.items));
  const setPaletteOpen = useUi((s) => s.setPaletteOpen);

  // red number on Orders: orders to confirm + new customers to approve (checked every 20 seconds)
  const { data: badges } = useSWR<{ orders: number; registrations: number }>("/api/owner/badges", fetcher, { refreshInterval: 20_000 });
  const waiting = (badges?.orders ?? 0) + (badges?.registrations ?? 0);
  const badgeFor = (href: string) => (href === "/orders" ? waiting : 0);

  async function logout() {
    await api("/api/auth/owner-logout", { method: "POST" }).catch(() => {});
    window.location.href = "/owner-login";
  }

  return (
    <SWRConfig value={{ fetcher, keepPreviousData: true, revalidateOnFocus: false }}>
      <div className="min-h-dvh sm:pl-16 lg:pl-56">
        {/* Side rail: icons on tablets, labels on desktops */}
        <aside className="fixed inset-y-0 left-0 z-30 hidden w-16 flex-col border-r bg-card sm:flex lg:w-56">
          <div className="flex h-14 items-center justify-center border-b font-semibold text-primary lg:justify-start lg:px-5">
            <span className="lg:hidden">M</span>
            <span className="hidden lg:inline">Memo POS</span>
          </div>
          <nav aria-label="Main" className="flex flex-col gap-1 p-2">
            {NAV.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  title={label}
                  aria-label={label}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center justify-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium lg:justify-start",
                    active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  <Icon className="size-5 shrink-0" aria-hidden />
                  <span className="hidden lg:inline">{label}</span>
                  {badgeFor(href) > 0 && (
                    <span className="rounded-full bg-destructive px-1.5 text-[11px] font-semibold text-white lg:ml-auto" aria-label={`${badgeFor(href)} waiting`}>
                      {badgeFor(href)}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        </aside>

        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur lg:px-6">
          <Button
            variant="outline"
            className="h-9 flex-1 justify-start gap-2 bg-card text-muted-foreground sm:max-w-md"
            onClick={() => setPaletteOpen(true)}
          >
            <Search className="size-4" aria-hidden />
            <span className="truncate">Search products or customers</span>
            <kbd className="ml-auto hidden rounded border bg-muted px-1.5 py-0.5 text-xs sm:inline">Ctrl K</kbd>
          </Button>
          {mounted && count > 0 && !pathname.startsWith("/pos") && (
            <Button asChild size="sm" className="ml-auto">
              <Link href="/pos">
                <ShoppingCart className="size-4" aria-hidden /> Memo · {count}
              </Link>
            </Button>
          )}
          <Button variant="ghost" size="icon" className="ml-auto shrink-0" aria-label="Log out" title="Log out" onClick={logout}>
            <LogOut className="size-4" />
          </Button>
        </header>

        <OfflineBanner />
        <main className="p-4 pb-24 sm:pb-6 lg:p-6">{children}</main>

        {/* Phones: bottom tab bar */}
        <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t bg-card sm:hidden">
          {NAV.map(({ href, label, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
                {badgeFor(href) > 0 && (
                  <span className="absolute right-[22%] top-1 rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-white">{badgeFor(href)}</span>
                )}
              </Link>
            );
          })}
        </nav>
      </div>
      <CommandPalette />
    </SWRConfig>
  );
}

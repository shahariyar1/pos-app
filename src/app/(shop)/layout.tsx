import { PortalShell } from "@/features/portal/portal-shell";
import { customerPage } from "@/lib/guards";

/** Everything under /shop is for logged-in customers only. */
export default async function ShopLayout({ children }: { children: React.ReactNode }) {
  await customerPage();
  return <PortalShell>{children}</PortalShell>;
}

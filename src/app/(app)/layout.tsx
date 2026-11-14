import { AppShell } from "@/components/layout/app-shell";
import { ownerPage } from "@/lib/guards";

/** The counter, inventory, dashboard and customers are for the owner only. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  await ownerPage();
  return <AppShell>{children}</AppShell>;
}

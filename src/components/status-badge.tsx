import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { SaleStatus } from "@/types";

const STYLES: Record<SaleStatus, string> = {
  paid: "bg-success-soft text-success border-transparent",
  partial: "bg-warn-soft text-warn border-transparent",
  due: "bg-destructive/10 text-destructive border-transparent",
};
const LABELS: Record<SaleStatus, string> = { paid: "Paid", partial: "Part paid", due: "Due" };

export function StatusBadge({ status }: { status: SaleStatus }) {
  return <Badge className={cn("font-medium", STYLES[status])}>{LABELS[status]}</Badge>;
}

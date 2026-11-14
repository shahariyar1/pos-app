"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { DiscountUnit } from "@/lib/discount";
import { formatMoney } from "@/lib/utils";

/** "Discount" with a BDT / % switch. Shows what it comes to in BDT when it is a percentage. */
export function DiscountField({
  id,
  value,
  unit,
  amount,
  onChange,
}: {
  id: string;
  value: string;
  unit: DiscountUnit;
  /** The discount in BDT after capping. */
  amount: number;
  onChange: (value: string, unit: DiscountUnit) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Discount</Label>
      <div className="flex gap-2">
        <Input id={id} type="number" min="0" step="0.01" inputMode="decimal" placeholder="0" value={value} onChange={(e) => onChange(e.target.value, unit)} />
        <div className="flex shrink-0 gap-1 rounded-lg border p-1" role="group" aria-label="Discount unit">
          <Button type="button" size="sm" variant={unit === "amount" ? "default" : "ghost"} aria-pressed={unit === "amount"} onClick={() => onChange(value, "amount")}>
            BDT
          </Button>
          <Button type="button" size="sm" variant={unit === "percent" ? "default" : "ghost"} aria-pressed={unit === "percent"} onClick={() => onChange(value, "percent")}>
            %
          </Button>
        </div>
      </div>
      {unit === "percent" && amount > 0 && <p className="text-xs text-muted-foreground">That is {formatMoney(amount)} off.</p>}
    </div>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/utils";
import type { DashboardStats } from "@/types";

/** Profit is displayed directly; there is no separate PIN gate. */
export function ProfitCard({ stats }: { stats?: DashboardStats }) {
  const profit = stats?.profit;

  return (
    <Card>
      <CardContent className="space-y-2">
        <p className="text-sm text-muted-foreground">Net profit</p>
        {profit ? (
          <>
            <p className="text-2xl font-semibold">{formatMoney(profit.net)}</p>
            <p className="text-xs text-muted-foreground">
              Sales margin {formatMoney(profit.gross)} less returns {formatMoney(profit.returnsImpact)}
            </p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">No profit data for this date range.</p>
        )}
      </CardContent>
    </Card>
  );
}

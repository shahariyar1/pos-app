"use client";

import { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/** − [ 12 ] +  Tap the number to type any quantity. Going below 1 removes the item. */
export function QtyStepper({ value, max, label, onChange }: { value: number; max: number; label: string; onChange: (n: number) => void }) {
  const [text, setText] = useState(String(value));
  const [active, setActive] = useState(false);

  function commit() {
    const n = Math.floor(Number(text));
    if (text.trim() !== "" && Number.isFinite(n) && n >= 1 && n !== value) onChange(Math.min(n, max));
    setActive(false);
  }

  return (
    <div className="flex items-center gap-1">
      <Button variant="outline" size="icon" className="size-9" aria-label={`Less ${label}`} onClick={() => onChange(value - 1)}>
        <Minus className="size-4" />
      </Button>
      <Input
        aria-label={`Quantity of ${label}`}
        inputMode="numeric"
        className="h-9 w-14 px-1 text-center"
        value={active ? text : String(value)}
        onFocus={(e) => {
          setText(String(value));
          setActive(true);
          e.target.select();
        }}
        onChange={(e) => setText(e.target.value.replace(/\D/g, ""))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
      />
      <Button variant="outline" size="icon" className="size-9" aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus className="size-4" />
      </Button>
    </div>
  );
}

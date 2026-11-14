"use client";

import { useState, type ReactNode } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props<T> = {
  id?: string;
  value: string;
  onValueChange: (v: string) => void;
  results: T[];
  getKey: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  onPick: (item: T) => void;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  className?: string;
};

/** Accessible type-ahead (combobox pattern) with arrow-key navigation. Used for customers and products. */
export function EntitySearch<T>({
  id,
  value,
  onValueChange,
  results,
  getKey,
  renderItem,
  onPick,
  placeholder,
  autoFocus,
  invalid,
  className,
}: Props<T>) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const show = open;

  return (
    <div className={cn("relative", className)}>
      <Input
        id={id}
        role="combobox"
        aria-expanded={show}
        aria-autocomplete="list"
        aria-invalid={invalid}
        autoComplete="off"
        autoFocus={autoFocus}
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          onValueChange(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!show) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => Math.min(a + 1, results.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            onPick(results[active]);
            setOpen(false);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {show && (
        <ul role="listbox" className="absolute z-50 mt-1 max-h-64 w-full overflow-auto rounded-md border bg-popover p-1 shadow-md">
          {results.length === 0 ? (
            <li className="px-2.5 py-2 text-sm text-muted-foreground">No matches found</li>
          ) : (
            results.map((r, i) => (
              <li key={getKey(r)} role="option" aria-selected={i === active}>
                <button
                  type="button"
                  // keep focus in the input so blur doesn't close the list before the click lands
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => {
                    onPick(r);
                    setOpen(false);
                  }}
                  className={cn("w-full rounded-sm px-2.5 py-2 text-left text-sm", i === active ? "bg-accent" : "hover:bg-muted")}
                >
                  {renderItem(r)}
                </button>
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}

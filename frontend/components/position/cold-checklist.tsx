"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ColdCheckItem } from "@/types/position";

interface ColdChecklistProps {
  items: ColdCheckItem[];
  onToggle: (id: string) => void;
  className?: string;
}

export function ColdChecklist({ items, onToggle, className }: ColdChecklistProps) {
  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">交易前冷静检查清单</h2>
        <p className="text-sm text-muted-foreground">全部勾选后方可继续</p>
      </div>

      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onToggle(item.id)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border p-3 text-left transition-colors",
                item.checked
                  ? "border-success/30 bg-success/10"
                  : "border-border-subtle bg-elevated/50 hover:border-border-accent hover:bg-muted"
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                  item.checked
                    ? "border-success bg-success text-white"
                    : "border-border-subtle bg-card"
                )}
              >
                {item.checked && <Check className="h-3.5 w-3.5" />}
              </span>
              <span
                className={cn(
                  "text-sm",
                  item.checked ? "text-foreground" : "text-muted-foreground"
                )}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

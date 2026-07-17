"use client";

import { AlertCircle, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DiagnosticItem } from "@/types/position";

interface DiagnosisPanelProps {
  items: DiagnosticItem[];
  className?: string;
}

export function DiagnosisPanel({ items, className }: DiagnosisPanelProps) {
  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">智能体检诊断</h2>
        <p className="text-sm text-muted-foreground">实时扫描配置隐患并给出优化方案</p>
      </div>

      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">当前配置无提醒</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item) => (
            <li
              key={item.id}
              className={cn(
                "flex items-start gap-3 rounded-xl border p-3",
                item.severity === "warning"
                  ? "border-warning/20 bg-warning/10"
                  : "border-border-subtle bg-elevated/50"
              )}
            >
              {item.severity === "warning" ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              )}
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{item.message}</p>
                {item.action && (
                  <p className="mt-0.5 text-xs text-muted-foreground">{item.action}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

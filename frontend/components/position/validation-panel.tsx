"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ValidationResult } from "@/types/position";

interface ValidationPanelProps {
  results: ValidationResult[];
  className?: string;
}

export function ValidationPanel({ results, className }: ValidationPanelProps) {
  const passedCount = results.filter((r) => r.passed).length;

  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">参数校验</h2>
        <p className="text-sm text-muted-foreground">
          {passedCount}/{results.length} 通过
        </p>
      </div>

      <ul className="space-y-2">
        {results.map((result) => (
          <li
            key={result.id}
            className={cn(
              "flex items-start gap-3 rounded-xl border p-3",
              result.passed
                ? "border-success/20 bg-success/10"
                : "border-danger/20 bg-danger/10"
            )}
          >
            {result.passed ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
            ) : (
              <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-danger" />
            )}
            <div>
              <p className={cn("text-sm font-medium", result.passed ? "text-foreground" : "text-danger")}>
                {result.label}
              </p>
              <p className="text-xs text-muted-foreground">{result.detail}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

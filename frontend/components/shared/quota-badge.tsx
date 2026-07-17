"use client";

import { cn } from "@/lib/utils";

interface QuotaBadgeProps {
  used: number;
  total: number;
  className?: string;
}

export function QuotaBadge({ used, total, className }: QuotaBadgeProps) {
  const exhausted = used >= total;

  return (
    <div
      className={cn(
        "hidden sm:flex items-center gap-2 badge badge-pill",
        exhausted ? "badge-danger" : "badge-cyan",
        className
      )}
    >
      <span className={cn("h-2 w-2 rounded-full", exhausted ? "bg-danger" : "bg-success")} />
      <span>
        今日额度 {used}/{total}
      </span>
    </div>
  );
}

"use client";

import { cn } from "@/lib/utils";

interface Segment {
  key: string;
  ratio: number;
  color: string;
  label?: string;
}

interface ProgressStackedProps {
  segments: Segment[];
  className?: string;
}

export function ProgressStacked({ segments, className }: ProgressStackedProps) {
  const total = segments.reduce((sum, s) => sum + s.ratio, 0);

  return (
    <div
      className={cn(
        "flex h-4 w-full overflow-hidden rounded-lg bg-elevated",
        className
      )}
      role="progressbar"
      aria-valuenow={Math.round(total * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      {segments.map((segment, index) => {
        if (segment.ratio <= 0) return null;
        return (
          <div
            key={segment.key}
            className={cn(
              "h-full transition-all duration-300",
              index === 0 && "rounded-l-lg",
              index === segments.length - 1 && "rounded-r-lg"
            )}
            style={{
              width: `${segment.ratio * 100}%`,
              backgroundColor: segment.color,
            }}
            title={segment.label}
          />
        );
      })}
    </div>
  );
}

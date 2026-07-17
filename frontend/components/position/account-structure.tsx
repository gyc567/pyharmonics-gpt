"use client";

import { ProgressStacked } from "@/components/ui/progress-stacked";
import { cn } from "@/lib/utils";
import { WU_UNIT } from "@/lib/position/defaults";
import type { AccountBucket, PositionConfig } from "@/types/position";

interface AccountStructureProps {
  config: PositionConfig | null;
  buckets: AccountBucket[];
  className?: string;
}

export function AccountStructure({ config, buckets, className }: AccountStructureProps) {
  if (!config) return null;

  const regularCapitalWu = Math.max(0, config.totalCapitalWu - config.cutPositionWu);
  const segments = buckets.map((b) => ({
    key: b.key,
    ratio: regularCapitalWu > 0 ? b.amountWu / regularCapitalWu : 0,
    color: b.color,
    label: b.label,
  }));

  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">仓位结构 & 账户拆分</h2>
        <p className="text-sm text-muted-foreground">
          按“设备隔离”把资金切成不同账户，制造操作阻力
        </p>
      </div>

      <div className="mb-6">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">常规管理资金</span>
          <span className="text-sm text-muted-foreground">{regularCapitalWu.toLocaleString()} WU</span>
        </div>
        <ProgressStacked segments={segments} />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {buckets.map((bucket) => (
          <div
            key={bucket.key}
            className="rounded-xl border border-border-subtle bg-elevated/50 p-4 transition-colors hover:border-border-accent hover:bg-muted"
          >
            <div className="flex items-center gap-2">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: bucket.color }}
              />
              <span className="text-sm font-medium text-foreground">{bucket.label}</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-foreground">
              {bucket.amountWu.toLocaleString()} WU
            </p>
            <p className="text-xs text-muted-foreground">
              ≈ {(bucket.amountWu * WU_UNIT).toLocaleString()} U · 占常规{" "}
              {(bucket.ratioOfRegular * 100).toFixed(1)}%
            </p>
            <p className="mt-1 text-xs text-muted-foreground">{bucket.device}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

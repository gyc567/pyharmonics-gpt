"use client";

import { cn } from "@/lib/utils";
import { WU_UNIT } from "@/lib/position/defaults";
import type { PositionConfig, PositionBalance, RiskLevel } from "@/types/position";

interface PositionHeaderProps {
  config: PositionConfig | null;
  balance: PositionBalance | null;
  riskLevel: RiskLevel;
  className?: string;
}

export function PositionHeader({
  config,
  balance,
  riskLevel,
  className,
}: PositionHeaderProps) {
  if (!config || !balance) return null;

  const regularCapitalWu = Math.max(0, config.totalCapitalWu - config.cutPositionWu);
  const riskScore = 6 - riskLevel.level;

  return (
    <section className={cn("grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4", className)}>
      <MetricCard label="总资金" value={config.totalCapitalWu} unit="WU" subValue={config.totalCapitalWu * WU_UNIT} />
      <MetricCard label="常规管理资金" value={regularCapitalWu} unit="WU" subValue={regularCapitalWu * WU_UNIT} />
      <MetricCard
        label="风控评分"
        value={riskScore}
        unit="/ 6"
        subLabel={riskLevel.level >= 4 ? "高风险" : riskLevel.level >= 2 ? "中风险" : "低风险"}
      />
      <MetricCard
        label="当前触发等级"
        value={riskLevel.level}
        unit="级"
        subLabel={riskLevel.trouble}
      />
    </section>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  unit?: string;
  subValue?: number;
  subLabel?: string;
}

function MetricCard({ label, value, unit, subValue, subLabel }: MetricCardProps) {
  return (
    <div className="glass-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-gradient">{value.toLocaleString()}</span>
        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
      </div>
      {subValue !== undefined && (
        <p className="mt-1 text-xs text-muted-foreground">≈ {subValue.toLocaleString()} U</p>
      )}
      {subLabel && <p className="mt-1 text-xs text-primary">{subLabel}</p>}
    </div>
  );
}

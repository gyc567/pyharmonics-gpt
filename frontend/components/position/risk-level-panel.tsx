"use client";

import { cn } from "@/lib/utils";
import type { PositionConfig, PositionBalance, RiskLevel } from "@/types/position";
import { computeRiskLevels } from "@/lib/position/calculator";

interface RiskLevelPanelProps {
  config: PositionConfig | null;
  balance: PositionBalance | null;
  plannedTrade: number;
  riskLevel: RiskLevel;
  onPlannedTradeChange: (value: number) => void;
  className?: string;
}

const LEVEL_COLORS = [
  "bg-success",
  "bg-cy",
  "bg-warning",
  "bg-orange-500",
  "bg-danger",
  "bg-danger",
];

export function RiskLevelPanel({
  config,
  balance,
  plannedTrade,
  riskLevel,
  onPlannedTradeChange,
  className,
}: RiskLevelPanelProps) {
  if (!config || !balance) return null;

  const levels = computeRiskLevels(config, balance);

  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">风控触发等级</h2>
        <p className="text-sm text-muted-foreground">输入计划交易金额，自动判定需跨越几道阻力</p>
      </div>

      <div className="mb-4 space-y-1.5">
        <label htmlFor="plannedTrade" className="text-xs font-medium text-muted-foreground">
          计划交易金额（WU）
        </label>
        <input
          id="plannedTrade"
          type="number"
          min={0}
          step={0.1}
          value={plannedTrade}
          onChange={(e) => onPlannedTradeChange(Number(e.target.value))}
          className="input-surface"
        />
      </div>

      <div className="mb-4 text-center">
        <span className="text-4xl font-bold text-foreground">{riskLevel.level}</span>
        <span className="text-sm text-muted-foreground"> 级</span>
        <p className="mt-1 text-sm text-primary">{riskLevel.cooldown}</p>
      </div>

      <div className="mb-4 flex gap-1.5">
        {levels.map((level, index) => (
          <div
            key={level.level}
            className={cn(
              "h-2 flex-1 rounded-full transition-all",
              index <= riskLevel.level ? LEVEL_COLORS[index] : "bg-elevated",
              index === riskLevel.level && "shadow-glow-sm"
            )}
          />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <table className="w-full text-left text-xs">
          <thead className="bg-elevated text-muted-foreground">
            <tr>
              <th className="px-3 py-2">等级</th>
              <th className="px-3 py-2">触发区间（WU）</th>
              <th className="px-3 py-2">麻烦</th>
            </tr>
          </thead>
          <tbody>
            {levels.map((level) => (
              <tr
                key={level.level}
                className={cn(
                  "border-t border-border-dim",
                  level.level === riskLevel.level && "bg-primary/5"
                )}
              >
                <td className="px-3 py-2 font-medium text-foreground">{level.level} 级</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {level.minWu.toLocaleString()} ~{" "}
                  {level.maxWu === Infinity ? "∞" : level.maxWu.toLocaleString()}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{level.trouble}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

"use client";

import { cn } from "@/lib/utils";
import { WU_UNIT } from "@/lib/position/defaults";
import type { WhatIfResult } from "@/types/position";

interface WhatIfSimulatorProps {
  actualTrade: number;
  whatIf: WhatIfResult;
  touchesEmergency: boolean;
  onActualTradeChange: (value: number) => void;
  onArchive: () => void;
  className?: string;
}

export function WhatIfSimulator({
  actualTrade,
  whatIf,
  touchesEmergency,
  onActualTradeChange,
  onArchive,
  className,
}: WhatIfSimulatorProps) {
  const rows = [
    { label: "小账户 · 可交易", key: "smallTradable", remaining: whatIf.remainingSmallTradableWu },
    { label: "小账户 · 备用", key: "smallReserve", remaining: whatIf.remainingSmallReserveWu },
    { label: "中账户", key: "mid", remaining: whatIf.remainingMidWu },
    { label: "BTC 趋势仓", key: "btc", remaining: whatIf.remainingBtcWu },
    { label: "救命钱", key: "emergency", remaining: whatIf.remainingEmergencyWu },
  ];

  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-foreground">交易后余额模拟 what-if</h2>
        <p className="text-sm text-muted-foreground">按实际成交金额模拟执行后各账户剩余余额</p>
      </div>

      <div className="mb-4 space-y-1.5">
        <label htmlFor="actualTrade" className="text-xs font-medium text-muted-foreground">
          实际成交金额（WU）
        </label>
        <input
          id="actualTrade"
          type="number"
          min={0}
          step={0.1}
          value={actualTrade}
          onChange={(e) => onActualTradeChange(Number(e.target.value))}
          className="input-surface"
        />
      </div>

      <div className="mb-4 grid grid-cols-3 gap-3 text-center">
        <div className="rounded-xl bg-elevated p-3">
          <p className="text-xs text-muted-foreground">实际成交</p>
          <p className="text-lg font-semibold text-foreground">{whatIf.tradeWu.toLocaleString()} WU</p>
        </div>
        <div className="rounded-xl bg-elevated p-3">
          <p className="text-xs text-muted-foreground">已消耗</p>
          <p className="text-lg font-semibold text-foreground">
            {(
              whatIf.consumedEmergencyWu +
              whatIf.consumedBtcWu +
              whatIf.consumedMidWu +
              whatIf.consumedSmallTradableWu +
              whatIf.consumedSmallReserveWu
            ).toLocaleString()} WU
          </p>
        </div>
        <div className="rounded-xl bg-elevated p-3">
          <p className="text-xs text-muted-foreground">剩余可动用</p>
          <p className="text-lg font-semibold text-foreground">
            {whatIf.remainingTotalWu.toLocaleString()} WU
          </p>
        </div>
      </div>

      {touchesEmergency && (
        <div className="mb-4 rounded-xl border border-danger/20 bg-danger/10 px-3 py-2 text-sm text-danger">
          警告：该交易会动用救命钱，原则上禁止归档。
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-border-subtle">
        <table className="w-full text-left text-xs">
          <thead className="bg-elevated text-muted-foreground">
            <tr>
              <th className="px-3 py-2">账户</th>
              <th className="px-3 py-2">剩余（WU）</th>
              <th className="px-3 py-2">剩余（U）</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t border-border-dim">
                <td className="px-3 py-2 text-foreground">{row.label}</td>
                <td className="px-3 py-2 text-muted-foreground">
                  {row.remaining.toLocaleString()} WU
                </td>
                <td className="px-3 py-2 text-muted-foreground">
                  {(row.remaining * WU_UNIT).toLocaleString()} U
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <button
        type="button"
        onClick={onArchive}
        disabled={touchesEmergency}
        className={cn(
          "btn-primary mt-4 w-full",
          touchesEmergency && "opacity-50 cursor-not-allowed"
        )}
      >
        确认归档并更新余额
      </button>
    </section>
  );
}

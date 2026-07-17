"use client";

import { ArrowDownRight, ArrowUpRight, ShieldAlert, Target } from "lucide-react";
import { cn, formatNumber } from "@/lib/utils";
import type { Signal } from "@/types";

interface SignalCardProps {
  signal: Signal;
  className?: string;
}

const GRADE_STYLES: Record<string, string> = {
  A: "badge-success",
  B: "badge-warning",
  C: "badge",
};

const STATUS_LABELS: Record<string, string> = {
  approaching: "接近中",
  in_prz: "进入反转区",
  confirmed: "已确认",
  swept: "插针回收",
};

export function SignalCard({ signal, className }: SignalCardProps) {
  const isLong = signal.direction === "long";

  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-elevated/50 p-4",
        className
      )}
      data-testid="signal-card"
    >
      <div className="flex flex-wrap items-center gap-2">
        <h4 className="text-sm font-semibold text-foreground">交易信号</h4>
        <span className={cn("badge", GRADE_STYLES[signal.grade] || "badge")}>
          {signal.grade} 级
        </span>
        <span className="badge">{STATUS_LABELS[signal.status] || signal.status}</span>
        <span
          className={cn(
            "ml-auto flex items-center gap-1 text-sm font-medium",
            isLong ? "text-success" : "text-danger"
          )}
        >
          {isLong ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
          {isLong ? "做多 Long" : "做空 Short"}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div className="rounded-lg bg-elevated px-3 py-2">
          <p className="text-xs text-muted-foreground">入场区</p>
          <p className="mt-0.5 font-medium text-foreground">
            {formatNumber(signal.entry_zone[0])} – {formatNumber(signal.entry_zone[1])}
          </p>
        </div>
        <div className="rounded-lg bg-elevated px-3 py-2">
          <p className="text-xs text-muted-foreground">参考入场</p>
          <p className="mt-0.5 font-medium text-foreground">
            {formatNumber(signal.entry_reference)}
          </p>
        </div>
        <div className="rounded-lg bg-elevated px-3 py-2">
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <ShieldAlert className="h-3 w-3" />
            硬止损
          </p>
          <p className="mt-0.5 font-medium text-danger">
            {formatNumber(signal.stop_loss)}
          </p>
        </div>
        <div className="rounded-lg bg-elevated px-3 py-2">
          <p className="text-xs text-muted-foreground">净盈亏比 (TP1/TP2)</p>
          <p className="mt-0.5 font-medium text-foreground">
            {formatNumber(signal.net_rr_tp1)}R / {formatNumber(signal.net_rr_tp2)}R
          </p>
        </div>
      </div>

      {signal.targets.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <Target className="h-3 w-3" />
            阶梯止盈（斐波那契）
          </p>
          {signal.targets.map((t) => (
            <div
              key={t.label}
              className="flex items-center justify-between rounded-lg bg-elevated px-3 py-1.5 text-sm"
            >
              <span className="font-medium text-foreground">
                {t.label} · {formatNumber(t.price)}
              </span>
              <span className="text-xs text-muted-foreground">
                {t.fib_basis} · 平仓 {t.close_pct}%
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {signal.confluence_score != null && (
          <span>共振评分 {signal.confluence_score}/100</span>
        )}
        {signal.htf_trend && <span>高周期趋势 {signal.htf_trend}</span>}
        {signal.regime && signal.regime !== "normal" && (
          <span className="text-warning">量化冲击 {signal.regime}</span>
        )}
        {signal.stability_score != null && (
          <span>稳定性 {signal.stability_score}</span>
        )}
        {signal.position_multiplier != null && (
          <span>仓位系数 ×{signal.position_multiplier}</span>
        )}
        {signal.stop_basis && <span>止损依据 {signal.stop_basis}</span>}
      </div>

      {signal.reasoning && (
        <details className="mt-3 text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground">信号理由</summary>
          <pre className="mt-2 whitespace-pre-wrap rounded-lg bg-elevated p-3 font-sans leading-relaxed">
            {signal.reasoning}
          </pre>
        </details>
      )}
    </div>
  );
}

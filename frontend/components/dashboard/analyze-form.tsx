"use client";

import { useState } from "react";
import { Loader2, SlidersHorizontal, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AnalyzeRequest, MarketsResponse } from "@/types";

interface AnalyzeFormProps {
  form: AnalyzeRequest;
  markets: MarketsResponse | null;
  symbols: string[];
  loading: boolean;
  disabled?: boolean;
  onChange: <K extends keyof AnalyzeRequest>(key: K, value: AnalyzeRequest[K]) => void;
  onSubmit: () => void;
  className?: string;
}

export function AnalyzeForm({
  form,
  markets,
  symbols,
  loading,
  disabled,
  onChange,
  onSubmit,
  className,
}: AnalyzeFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const marketOptions = markets?.markets || ["binance", "yahoo"];
  const intervalOptions = markets?.intervals || ["15m", "1h", "4h", "1d", "1w"];
  const typeOptions = markets?.analysis_types || ["auto", "forming", "formed", "divergence"];

  const TYPE_LABELS: Record<string, string> = {
    auto: "自动设置",
    forming: "形成中",
    formed: "已形成",
    divergence: "背离",
  };
  // "自动设置" always first, the rest in server order.
  const sortedTypeOptions = [
    ...typeOptions.filter((t) => t === "auto"),
    ...typeOptions.filter((t) => t !== "auto"),
  ];

  return (
    <section className={cn("glass-card p-5 sm:p-6", className)}>
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-foreground">新建分析</h2>
        <p className="text-sm text-muted-foreground">
          选择市场、标的与周期，开始谐波形态检测
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">市场</label>
          <select
            value={form.market}
            onChange={(e) => onChange("market", e.target.value as AnalyzeRequest["market"])}
            disabled={loading || disabled}
            className="input-surface"
          >
            {marketOptions.map((m) => (
              <option key={m} value={m}>
                {m === "binance" ? "Binance 加密货币" : "Yahoo 股票"}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">标的</label>
          <select
            value={form.symbol}
            onChange={(e) => onChange("symbol", e.target.value)}
            disabled={loading || disabled || symbols.length === 0}
            className="input-surface uppercase"
          >
            {symbols.length === 0 && (
              <option value="" disabled>
                请选择标的
              </option>
            )}
            {symbols.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">周期</label>
          <select
            value={form.interval}
            onChange={(e) => onChange("interval", e.target.value as AnalyzeRequest["interval"])}
            disabled={loading || disabled}
            className="input-surface"
          >
            {intervalOptions.map((i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">分析类型</label>
          <select
            value={form.analysis_type}
            onChange={(e) =>
              onChange("analysis_type", e.target.value as AnalyzeRequest["analysis_type"])
            }
            disabled={loading || disabled}
            className="input-surface"
          >
            {sortedTypeOptions.map((t) => (
              <option key={t} value={t}>
                {TYPE_LABELS[t] ?? t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setAdvancedOpen((v) => !v)}
        className="mt-4 flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        高级参数
        {advancedOpen ? (
          <ChevronUp className="h-3.5 w-3.5" />
        ) : (
          <ChevronDown className="h-3.5 w-3.5" />
        )}
      </button>

      {advancedOpen && (
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-border-dim pt-4 sm:grid-cols-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">限定数量 (limit_to)</label>
            <input
              type="number"
              min={1}
              max={100}
              value={form.limit_to}
              onChange={(e) => onChange("limit_to", Number(e.target.value))}
              disabled={loading || disabled}
              className="input-surface"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">完成度 (percent_complete)</label>
            <input
              type="number"
              min={0.1}
              max={1}
              step={0.1}
              value={form.percent_complete}
              onChange={(e) => onChange("percent_complete", Number(e.target.value))}
              disabled={loading || disabled}
              className="input-surface"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">蜡烛数量</label>
            <input
              type="number"
              min={100}
              max={5000}
              step={100}
              value={form.candles}
              onChange={(e) => onChange("candles", Number(e.target.value))}
              disabled={loading || disabled}
              className="input-surface"
            />
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          onClick={onSubmit}
          disabled={loading || disabled || !form.symbol.trim()}
          className="btn-primary min-w-[140px] disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              分析中...
            </>
          ) : (
            "开始分析"
          )}
        </button>
      </div>
    </section>
  );
}

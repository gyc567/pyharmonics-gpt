"use client";

import { Bot, User } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VibeMessage, VibeCard } from "@/types/vibe";
import { VibeToolCallCard } from "./vibe-tool-call-card";
import { SignalCard } from "@/components/dashboard/signal-card";

interface VibeMessageProps {
  message: VibeMessage;
}

export function VibeMessageItem({ message }: VibeMessageProps) {
  const isUser = message.role === "user";
  const isTool = message.role === "tool";

  if (isTool) {
    return (
      <div className="px-4 py-2">
        <VibeToolCallCard
          toolName={message.tool_name}
          input={message.tool_input}
          output={message.tool_output_summary}
        />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex gap-3 px-4 py-3",
        isUser ? "flex-row-reverse" : "flex-row"
      )}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          isUser
            ? "bg-primary text-primary-foreground"
            : "bg-surface-2 text-primary"
        )}
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      <div
        className={cn(
          "max-w-[85%] space-y-3 rounded-2xl px-4 py-3",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "glass-card rounded-bl-sm"
        )}
      >
        {message.content && (
          <div className="whitespace-pre-wrap text-sm leading-relaxed">
            {message.content}
          </div>
        )}

        {message.cards && message.cards.length > 0 && (
          <div className="space-y-3">
            {message.cards.map((card, idx) => (
              <VibeCardRenderer key={idx} card={card} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function VibeCardRenderer({ card }: { card: VibeCard }) {
  if (card.type === "signal") {
    return <SignalCard signal={card.payload} />;
  }

  if (card.type === "position_check") {
    const p = card.payload;
    return (
      <div className="rounded-xl border border-border-subtle bg-elevated/50 p-4">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "badge",
              p.risk_level === 0
                ? "badge-success"
                : p.risk_level && p.risk_level < 3
                ? "badge-warning"
                : "badge-danger"
            )}
          >
            风控 {p.risk_label || "未知"}
          </span>
          <span className="text-sm font-medium">{p.symbol}</span>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          计划交易 {p.planned_trade_wu} WU
        </p>
        {p.risk_level !== undefined && p.risk_level > 0 && (
          <p className="mt-1 text-xs text-muted-foreground">
            阻力：{p.trouble} · 建议：{p.cooldown}
          </p>
        )}
        {p.suggestion && (
          <p className="mt-2 text-sm text-foreground">{p.suggestion}</p>
        )}
      </div>
    );
  }

  if (card.type === "backtest") {
    const p = card.payload;
    const metrics = [
      { label: "区间", value: `${p.start_date || "-"} ~ ${p.end_date || "-"}` },
      { label: "信号数", value: p.total_signals ?? "-" },
      { label: "胜率", value: p.win_rate != null ? `${(p.win_rate * 100).toFixed(2)}%` : "-" },
      { label: "盈亏比 (R)", value: p.avg_rr != null ? p.avg_rr.toFixed(2) : "-" },
      { label: "盈亏因子", value: p.profit_factor != null ? p.profit_factor.toFixed(2) : "-" },
      { label: "最大回撤 (R)", value: p.max_drawdown != null ? p.max_drawdown.toFixed(2) : "-" },
    ];
    return (
      <div className="rounded-xl border border-border-subtle bg-elevated/50 p-4">
        <p className="text-sm font-medium">
          回测结果 · {p.symbol} {p.interval} ({p.lookback_days} 天)
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg bg-surface-2 px-3 py-2">
              <p className="text-xs text-muted-foreground">{m.label}</p>
              <p className="mt-0.5 text-sm font-medium text-foreground">{m.value}</p>
            </div>
          ))}
        </div>
        {p.note && (
          <p className="mt-3 text-xs text-muted-foreground">{p.note}</p>
        )}
      </div>
    );
  }

  return null;
}

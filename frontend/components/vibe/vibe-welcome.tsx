"use client";

import { Sparkles, TrendingUp, Shield, History } from "lucide-react";

interface VibeWelcomeProps {
  onSuggestionClick?: (text: string) => void;
}

const SUGGESTIONS = [
  {
    icon: TrendingUp,
    text: "分析 BTCUSDT 1h 的形成中形态",
  },
  {
    icon: Shield,
    text: "检查 0.5 WU 买 BTCUSDT 会不会超配",
  },
  {
    icon: History,
    text: "对 BTCUSDT 1h 的做多信号做 90 天回测",
  },
];

export function VibeWelcome({ onSuggestionClick }: VibeWelcomeProps) {
  return (
    <div className="flex flex-col items-center justify-center px-4 py-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cy to-purple shadow-glow">
        <Sparkles className="h-8 w-8 text-white" />
      </div>
      <h2 className="mt-6 text-xl font-semibold text-foreground">
        AI 交易助手
      </h2>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        我可以帮你分析谐波形态、生成交易信号、检查仓位风控、解释技术问题。
        所有输出仅供研究，不构成投资建议。
      </p>

      <div className="mt-8 grid w-full max-w-md gap-3">
        {SUGGESTIONS.map((s, idx) => {
          const Icon = s.icon;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => onSuggestionClick?.(s.text)}
              className="flex items-center gap-3 rounded-xl border border-border-subtle bg-elevated/50 px-4 py-3 text-left transition-colors hover:border-border-hover hover:bg-elevated"
            >
              <Icon className="h-5 w-5 text-primary" />
              <span className="text-sm text-foreground">{s.text}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

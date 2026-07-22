"use client";

import { useState } from "react";
import { Sparkles, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";

interface VibeQuickBarProps {
  symbol?: string;
  market?: string;
  interval?: string;
}

export function VibeQuickBar({
  symbol = "BTCUSDT",
  market = "binance",
  interval = "1h",
}: VibeQuickBarProps) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (text?: string) => {
    const trimmed = (text ?? value).trim();
    if (!trimmed || isSubmitting) return;
    setIsSubmitting(true);
    const params = new URLSearchParams({
      prompt: trimmed,
      market,
      symbol,
      interval,
    });
    router.push(`/vibe?${params.toString()}`);
  };

  const handleSuggestionClick = (text: string) => {
    if (isSubmitting) return;
    setValue(text);
    // Auto-submit after a short delay so the user sees the text.
    setTimeout(() => {
      setValue(text);
      handleSubmit(text);
    }, 100);
  };

  const suggestions = [
    `分析 ${symbol} ${interval} 的形态`,
    `${symbol} 现在能做多吗？`,
    `检查 0.5 WU 买 ${symbol} 的风控`,
  ];

  return (
    <section className="glass-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>AI 交易助手</span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleSubmit();
          }}
          placeholder={`问我关于 ${symbol} 的问题...`}
          className="input-surface flex-1"
        />
        <button
          type="button"
          onClick={() => handleSubmit()}
          disabled={!value.trim() || isSubmitting}
          className="btn-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-xl disabled:opacity-60"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            onClick={() => handleSuggestionClick(text)}
            className="rounded-md bg-elevated px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            {text}
          </button>
        ))}
      </div>
    </section>
  );
}

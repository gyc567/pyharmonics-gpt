import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { SignalCard } from "@/components/dashboard/signal-card";
import type { Signal } from "@/types";

const longSignal: Signal = {
  status: "confirmed",
  grade: "A",
  direction: "long",
  pattern_name: "gartley",
  family: "XABCD",
  formed: true,
  entry_zone: [108.5, 112.25],
  entry_reference: 110.0,
  stop_loss: 99.5,
  stop_basis: "X/PRZ invalidation - 0.5*ATR",
  targets: [
    {
      label: "TP1",
      price: 120.5,
      fib_basis: "AD 38.2% retrace",
      close_pct: 50,
      move_stop_to: "breakeven",
    },
    {
      label: "TP2",
      price: 130.75,
      fib_basis: "AD 61.8% retrace",
      close_pct: 30,
      move_stop_to: "tp1",
    },
  ],
  net_rr_tp1: 1.5,
  net_rr_tp2: 2.5,
  confluence_score: 80,
  confluence: { rsi: 15 },
  htf_trend: "bullish",
  invalidation: 99.5,
};

describe("SignalCard", () => {
  it("renders a long A-grade signal with all sections", () => {
    render(<SignalCard signal={longSignal} />);

    expect(screen.getByTestId("signal-card")).toBeInTheDocument();
    expect(screen.getByText("交易信号")).toBeInTheDocument();
    expect(screen.getByText("A 级")).toBeInTheDocument();
    expect(screen.getByText("已确认")).toBeInTheDocument();
    expect(screen.getByText("做多 Long")).toBeInTheDocument();
    expect(screen.getByText(/108\.5/)).toBeInTheDocument();
    expect(screen.getByText(/112\.25/)).toBeInTheDocument();
    expect(screen.getByText("110.00")).toBeInTheDocument();
    expect(screen.getByText("99.50")).toBeInTheDocument();
    expect(screen.getByText(/1\.50R/)).toBeInTheDocument();
    expect(screen.getByText(/2\.50R/)).toBeInTheDocument();
    expect(screen.getAllByText(/TP1/).length).toBeGreaterThan(0);
    expect(screen.getByText(/AD 38\.2% retrace/)).toBeInTheDocument();
    expect(screen.getByText(/平仓 50%/)).toBeInTheDocument();
    expect(screen.getByText("共振评分 80/100")).toBeInTheDocument();
    expect(screen.getByText("高周期趋势 bullish")).toBeInTheDocument();
    expect(screen.getByText(/X\/PRZ invalidation/)).toBeInTheDocument();
  });

  it("renders a short signal with unknown status and grade fallback", () => {
    render(
      <SignalCard
        signal={{
          ...longSignal,
          direction: "short",
          grade: "C",
          status: "custom_state",
          targets: [],
          confluence_score: undefined,
          htf_trend: undefined,
          stop_basis: undefined,
        }}
      />
    );

    expect(screen.getByText("做空 Short")).toBeInTheDocument();
    expect(screen.getByText("C 级")).toBeInTheDocument();
    expect(screen.getByText("custom_state")).toBeInTheDocument();
    expect(screen.queryByText(/阶梯止盈/)).not.toBeInTheDocument();
    expect(screen.queryByText(/共振评分/)).not.toBeInTheDocument();
    expect(screen.queryByText(/高周期趋势/)).not.toBeInTheDocument();
  });

  it("renders B grade badge", () => {
    render(<SignalCard signal={{ ...longSignal, grade: "B", status: "approaching" }} />);
    expect(screen.getByText("B 级")).toBeInTheDocument();
    expect(screen.getByText("接近中")).toBeInTheDocument();
  });

  it("renders unknown grade with default badge", () => {
    render(<SignalCard signal={{ ...longSignal, grade: "Z" }} />);
    expect(screen.getByText("Z 级")).toBeInTheDocument();
  });

  it("renders v4 metadata: regime warning, stability, position multiplier, reasoning", () => {
    render(
      <SignalCard
        signal={{
          ...longSignal,
          regime: "high_quant",
          stability_score: 85,
          position_multiplier: 0.9,
          reasoning: "方向：做多（gartley）\n止损：99.50",
        }}
      />
    );
    expect(screen.getByText("量化冲击 high_quant")).toBeInTheDocument();
    expect(screen.getByText("稳定性 85")).toBeInTheDocument();
    expect(screen.getByText("仓位系数 ×0.9")).toBeInTheDocument();
    expect(screen.getByText("信号理由")).toBeInTheDocument();
    expect(screen.getByText(/方向：做多/)).toBeInTheDocument();
  });

  it("hides regime badge for normal regime and omits reasoning when absent", () => {
    render(
      <SignalCard
        signal={{
          ...longSignal,
          regime: "normal",
          stability_score: undefined,
          position_multiplier: undefined,
          reasoning: undefined,
        }}
      />
    );
    expect(screen.queryByText(/量化冲击/)).not.toBeInTheDocument();
    expect(screen.queryByText(/稳定性/)).not.toBeInTheDocument();
    expect(screen.queryByText(/仓位系数/)).not.toBeInTheDocument();
    expect(screen.queryByText("信号理由")).not.toBeInTheDocument();
  });
});

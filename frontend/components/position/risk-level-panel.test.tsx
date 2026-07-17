import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { RiskLevelPanel } from "./risk-level-panel";
import { DEFAULT_CONFIG, createDefaultBalance } from "@/lib/position/defaults";
import { computeRiskLevel } from "@/lib/position/calculator";

describe("RiskLevelPanel", () => {
  const config = DEFAULT_CONFIG;
  const balance = createDefaultBalance(config);
  const riskLevel = computeRiskLevel(config, balance, 0.5);

  it("renders risk level and table", () => {
    render(
      <RiskLevelPanel
        config={config}
        balance={balance}
        plannedTrade={0.5}
        riskLevel={riskLevel}
        onPlannedTradeChange={() => {}}
      />
    );

    expect(screen.getByText("风控触发等级")).toBeInTheDocument();
    expect(screen.getByText("0 级")).toBeInTheDocument();
  });

  it("calls onPlannedTradeChange", async () => {
    const onChange = vi.fn();
    render(
      <RiskLevelPanel
        config={config}
        balance={balance}
        plannedTrade={0.5}
        riskLevel={riskLevel}
        onPlannedTradeChange={onChange}
      />
    );

    const input = screen.getByLabelText("计划交易金额（WU）");
    fireEvent.change(input, { target: { value: "1" } });

    expect(onChange).toHaveBeenCalledWith(1);
  });

  it("returns null when config or balance is null", () => {
    const { container } = render(
      <RiskLevelPanel
        config={null}
        balance={balance}
        plannedTrade={0.5}
        riskLevel={riskLevel}
        onPlannedTradeChange={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });
});

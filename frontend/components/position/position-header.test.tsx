import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PositionHeader } from "./position-header";
import { DEFAULT_CONFIG, createDefaultBalance } from "@/lib/position/defaults";
import { computeRiskLevel } from "@/lib/position/calculator";

describe("PositionHeader", () => {
  const config = DEFAULT_CONFIG;
  const balance = createDefaultBalance(config);
  const riskLevel = computeRiskLevel(config, balance, 0.5);

  it("renders metric cards", () => {
    render(<PositionHeader config={config} balance={balance} riskLevel={riskLevel} />);

    expect(screen.getByText("总资金")).toBeInTheDocument();
    expect(screen.getAllByText("10,000").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("风控评分")).toBeInTheDocument();
    expect(screen.getByText("当前触发等级")).toBeInTheDocument();
  });

  it("renders medium risk label", () => {
    const mediumRiskLevel = computeRiskLevel(config, balance, 120);
    render(<PositionHeader config={config} balance={balance} riskLevel={mediumRiskLevel} />);
    expect(screen.getByText("中风险")).toBeInTheDocument();
  });

  it("renders high risk label", () => {
    const highRiskLevel = computeRiskLevel(config, balance, 20_000);
    render(<PositionHeader config={config} balance={balance} riskLevel={highRiskLevel} />);
    expect(screen.getByText("高风险")).toBeInTheDocument();
  });

  it("returns null when config is null", () => {
    const { container } = render(<PositionHeader config={null} balance={balance} riskLevel={riskLevel} />);
    expect(container.firstChild).toBeNull();
  });
});

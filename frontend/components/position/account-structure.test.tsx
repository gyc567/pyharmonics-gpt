import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { AccountStructure } from "./account-structure";
import { DEFAULT_CONFIG, createDefaultBalance } from "@/lib/position/defaults";
import { computeBuckets } from "@/lib/position/calculator";

describe("AccountStructure", () => {
  const config = DEFAULT_CONFIG;
  const balance = createDefaultBalance(config);
  const buckets = computeBuckets(config, balance);

  it("renders buckets", () => {
    render(<AccountStructure config={config} buckets={buckets} />);
    expect(screen.getByText("仓位结构 & 账户拆分")).toBeInTheDocument();
    expect(screen.getByText("救命钱")).toBeInTheDocument();
    expect(screen.getByText("BTC 趋势仓")).toBeInTheDocument();
  });

  it("returns null when config is null", () => {
    const { container } = render(<AccountStructure config={null} buckets={buckets} />);
    expect(container.firstChild).toBeNull();
  });

  it("handles empty buckets", () => {
    const { container } = render(<AccountStructure config={config} buckets={[]} />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("handles zero regular capital", () => {
    const zeroConfig = { ...config, totalCapitalWu: 0 };
    const zeroBalance = createDefaultBalance(zeroConfig);
    const zeroBuckets = computeBuckets(zeroConfig, zeroBalance);
    const { container } = render(<AccountStructure config={zeroConfig} buckets={zeroBuckets} />);
    expect(container.firstChild).toBeInTheDocument();
  });
});

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { PositionConfigPanel } from "./position-config-panel";
import { DEFAULT_CONFIG } from "@/lib/position/defaults";
import type { PositionConfig } from "@/types/position";

describe("PositionConfigPanel", () => {
  it("renders form fields", () => {
    render(<PositionConfigPanel config={DEFAULT_CONFIG} onChange={() => {}} />);
    expect(screen.getByText("参数配置")).toBeInTheDocument();
    expect(screen.getByText("救命钱比例")).toBeInTheDocument();
    expect(screen.getByText("BTC 目标比例")).toBeInTheDocument();
  });

  it("returns null when config is null", () => {
    const { container } = render(<PositionConfigPanel config={null} onChange={() => {}} />);
    expect(container.firstChild).toBeNull();
  });

  it("updates total capital", async () => {
    const onChange = vi.fn();
    render(<PositionConfigPanel config={DEFAULT_CONFIG} onChange={onChange} />);

    const input = screen.getByLabelText("总资金（WU）");
    fireEvent.change(input, { target: { value: "5000" } });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0] as (prev: PositionConfig) => PositionConfig;
    expect(updater(DEFAULT_CONFIG).totalCapitalWu).toBe(5000);
  });

  it("applies recommendation", async () => {
    const onChange = vi.fn();
    render(<PositionConfigPanel config={DEFAULT_CONFIG} onChange={onChange} />);

    const button = screen.getByText("小户平衡");
    await userEvent.click(button);

    expect(onChange).toHaveBeenCalled();
  });

  it("updates cut position", async () => {
    const onChange = vi.fn();
    render(<PositionConfigPanel config={DEFAULT_CONFIG} onChange={onChange} />);

    const input = screen.getByLabelText("切割仓位金额（WU）");
    fireEvent.change(input, { target: { value: "500" } });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0] as (prev: PositionConfig) => PositionConfig;
    expect(updater(DEFAULT_CONFIG).cutPositionWu).toBe(500);
  });

  it.each([
    ["救命钱比例", "emergencyRatio", "0.35", 0.35],
    ["BTC 目标比例", "btcRatio", "0.55", 0.55],
    ["山寨币上限比例", "altcoinMaxRatio", "0.25", 0.25],
    ["中账户比例", "midAccountRatio", "0.2", 0.2],
    ["小账户比例", "smallAccountRatio", "0.1", 0.1],
    ["小账户可交易比例", "smallTradableRatio", "0.8", 0.8],
  ])("updates %s via slider", (label, key, value, expected) => {
    const onChange = vi.fn();
    render(<PositionConfigPanel config={DEFAULT_CONFIG} onChange={onChange} />);

    const slider = screen.getByLabelText(label);
    fireEvent.change(slider, { target: { value } });

    expect(onChange).toHaveBeenCalled();
    const updater = onChange.mock.calls[0][0] as (prev: PositionConfig) => PositionConfig;
    expect(updater(DEFAULT_CONFIG)[key as keyof PositionConfig]).toBe(expected);
  });

  it("applies large conservative recommendation", async () => {
    const onChange = vi.fn();
    render(<PositionConfigPanel config={DEFAULT_CONFIG} onChange={onChange} />);

    const button = screen.getByText("大户保守");
    await userEvent.click(button);

    expect(onChange).toHaveBeenCalled();
  });

  it("shows large capital warning", () => {
    const largeConfig = { ...DEFAULT_CONFIG, totalCapitalWu: 200_000 };
    render(<PositionConfigPanel config={largeConfig} onChange={() => {}} />);
    expect(screen.getByText(/大资金模式/)).toBeInTheDocument();
  });
});

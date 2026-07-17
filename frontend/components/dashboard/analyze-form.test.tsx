import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnalyzeForm } from "@/components/dashboard/analyze-form";
import type { AnalyzeRequest, MarketsResponse } from "@/types";

const baseForm: AnalyzeRequest = {
  market: "binance",
  symbol: "BTCUSDT",
  interval: "1h",
  analysis_type: "auto",
  limit_to: 10,
  percent_complete: 0.8,
  candles: 1000,
};

const markets: MarketsResponse = {
  markets: ["binance", "yahoo"],
  intervals: ["15m", "1h", "4h", "1d", "1w"],
  analysis_types: ["forming", "formed", "divergence", "auto"],
};

function renderForm(overrides: Partial<Parameters<typeof AnalyzeForm>[0]> = {}) {
  const props = {
    form: baseForm,
    markets,
    symbols: ["BTCUSDT", "ETHUSDT"],
    loading: false,
    onChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<AnalyzeForm {...props} />);
  return props;
}

describe("AnalyzeForm", () => {
  it("renders auto as the first analysis-type option with correct label", () => {
    renderForm();
    const typeSelect = screen.getAllByRole("combobox")[3];
    const options = Array.from(typeSelect.querySelectorAll("option")).map(
      (o) => o.textContent
    );
    expect(options[0]).toBe("自动设置");
    expect(options).toContain("形成中");
    expect(options).toContain("已形成");
    expect(options).toContain("背离");
    expect(options).not.toContain("auto");
  });

  it("falls back to default options when markets is null", () => {
    renderForm({ markets: null });
    const typeSelect = screen.getAllByRole("combobox")[3];
    const options = Array.from(typeSelect.querySelectorAll("option")).map(
      (o) => o.textContent
    );
    expect(options[0]).toBe("自动设置");
  });

  it("falls back to raw value for unknown analysis type labels", () => {
    renderForm({
      markets: { ...markets, analysis_types: ["auto", "future_type"] },
    });
    expect(screen.getByText("future_type")).toBeInTheDocument();
  });

  it("emits onChange for market, symbol, interval and analysis type", () => {
    const props = renderForm();
    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "yahoo" } });
    expect(props.onChange).toHaveBeenCalledWith("market", "yahoo");
    fireEvent.change(selects[1], { target: { value: "ETHUSDT" } });
    expect(props.onChange).toHaveBeenCalledWith("symbol", "ETHUSDT");
    fireEvent.change(selects[2], { target: { value: "4h" } });
    expect(props.onChange).toHaveBeenCalledWith("interval", "4h");
    fireEvent.change(selects[3], { target: { value: "formed" } });
    expect(props.onChange).toHaveBeenCalledWith("analysis_type", "formed");
  });

  it("shows placeholder option when symbols list is empty", () => {
    renderForm({ symbols: [] });
    expect(screen.getByText("请选择标的")).toBeInTheDocument();
  });

  it("toggles advanced parameters panel", () => {
    renderForm();
    expect(screen.queryByText("限定数量 (limit_to)")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("高级参数"));
    expect(screen.getByText("限定数量 (limit_to)")).toBeInTheDocument();
    expect(screen.getByText("完成度 (percent_complete)")).toBeInTheDocument();
    expect(screen.getByText("蜡烛数量")).toBeInTheDocument();
    fireEvent.click(screen.getByText("高级参数"));
    expect(screen.queryByText("限定数量 (limit_to)")).not.toBeInTheDocument();
  });

  it("emits numeric onChange from advanced inputs", () => {
    const props = renderForm();
    fireEvent.click(screen.getByText("高级参数"));
    fireEvent.change(screen.getByDisplayValue("10"), { target: { value: "20" } });
    expect(props.onChange).toHaveBeenCalledWith("limit_to", 20);
    fireEvent.change(screen.getByDisplayValue("0.8"), { target: { value: "0.9" } });
    expect(props.onChange).toHaveBeenCalledWith("percent_complete", 0.9);
    fireEvent.change(screen.getByDisplayValue("1000"), { target: { value: "2000" } });
    expect(props.onChange).toHaveBeenCalledWith("candles", 2000);
  });

  it("calls onSubmit and shows loading state", () => {
    const props = renderForm();
    fireEvent.click(screen.getByRole("button", { name: "开始分析" }));
    expect(props.onSubmit).toHaveBeenCalledOnce();
  });

  it("disables submit while loading", () => {
    renderForm({ loading: true });
    expect(screen.getByRole("button", { name: /分析中/ })).toBeDisabled();
  });

  it("disables submit when symbol is empty", () => {
    renderForm({ form: { ...baseForm, symbol: "" } });
    expect(screen.getByRole("button", { name: "开始分析" })).toBeDisabled();
  });

  it("disables all inputs when disabled prop is set", () => {
    renderForm({ disabled: true });
    const selects = screen.getAllByRole("combobox");
    selects.forEach((s) => expect(s).toBeDisabled());
  });
});

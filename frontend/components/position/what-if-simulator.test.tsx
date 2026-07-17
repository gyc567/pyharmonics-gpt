import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WhatIfSimulator } from "./what-if-simulator";
import { simulateWhatIf } from "@/lib/position/calculator";
import { DEFAULT_CONFIG, createDefaultBalance } from "@/lib/position/defaults";

describe("WhatIfSimulator", () => {
  const config = DEFAULT_CONFIG;
  const balance = createDefaultBalance(config);
  const whatIf = simulateWhatIf(config, balance, 0.1);

  it("renders simulator and table", () => {
    render(
      <WhatIfSimulator
        actualTrade={0.1}
        whatIf={whatIf}
        touchesEmergency={false}
        onActualTradeChange={() => {}}
        onArchive={() => {}}
      />
    );

    expect(screen.getByText("交易后余额模拟 what-if")).toBeInTheDocument();
    expect(screen.getByText("确认归档并更新余额")).toBeInTheDocument();
  });

  it("calls onActualTradeChange", async () => {
    const onChange = vi.fn();
    render(
      <WhatIfSimulator
        actualTrade={0.1}
        whatIf={whatIf}
        touchesEmergency={false}
        onActualTradeChange={onChange}
        onArchive={() => {}}
      />
    );

    const input = screen.getByLabelText("实际成交金额（WU）");
    fireEvent.change(input, { target: { value: "0.5" } });

    expect(onChange).toHaveBeenCalledWith(0.5);
  });

  it("calls onArchive", async () => {
    const onArchive = vi.fn();
    render(
      <WhatIfSimulator
        actualTrade={0.1}
        whatIf={whatIf}
        touchesEmergency={false}
        onActualTradeChange={() => {}}
        onArchive={onArchive}
      />
    );

    const button = screen.getByText("确认归档并更新余额");
    fireEvent.click(button);

    expect(onArchive).toHaveBeenCalled();
  });

  it("disables archive when touching emergency", () => {
    const emergencyWhatIf = simulateWhatIf(config, balance, 20_000);
    render(
      <WhatIfSimulator
        actualTrade={20_000}
        whatIf={emergencyWhatIf}
        touchesEmergency={true}
        onActualTradeChange={() => {}}
        onArchive={() => {}}
      />
    );

    const button = screen.getByText("确认归档并更新余额");
    expect(button).toBeDisabled();
    expect(screen.getByText(/动用救命钱/)).toBeInTheDocument();
  });
});

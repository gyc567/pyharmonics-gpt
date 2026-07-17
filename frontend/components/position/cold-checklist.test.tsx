import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ColdChecklist } from "./cold-checklist";
import { DEFAULT_CHECKLIST } from "@/lib/position/defaults";

describe("ColdChecklist", () => {
  it("renders checklist items", () => {
    render(<ColdChecklist items={DEFAULT_CHECKLIST} onToggle={() => {}} />);
    expect(screen.getByText("交易前冷静检查清单")).toBeInTheDocument();
    expect(screen.getByText(DEFAULT_CHECKLIST[0].label)).toBeInTheDocument();
  });

  it("calls onToggle when item clicked", async () => {
    const onToggle = vi.fn();
    render(<ColdChecklist items={DEFAULT_CHECKLIST} onToggle={onToggle} />);

    const button = screen.getByText(DEFAULT_CHECKLIST[0].label);
    await userEvent.click(button);

    expect(onToggle).toHaveBeenCalledWith("rationale");
  });

  it("renders checked item styling", () => {
    const checkedItems = DEFAULT_CHECKLIST.map((item, index) => ({
      ...item,
      checked: index === 0,
    }));
    render(<ColdChecklist items={checkedItems} onToggle={() => {}} />);
    expect(screen.getByText(checkedItems[0].label)).toBeInTheDocument();
  });
});

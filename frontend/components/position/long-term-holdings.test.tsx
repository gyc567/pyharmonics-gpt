import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LongTermHoldings } from "./long-term-holdings";
import type { LongTermHolding } from "@/types/position";

describe("LongTermHoldings", () => {
  const holdings: LongTermHolding[] = [
    {
      id: "h1",
      symbol: "BTC",
      entryPrice: 60_000,
      positionWu: 10,
      exitCondition: "100k",
      reviewDate: "2026-12-31",
      createdAt: "2026-01-01",
    },
  ];

  it("renders holdings table", () => {
    render(
      <LongTermHoldings
        holdings={holdings}
        onAdd={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText("BTC")).toBeInTheDocument();
    expect(screen.getByText("100k")).toBeInTheDocument();
  });

  it("renders optional fields fallback", () => {
    const minimalHoldings = [{ id: "h2", symbol: "ETH", positionWu: 5, createdAt: "2026-01-01" }];
    render(
      <LongTermHoldings
        holdings={minimalHoldings}
        onAdd={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText("ETH")).toBeInTheDocument();
    expect(screen.getAllByText("—").length).toBeGreaterThanOrEqual(1);
  });

  it("renders empty state", () => {
    render(
      <LongTermHoldings
        holdings={[]}
        onAdd={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    );
    expect(screen.getByText(/暂无记录/)).toBeInTheDocument();
  });

  it("opens add form", async () => {
    render(
      <LongTermHoldings
        holdings={[]}
        onAdd={() => {}}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    );

    await userEvent.click(screen.getByText("新增记录"));
    expect(screen.getAllByPlaceholderText("标的").length).toBeGreaterThan(0);
  });

  it("calls onDelete", async () => {
    const onDelete = vi.fn();
    render(
      <LongTermHoldings
        holdings={holdings}
        onAdd={() => {}}
        onUpdate={() => {}}
        onDelete={onDelete}
      />
    );

    const deleteButton = screen.getByRole("button", { name: /delete/i });
    await userEvent.click(deleteButton);

    expect(onDelete).toHaveBeenCalledWith("h1");
  });

  it("calls onAdd when form saved", async () => {
    const onAdd = vi.fn();
    render(
      <LongTermHoldings
        holdings={[]}
        onAdd={onAdd}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    );

    await userEvent.click(screen.getByText("新增记录"));
    const symbolInput = screen.getByPlaceholderText("标的");
    await userEvent.type(symbolInput, "ETH");

    const positionInput = screen.getByPlaceholderText("仓位");
    await userEvent.type(positionInput, "5");

    await userEvent.click(screen.getAllByRole("button", { name: /check/i })[0]);

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "ETH", positionWu: 5 })
    );
  });

  it("falls back to defaults when saving empty add form", async () => {
    const onAdd = vi.fn();
    render(
      <LongTermHoldings
        holdings={[]}
        onAdd={onAdd}
        onUpdate={() => {}}
        onDelete={() => {}}
      />
    );

    await userEvent.click(screen.getByText("新增记录"));
    await userEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ symbol: "", positionWu: 0 })
    );
  });

  it("calls onUpdate when editing a holding", async () => {
    const onUpdate = vi.fn();
    render(
      <LongTermHoldings
        holdings={holdings}
        onAdd={() => {}}
        onUpdate={onUpdate}
        onDelete={() => {}}
      />
    );

    const editButton = screen.getByRole("button", { name: /edit/i });
    await userEvent.click(editButton);

    const entryInput = screen.getByPlaceholderText("买入价");
    await userEvent.clear(entryInput);
    await userEvent.type(entryInput, "70000");

    const exitInput = screen.getByPlaceholderText("卖出条件");
    await userEvent.clear(exitInput);
    await userEvent.type(exitInput, "200k");

    const dateInput = screen.getByDisplayValue("2026-12-31");
    fireEvent.change(dateInput, { target: { value: "2027-01-01" } });

    await userEvent.click(screen.getByRole("button", { name: /check/i }));

    expect(onUpdate).toHaveBeenCalledWith(
      "h1",
      expect.objectContaining({
        entryPrice: 70000,
        exitCondition: "200k",
        reviewDate: "2027-01-01",
      })
    );
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

const foreverPending = () => new Promise(() => {});
import { usePosition } from "./use-position";
import { positionDb } from "@/lib/position/db";
import { DEFAULT_CONFIG, createDefaultBalance } from "@/lib/position/defaults";
import type { PositionBalance, PositionConfig } from "@/types/position";

vi.mock("@/lib/position/db", () => ({
  positionDb: {
    loadConfig: vi.fn(),
    saveConfig: vi.fn(),
    loadBalance: vi.fn(),
    saveBalance: vi.fn(),
    listHoldings: vi.fn(),
    createHolding: vi.fn(),
    updateHolding: vi.fn(),
    deleteHolding: vi.fn(),
    logTradeReadiness: vi.fn(),
  },
}));

describe("usePosition", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
  });

  it("initializes with default config when no user", async () => {
    const { result } = renderHook(() => usePosition({}));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
    expect(result.current.balance).toEqual(createDefaultBalance(DEFAULT_CONFIG));
  });

  it("handles unmount while loading", () => {
    vi.mocked(positionDb.loadConfig).mockImplementation(foreverPending);
    vi.mocked(positionDb.loadBalance).mockImplementation(foreverPending);
    vi.mocked(positionDb.listHoldings).mockImplementation(foreverPending);

    const { unmount } = renderHook(() => usePosition({ userId: "user-1" }));
    unmount();
  });

  it("does not persist operations when no user", async () => {
    const { result } = renderHook(() => usePosition({}));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig((prev) => ({ ...prev, totalCapitalWu: 2000 }));
    });

    await act(async () => {
      await result.current.addHolding({ symbol: "BTC", positionWu: 1 });
      await result.current.updateHolding("h1", { positionWu: 2 });
      await result.current.deleteHolding("h1");
      await result.current.archiveWhatIf();
    });

    expect(positionDb.saveConfig).not.toHaveBeenCalled();
    expect(positionDb.saveBalance).not.toHaveBeenCalled();
    expect(positionDb.createHolding).not.toHaveBeenCalled();
    expect(positionDb.updateHolding).not.toHaveBeenCalled();
    expect(positionDb.deleteHolding).not.toHaveBeenCalled();
  });

  it("handles updateConfig before config loads", async () => {
    vi.mocked(positionDb.loadConfig).mockResolvedValue(null);
    vi.mocked(positionDb.loadBalance).mockResolvedValue(null);
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);

    const { result } = renderHook(() => usePosition({ userId: "user-1" }));

    act(() => {
      result.current.updateConfig((prev) => ({ ...prev, totalCapitalWu: 2000 }));
    });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.config).toEqual(DEFAULT_CONFIG);
  });

  it("loads saved config and balance for user", async () => {
    const savedConfig: PositionConfig = { ...DEFAULT_CONFIG, totalCapitalWu: 5000 };
    const savedBalance = createDefaultBalance(savedConfig);
    vi.mocked(positionDb.loadConfig).mockResolvedValue(savedConfig);
    vi.mocked(positionDb.loadBalance).mockResolvedValue(savedBalance);
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);

    const { result } = renderHook(() => usePosition({ userId: "user-1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.config).toEqual(savedConfig);
    expect(result.current.balance).toEqual(savedBalance);
  });

  it("computes buckets, risk level, validation, diagnostics, what-if", async () => {
    const { result } = renderHook(() => usePosition({}));
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.buckets).toHaveLength(5);
    expect(result.current.riskLevel.level).toBe(0);
    expect(result.current.validation).toHaveLength(4);
    expect(result.current.validation.every((v) => v.passed)).toBe(true);
    expect(result.current.whatIf.remainingTotalWu).toBeGreaterThan(0);
  });

  it("updates config and recalculates balance", async () => {
    vi.mocked(positionDb.saveConfig).mockResolvedValue(undefined);
    vi.mocked(positionDb.saveBalance).mockResolvedValue(undefined);
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);

    const { result } = renderHook(() => usePosition({ userId: "user-1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.updateConfig((prev) => ({ ...prev, totalCapitalWu: 2000 }));
    });

    await waitFor(() => expect(result.current.config?.totalCapitalWu).toBe(2000));
    expect(result.current.balance?.emergencyWu).toBe(600);
  });

  it("toggles checklist items", async () => {
    const { result } = renderHook(() => usePosition({}));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.toggleChecklist("rationale");
    });

    expect(result.current.checklist[0].checked).toBe(true);
    expect(result.current.allChecked).toBe(false);
  });

  it("archives what-if result", async () => {
    vi.mocked(positionDb.saveBalance).mockResolvedValue(undefined);
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);

    const { result } = renderHook(() => usePosition({ userId: "user-1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setActualTrade(0.1);
    });

    await act(async () => {
      await result.current.archiveWhatIf();
    });

    expect(result.current.balance?.smallTradableWu).toBe(69.9);
  });

  it("does not archive when touching emergency", async () => {
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);

    const { result } = renderHook(() => usePosition({ userId: "user-1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setActualTrade(20_000);
    });

    await act(async () => {
      await result.current.archiveWhatIf();
    });

    expect(result.current.balance?.smallTradableWu).toBe(70);
  });

  it("manages holdings", async () => {
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);
    vi.mocked(positionDb.createHolding).mockImplementation(async (_userId, holding) => ({
      id: holding.symbol === "BTC" ? "h1" : "h2",
      symbol: holding.symbol,
      positionWu: holding.positionWu ?? 0,
      createdAt: "2026-01-01",
    }));

    const { result } = renderHook(() => usePosition({ userId: "user-1" }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addHolding({ symbol: "BTC", positionWu: 1 });
    });

    expect(result.current.holdings).toHaveLength(1);

    vi.mocked(positionDb.updateHolding).mockResolvedValue({
      id: "h1",
      symbol: "BTC",
      positionWu: 2,
      createdAt: "2026-01-01",
    });

    await act(async () => {
      await result.current.addHolding({ symbol: "ETH", positionWu: 5 });
    });

    expect(result.current.holdings).toHaveLength(2);

    await act(async () => {
      await result.current.updateHolding("h1", { positionWu: 2 });
    });

    expect(result.current.holdings.find((h) => h.id === "h1")?.positionWu).toBe(2);

    vi.mocked(positionDb.deleteHolding).mockResolvedValue(undefined);

    await act(async () => {
      await result.current.deleteHolding("h1");
    });

    expect(result.current.holdings).toHaveLength(1);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import PositionPage from "./page";
import { useAuth } from "@/hooks/use-auth";
import { positionDb } from "@/lib/position/db";
import { useSearchParams } from "next/navigation";

vi.mock("@/hooks/use-auth", () => ({
  useAuth: vi.fn(),
}));

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

const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: vi.fn(() => new URLSearchParams()),
}));

describe("PositionPage", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    window.localStorage.clear();
  });

  it("redirects to login when not authenticated", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      loading: false,
    } as ReturnType<typeof useAuth>);

    render(<PositionPage />);

    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith("/login"));
  });

  it("renders page when authenticated", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(positionDb.loadConfig).mockResolvedValue(null);
    vi.mocked(positionDb.loadBalance).mockResolvedValue(null);
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);

    render(<PositionPage />);

    await waitFor(() => {
      expect(screen.getByText("仓位管理")).toBeInTheDocument();
    });
    expect(screen.getByText("参数配置")).toBeInTheDocument();
    expect(screen.getByText("风控触发等级")).toBeInTheDocument();
  });

  it("reads planned trade from search params", async () => {
    vi.mocked(useSearchParams).mockReturnValue(new URLSearchParams("size=2"));
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(positionDb.loadConfig).mockResolvedValue(null);
    vi.mocked(positionDb.loadBalance).mockResolvedValue(null);
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);

    render(<PositionPage />);

    await waitFor(() => {
      expect(screen.getByText("仓位管理")).toBeInTheDocument();
    });
  });

  it("shows saving indicator and checklist pass state", async () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { id: "user-1", email: "test@example.com" },
      loading: false,
    } as unknown as ReturnType<typeof useAuth>);

    vi.mocked(positionDb.loadConfig).mockResolvedValue(null);
    vi.mocked(positionDb.loadBalance).mockResolvedValue(null);
    vi.mocked(positionDb.listHoldings).mockResolvedValue([]);
    vi.mocked(positionDb.saveConfig).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200))
    );
    vi.mocked(positionDb.saveBalance).mockImplementation(
      () => new Promise((resolve) => setTimeout(resolve, 200))
    );

    render(<PositionPage />);

    await waitFor(() => {
      expect(screen.getByText("仓位管理")).toBeInTheDocument();
    });

    const inputs = screen.getAllByLabelText("救命钱比例 数值");
    await userEvent.clear(inputs[0]);
    await userEvent.type(inputs[0], "35");

    expect(screen.queryByText("保存中...")).toBeInTheDocument();

    const checklistItems = [
      "写下买入理由与卖出条件（任何交易前必做）",
      "确认这不是被 KOL / 社群情绪推动的 FOMO",
      "计划金额在风控等级可接受范围内",
      "已检查账户余额，不会动用救命钱",
    ];
    for (const label of checklistItems) {
      await userEvent.click(screen.getByText(label));
    }

    await waitFor(() => {
      expect(screen.getByText("风控与清单检查通过，可前往分析或下单")).toBeInTheDocument();
    });
  });
});

import { test, expect } from "@playwright/test";
import {
  enableE2EAuth,
  mockVibeSession,
  mockVibeMessageAndEvents,
} from "./helpers";

test.describe("vibe features", () => {
  test("renders backtest result card with metrics", async ({ page, context }) => {
    await enableE2EAuth(context);
    await mockVibeSession(page);

    // Message send returns a running run.
    await page.route("/api/vibe/sessions/*/messages", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { run_id: "e2e-backtest-run", status: "running" },
          }),
        });
        return;
      }
      await route.fallback();
    });

    // Events poll returns a backtest card.
    await page.route("/api/vibe/runs/e2e-backtest-run/events*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            run_id: "e2e-backtest-run",
            status: "completed",
            events: [
              {
                event_id: "evt-bt-1",
                run_id: "e2e-backtest-run",
                type: "delta",
                content: "已完成 BTCUSDT 1h 信号回测。",
              },
              {
                event_id: "evt-bt-2",
                run_id: "e2e-backtest-run",
                type: "card",
                card_type: "backtest",
                payload: {
                  schema_version: "backtest_signal_output_v1",
                  status: "completed",
                  market: "binance",
                  symbol: "BTCUSDT",
                  interval: "1h",
                  direction: "long",
                  lookback_days: 90,
                  start_date: "2026-04-01T00:00:00+00:00",
                  end_date: "2026-06-30T00:00:00+00:00",
                  total_signals: 12,
                  win_count: 7,
                  loss_count: 5,
                  win_rate: 0.5833,
                  avg_rr: 1.85,
                  profit_factor: 2.14,
                  max_drawdown: 2.3,
                  note: "简化回测，未考虑滑点、手续费。",
                },
              },
              { event_id: "evt-bt-3", run_id: "e2e-backtest-run", type: "done" },
            ],
            has_more: false,
          },
        }),
      });
    });

    await page.goto("/vibe");
    await page.fill(
      '[placeholder*="问我任何关于交易分析的问题"]',
      "回测 BTCUSDT 1h 做多信号"
    );
    await page.click('button[aria-label="发送"]', { timeout: 5_000 });

    // Backtest card should appear with key metrics.
    await expect(page.getByText("回测结果").first()).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("BTCUSDT 1h (90 天)").first()).toBeVisible();
    await expect(page.getByText("12").first()).toBeVisible(); // total_signals
    await expect(page.getByText("58.33%").first()).toBeVisible(); // win_rate
    await expect(page.getByText("1.85").first()).toBeVisible(); // avg_rr
    await expect(page.getByText("2.14").first()).toBeVisible(); // profit_factor
  });

  test("stop button cancels a running vibe run", async ({ page, context }) => {
    await enableE2EAuth(context);
    await mockVibeSession(page);

    let deleteCalled = false;

    // Keep the run in running state so the stop button is shown.
    await page.route("/api/vibe/sessions/*/messages", async (route) => {
      if (route.request().method() === "POST") {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { run_id: "e2e-cancel-run", status: "running" },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.route("/api/vibe/runs/e2e-cancel-run/events*", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            run_id: "e2e-cancel-run",
            status: "running",
            events: [{ event_id: "evt-c-1", run_id: "e2e-cancel-run", type: "run_started" }],
            has_more: false,
          },
        }),
      });
    });

    await page.route("/api/vibe/runs/e2e-cancel-run", async (route) => {
      if (route.request().method() === "DELETE") {
        deleteCalled = true;
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            success: true,
            data: { run_id: "e2e-cancel-run", status: "cancelled" },
          }),
        });
        return;
      }
      await route.fallback();
    });

    await page.goto("/vibe");
    await page.fill(
      '[placeholder*="问我任何关于交易分析的问题"]',
      "分析 BTCUSDT 1h"
    );
    await page.click('button[aria-label="发送"]', { timeout: 5_000 });

    // Stop button should appear while running.
    const stopButton = page.locator('button[aria-label="停止"]');
    await expect(stopButton).toBeVisible({ timeout: 10_000 });
    await stopButton.click();

    await expect.poll(() => deleteCalled).toBe(true);
  });
});

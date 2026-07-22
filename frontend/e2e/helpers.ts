import type { Page, BrowserContext } from "@playwright/test";

export async function enableE2EAuth(context: BrowserContext) {
  await context.addInitScript(() => {
    window.localStorage.setItem("pyharmonics:e2e-auth", "true");
  });
}

export function mockSupabaseOtp(page: Page) {
  return page.route(
    (url) => url.toString().includes("/auth/v1/otp"),
    async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({}),
      });
    }
  );
}

export function mockAnalyzeSuccess(page: Page, overrides: Record<string, unknown> = {}) {
  return page.route("/api/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          analysis_id: "e2e-analysis-1",
          status: "completed",
          market: "binance",
          symbol: "BTCUSDT",
          interval: "1h",
          analysis_type: "forming",
          parameters: {},
          technical_result: {
            direction: "bullish",
            pattern_family: "XABCD",
            pattern_type: "gartley",
            confidence: 0.82,
            risk_reward_ratio: 2.5,
            entry_price: 65000,
            stop_loss: 64000,
            target_price: 67500,
            resolved_type: "formed",
            signal: {
              status: "confirmed",
              grade: "A",
              direction: "long",
              pattern_name: "gartley",
              family: "XABCD",
              formed: true,
              entry_zone: [64800, 65200],
              entry_reference: 65000,
              stop_loss: 64000,
              stop_basis: "X/PRZ invalidation - 0.5*ATR",
              targets: [
                { label: "TP1", price: 66200, fib_basis: "AD 38.2% retrace", close_pct: 50, move_stop_to: "breakeven" },
                { label: "TP2", price: 67500, fib_basis: "AD 61.8% retrace", close_pct: 30, move_stop_to: "tp1" },
                { label: "TP3", price: 71000, fib_basis: "AD 127.2% extension", close_pct: 20, move_stop_to: "trail 1*ATR" },
              ],
              net_rr_tp1: 1.2,
              net_rr_tp2: 2.5,
              confluence_score: 80,
              confluence: { price_action: 25, htf_trend: 25, rsi: 15 },
              htf_trend: "bullish",
              invalidation: 64000,
            },
          },
          interpretation: {
            summary: "形态完成度较高，建议关注突破确认。",
          },
          chart: {
            url: "/api/charts/e2e-chart.png",
          },
          timing: {
            duration_ms: 1250,
          },
          ...overrides,
        },
      }),
    });
  });
}

export function mockAnalyzeNoResult(page: Page) {
  return page.route("/api/analyze", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          analysis_id: "e2e-analysis-none",
          status: "no_result",
          market: "binance",
          symbol: "BTCUSDT",
          interval: "1h",
          analysis_type: "forming",
          parameters: {},
          technical_result: {},
          interpretation: { summary: "未检测到明显形态。" },
          chart: {},
          timing: { duration_ms: 800 },
        },
      }),
    });
  });
}

export function mockAnalyzeError(page: Page) {
  return page.route("/api/analyze", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: {
          code: "MARKET_DATA_ERROR",
          message: "无法获取市场数据",
          retryable: true,
          request_id: "e2e-req-1",
        },
      }),
    });
  });
}

// 1x1 transparent PNG for chart-img assertions
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64"
);

export function mockChartImage(page: Page) {
  return page.route("/api/charts/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "image/png",
      body: TINY_PNG,
    });
  });
}

export function mockHistoryEmpty(page: Page) {
  return page.route("/api/history", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: { items: [], total: 0 },
      }),
    });
  });
}

export function mockVibeSession(page: Page) {
  return page.route("/api/vibe/sessions", async (route) => {
    if (route.request().method() !== "POST") {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          id: "e2e-vibe-session",
          user_id: "e2e-test-user",
          title: null,
          status: "active",
          context: { default_market: "binance", default_symbol: "BTCUSDT" },
          message_count: 0,
          last_message_at: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      }),
    });
  });
}

export function mockVibeMessageAndEvents(page: Page) {
  // Intercept message send and events poll.
  return page.route("/api/vibe/sessions/*/messages", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: { run_id: "e2e-vibe-run", status: "running" },
        }),
      });
      return;
    }
    await route.fallback();
  });
}

export function mockVibeEvents(page: Page) {
  let callCount = 0;
  return page.route("/api/vibe/runs/e2e-vibe-run/events*", async (route) => {
    callCount += 1;
    if (callCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: {
            run_id: "e2e-vibe-run",
            status: "running",
            events: [
              { event_id: "evt-1", run_id: "e2e-vibe-run", type: "run_started" },
              {
                event_id: "evt-2",
                run_id: "e2e-vibe-run",
                type: "tool_call_start",
                call_id: "call-1",
                tool: "analyze_harmonic",
                input: { symbol: "BTCUSDT", interval: "1h" },
              },
              {
                event_id: "evt-3",
                run_id: "e2e-vibe-run",
                type: "tool_call_end",
                call_id: "call-1",
                tool: "analyze_harmonic",
                output: {
                  status: "completed",
                  schema_version: "analyze_harmonic_output_v1",
                  symbol: "BTCUSDT",
                  direction: "bullish",
                  pattern_type: "gartley",
                  entry_price: 67500,
                  stop_loss: 66800,
                  target_price: 69000,
                  risk_reward_ratio: 2.14,
                },
              },
            ],
            has_more: true,
          },
        }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          run_id: "e2e-vibe-run",
          status: "completed",
          events: [
            {
              event_id: "evt-4",
              run_id: "e2e-vibe-run",
              type: "delta",
              content: "从技术面看，BTCUSDT 1h 形成一个看涨的 Gartley 形态，",
            },
            {
              event_id: "evt-5",
              run_id: "e2e-vibe-run",
              type: "delta",
              content: "入场区约 67500，止损 66800，目标 69000，风险收益比 2.14。",
            },
            {
              event_id: "evt-6",
              run_id: "e2e-vibe-run",
              type: "card",
              card_type: "signal",
              payload: {
                status: "confirmed",
                grade: "B",
                direction: "long",
                pattern_name: "gartley",
                family: "gartley",
                formed: true,
                entry_zone: [67400, 67600],
                entry_reference: 67500,
                stop_loss: 66800,
                stop_basis: "X 点下方",
                targets: [
                  { label: "TP1", price: 68200, fib_basis: "0.618AB", close_pct: 50 },
                  { label: "TP2", price: 69000, fib_basis: "1.272AD", close_pct: 50 },
                ],
                net_rr_tp1: 1.07,
                net_rr_tp2: 2.14,
                confluence_score: 72,
                htf_trend: "bullish",
                reasoning: "1h 级别形成标准 Gartley，D 点落在 0.786XA 回调区。",
              },
            },
            { event_id: "evt-7", run_id: "e2e-vibe-run", type: "done" },
          ],
          has_more: false,
        },
      }),
    });
  });
}

export function mockAnalysisDetail(page: Page) {
  return page.route("/api/analysis/**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        data: {
          analysis_id: "e2e-analysis-1",
          status: "completed",
          market: "binance",
          symbol: "BTCUSDT",
          interval: "1h",
          analysis_type: "forming",
          parameters: {},
          technical_result: { direction: "bullish" },
          interpretation: { summary: "详情页摘要" },
          chart: { url: "https://via.placeholder.com/640x360?text=Chart" },
          timing: { duration_ms: 1000 },
        },
      }),
    });
  });
}

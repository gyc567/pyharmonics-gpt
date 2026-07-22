import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import {
  enableE2EAuth,
  mockVibeSession,
  mockVibeMessageAndEvents,
  mockVibeEvents,
} from "./helpers";

test.describe("vibe screenshots", () => {
  test("capture welcome and conversation", async ({ page, context }, testInfo) => {
    const reportDir = path.join(process.cwd(), "e2e-report");
    fs.mkdirSync(reportDir, { recursive: true });
    await enableE2EAuth(context);
    await mockVibeSession(page);
    await mockVibeMessageAndEvents(page);
    await mockVibeEvents(page);

    // 1. Dashboard with quick bar
    await page.goto("/dashboard");
    await expect(
      page.locator("section").filter({ hasText: "AI 交易助手" })
    ).toBeVisible();
    const dashboardPath = testInfo.outputPath("vibe-dashboard-quickbar.png");
    await page.screenshot({ path: dashboardPath, fullPage: false });
    fs.copyFileSync(dashboardPath, path.join(reportDir, "vibe-dashboard-quickbar.png"));

    // 2. Vibe welcome page
    await page.goto("/vibe");
    await expect(page.locator("main h2").getByText("AI 交易助手")).toBeVisible();
    const welcomePath = testInfo.outputPath("vibe-welcome.png");
    await page.screenshot({ path: welcomePath, fullPage: false });
    fs.copyFileSync(welcomePath, path.join(reportDir, "vibe-welcome.png"));

    // 3. Send a message and wait for mock response
    await page.fill(
      '[placeholder*="问我任何关于交易分析的问题"]',
      "分析 BTCUSDT 1h 的形成中形态"
    );
    await page.click('button[aria-label="发送"]', { timeout: 5_000 });

    await expect(page.getByText("analyze_harmonic")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("B 级").first()).toBeVisible({ timeout: 10_000 });

    await page.waitForTimeout(500);

    const conversationPath = testInfo.outputPath("vibe-conversation.png");
    await page.screenshot({ path: conversationPath, fullPage: true });
    fs.copyFileSync(conversationPath, path.join(reportDir, "vibe-conversation.png"));
  });
});

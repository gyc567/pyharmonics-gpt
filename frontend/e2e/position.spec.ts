import { test, expect } from "@playwright/test";
import { enableE2EAuth } from "./helpers";

test.describe("仓位管理 (已登录)", () => {
  test.beforeEach(async ({ page, context }) => {
    await enableE2EAuth(context);
    await page.goto("/position");
  });

  test("应展示仓位管理标题与参数配置", async ({ page }) => {
    await expect(page.locator("main h1").filter({ hasText: "仓位管理" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "参数配置" })).toBeVisible();
    await expect(page.locator("#totalCapital")).toBeVisible();
  });

  test("修改总资金后指标卡应联动更新", async ({ page }) => {
    const input = page.locator("#totalCapital");
    await input.fill("200000");
    await input.press("Tab");

    // 200,000 U -> 20 WU
    await expect(page.getByText("200,000 U").first()).toBeVisible();
  });

  test("输入资金后账户结构应联动更新", async ({ page }) => {
    const input = page.locator("#totalCapital");
    await input.fill("50000");
    await input.press("Tab");

    // 50,000 U -> 5 WU; emergency 30% = 15,000 U
    await expect(page.getByText("15,000 U").first()).toBeVisible();
  });

  test("预设方案按钮应可点击", async ({ page }) => {
    await page.getByRole("button", { name: "小户平衡" }).click();
    await expect(page.locator("main").getByText("常规管理资金").first()).toBeVisible();
  });
});

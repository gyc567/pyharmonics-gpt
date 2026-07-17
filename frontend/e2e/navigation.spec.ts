import { test, expect } from "@playwright/test";
import { enableE2EAuth, mockHistoryEmpty } from "./helpers";

test.describe("侧边栏导航 (已登录)", () => {
  test.beforeEach(async ({ page, context }) => {
    await enableE2EAuth(context);
    await mockHistoryEmpty(page);
    await page.goto("/dashboard");
  });

  test("应能在各主要页面间导航", async ({ page }) => {
    await expect(page.locator("h1").filter({ hasText: "分析工作台" })).toBeVisible();

    await page.getByRole("link", { name: "仓位" }).click();
    await page.waitForURL("/position");
    await expect(page.locator("main h1").filter({ hasText: "仓位管理" })).toBeVisible();

    await page.getByRole("link", { name: "历史记录" }).click();
    await page.waitForURL("/history");
    await expect(page.locator("main h2").filter({ hasText: "历史记录" })).toBeVisible();

    await page.getByRole("link", { name: "设置" }).click();
    await page.waitForURL("/settings");
    await expect(page.locator("main h2").filter({ hasText: "账户设置" })).toBeVisible();

    await page.getByRole("link", { name: "分析" }).click();
    await page.waitForURL("/dashboard");
    await expect(page.locator("h1").filter({ hasText: "分析工作台" })).toBeVisible();
  });

  test("普通用户不应看到管理员入口，访问 /admin 应被重定向", async ({ page }) => {
    await expect(page.getByRole("link", { name: "管理员" })).not.toBeVisible();

    await page.goto("/admin");
    await page.waitForURL("/dashboard");
    await expect(page).toHaveURL(/\/dashboard$/);
  });
});

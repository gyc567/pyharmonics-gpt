import { test, expect } from "@playwright/test";
import { enableE2EAuth, mockHistoryEmpty } from "./helpers";

test.describe("主题切换", () => {
  test.beforeEach(async ({ page, context }) => {
    await enableE2EAuth(context);
    await mockHistoryEmpty(page);
    await page.goto("/dashboard");
  });

  test("应能切换浅色/深色主题", async ({ page }) => {
    const html = page.locator("html");

    await page.getByRole("button", { name: "深色" }).click();
    await expect(html).toHaveClass(/dark/);

    await page.getByRole("button", { name: "浅色" }).click();
    await expect(html).toHaveClass(/light/);

    await page.getByRole("button", { name: "跟随系统" }).click();
    // system 会解析为当前系统主题，至少不应再是明确的 dark/light 类保留？
    // 实际上 applyTheme 会添加 light/dark 中解析后的一个
    await expect(html).toHaveClass(/light|dark/);
  });
});

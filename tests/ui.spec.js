import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { pool } from "../server/db.js";
import { normalizeBasePath } from "../shared/paths.js";
const prefix = normalizeBasePath(process.env.TEST_APP_BASE_PATH);
const screenshots =
  process.env.QA_SCREENSHOT_DIR ||
  process.env.TEMP + "/questionnaire-screenshots";
test("owner and reviewer can complete the browser workflow", async ({
  page,
  browser,
}) => {
  const email = `ui-${randomUUID()}@example.com`,
    errors = [];
  let userId, reviewContext;
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type()))
      errors.push(`${message.text()} ${message.location().url}`);
  });
  try {
    await page.goto(prefix + "/");
    await expect(page).toHaveTitle("问序 · 问卷编辑与审阅");
    await page.getByRole("button", { name: "注册账号", exact: true }).click();
    await page.getByLabel("姓名", { exact: true }).fill("林晓");
    await page.getByLabel("邮箱", { exact: true }).fill(email);
    await page.getByLabel("密码", { exact: true }).fill("Test-only-1234");
    await page.getByRole("button", { name: "创建账号", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "我的问卷", exact: true }),
    ).toBeVisible();
    userId = (await (await page.request.get(prefix + "/api/auth/me")).json())
      .user.id;
    await page
      .getByRole("button", { name: "新建问卷", exact: true })
      .first()
      .click();
    await page.getByLabel("问卷名称").fill("用户体验调研");
    await page.getByRole("button", { name: "创建并开始编辑" }).click();
    await expect(page.getByLabel("问卷标题", { exact: true })).toHaveValue(
      "用户体验调研",
    );
    expect(new URL(page.url()).pathname).toMatch(
      new RegExp(`^${prefix}/surveys/`),
    );
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForLoadState("networkidle");
    await expect(page.getByLabel("问卷标题", { exact: true })).toHaveValue(
      "用户体验调研",
    );
    await page.getByLabel("问题 1 标题", { exact: true }).fill("第三部分：AI 工具付费经历｜Q11. 你目前属于以下哪种情况？");
    await expect(page.getByLabel("问题 1 前的分区标题")).toHaveValue("第三部分：AI 工具付费经历");
    await expect(page.getByLabel("问题 1 标题", { exact: true })).toHaveValue("Q11. 你目前属于以下哪种情况？");
    await page.getByLabel("问题 1 前的分区标题").fill("第三部分：付费经历");
    await page
      .getByRole("button", { name: "添加问题", exact: true })
      .first()
      .click();
    await page
      .getByLabel("问题 2 标题", { exact: true })
      .fill("您最关注哪些方面？");
    await page
      .getByLabel("问题 2 题型", { exact: true })
      .selectOption("multiple");
    await page
      .getByLabel("问题 2 选项 1", { exact: true })
      .fill("功能的实用性");
    await page
      .getByLabel("问题 2 选项 2", { exact: true })
      .fill("操作的便捷性");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByText(/已保存 · 修订 2/)).toBeVisible();
    await page.getByRole("button", { name: "审阅链接", exact: true }).click();
    await page.getByRole("button", { name: "生成审阅链接" }).click();
    const link = await page
      .getByRole("textbox", { name: "审阅链接", exact: true })
      .inputValue();
    expect(new URL(link).pathname).toMatch(new RegExp(`^${prefix}/review/`));
    await page.getByRole("button", { name: "关闭弹窗" }).click();
    reviewContext = await browser.newContext({
      viewport: { width: 1400, height: 1000 },
    });
    const reviewer = await reviewContext.newPage();
    reviewer.on("pageerror", (e) => errors.push(e.message));
    await reviewer.goto(link);
    await expect(reviewer.getByText("只能批注，不可修改")).toBeVisible();
    await expect(reviewer.getByRole("heading", { name: "第三部分：付费经历", exact: true })).toBeVisible();
    await expect(reviewer.locator(".question-header h3").first()).toHaveText("Q11. 你目前属于以下哪种情况？*");
    await expect(
      reviewer.getByRole("button", { name: "保存", exact: true }),
    ).toHaveCount(0);
    await reviewer
      .getByRole("button", { name: "批注问题 1", exact: true })
      .click();
    await reviewer.getByRole("textbox", { name: "访客姓名" }).fill("陈雨");
    await reviewer
      .getByRole("textbox", { name: "批注内容" })
      .fill("建议明确最近一个月的使用频率。");
    await reviewer.getByRole("button", { name: "发表批注" }).click();
    await expect(
      reviewer.getByText("建议明确最近一个月的使用频率。", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByText("建议明确最近一个月的使用频率。", { exact: true }),
    ).toBeVisible({ timeout: 10000 });
    await mkdir(screenshots, { recursive: true });
    await page.locator(".document-panel").evaluate((el) => (el.scrollTop = 0));
    await page
      .getByRole("button", { name: "关闭提示" })
      .click()
      .catch(() => {});
    await page.screenshot({ path: screenshots + "/editor-desktop.png" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(".document-panel").evaluate((el) => (el.scrollTop = 0));
    await page.screenshot({ path: screenshots + "/editor-mobile.png" });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.getByRole("button", { name: "切换批注面板" }).click();
    await expect(
      page.getByRole("heading", { name: "批注与讨论" }),
    ).toBeVisible();
    await page.screenshot({ path: screenshots + "/comments-mobile.png" });
    await page.setViewportSize({ width: 1536, height: 1024 });
    await page.getByRole("button", { name: "回复", exact: true }).click();
    await page
      .getByRole("textbox", { name: "批注内容" })
      .fill("收到，已核对该问题。");
    await page.getByRole("button", { name: "发表回复" }).click();
    await expect(
      page.locator(".reply").getByText("收到，已核对该问题。", { exact: true }),
    ).toBeVisible();
    await page.getByRole("button", { name: "标记解决" }).click();
    await page.getByRole("button", { name: "定稿导出" }).click();
    await page.getByRole("button", { name: "确认定稿", exact: true }).click();
    await expect(page.getByRole("heading", { name: "定稿 V1" })).toBeVisible();
    await page.getByRole("button", { name: "生成导入文本" }).click();
    await expect(page.getByRole("textbox", { name: "导入文本" })).toContainText(
      "用户体验调研",
    );
    await expect(page.getByText("导入兼容性提示")).toBeVisible();
    await page.getByRole("button", { name: "关闭弹窗" }).click();
    await reviewer.reload();
    await expect(
      reviewer.getByRole("heading", { name: "审阅链接无效或已撤销" }),
    ).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await reviewContext?.close();
    if (userId) {
      const { rows } = await pool.query(
        "SELECT id FROM qs_surveys WHERE owner_id=$1",
        [userId],
      );
      const ids = rows.map((s) => s.id);
      if (ids.length) {
        await pool.query(
          "DELETE FROM qs_comments WHERE survey_id=ANY($1::uuid[])",
          [ids],
        );
        await pool.query("DELETE FROM qs_surveys WHERE id=ANY($1::uuid[])", [
          ids,
        ]);
      }
      await pool.query("DELETE FROM qs_sessions WHERE sess->'user'->>'id'=$1", [
        userId,
      ]);
      await pool.query("DELETE FROM qs_users WHERE id=$1", [userId]);
    }
    await pool.end();
  }
});

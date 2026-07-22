# 测试报告：仓位管理“自定义总资金（U）”

## 1. 实施范围

按 `docs/plans/position-custom-capital-plan.md` 实施，仅改动输入层与测试层：

- **新增** `frontend/lib/position/capital.ts` — U/WU 纯函数转换层。
- **新增** `frontend/lib/position/capital.test.ts` — 纯函数全分支单测。
- **修改** `frontend/components/position/position-config-panel.tsx` — 总资金输入改为 U 单位、非受控 + key 重挂载、blur/Enter 提交、错误/小额提示。
- **修改** `frontend/components/position/position-config-panel.test.tsx` — 更新 1 个既有用例，新增 7 个交互用例（保留全部既有用例）。
- **修改** `frontend/e2e/position.spec.ts` — 更新现有联动用例为 U 输入 + Tab，新增 1 条账户结构联动用例。

数据模型、持久化格式、下游计算逻辑均保持不变。

## 2. 测试结果

### 2.1 前端单元测试（vitest）

```bash
cd frontend && npm run test:coverage
```

- **测试文件**：21 passed
- **测试用例**：185 passed
- **覆盖率**：100% / 100% / 100% / 100%（statements / branches / functions / lines）
- **新增文件 `capital.ts` 与 `capital.test.ts`**：20 个用例，100% 覆盖。
- **修改文件 `position-config-panel.tsx`**：19 个用例（原 8 个 + 新增 7 个 + 既有用例更新），100% 覆盖。

### 2.2 前端 E2E 测试（Playwright）

```bash
cd frontend && npx playwright test
```

- **测试文件**：5 spec 文件
- **测试用例**：20 passed（含仓位管理 4 条用例）
- **新增用例**：`输入资金后账户结构应联动更新` 通过。
- **更新用例**：`修改总资金后指标卡应联动更新` 已适配 U 输入 + Tab 提交。

### 2.3 Python 后端测试

```bash
pytest -q
```

- **结果**：372 passed，2 skipped，41 errors
- **说明**：41 个 ERROR 全部为测试初始化阶段的 `werkzeug` 版本兼容问题：`AttributeError: module 'werkzeug' has no attribute '__version__'`。该问题发生在 `app.test_client()` 构造时，与本次改动无关，且在本次改动前已存在（工作目录内另有未提交的 chart-rendering 相关改动同样受此影响）。

## 3. 新增/修改文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `frontend/lib/position/capital.ts` | 新增 | `parseCapitalInput` / `formatWuAsU` 纯函数 |
| `frontend/lib/position/capital.test.ts` | 新增 | 合法/空/NaN/0/负数/超上限/边界/小额提示/WU↔U 往返 |
| `frontend/components/position/position-config-panel.tsx` | 修改 | U 单位非受控输入、blur/Enter 提交、key 重挂载、错误与小额提示 |
| `frontend/components/position/position-config-panel.test.tsx` | 修改 | 保留既有用例，更新总资金用例，新增 7 个交互用例 |
| `frontend/e2e/position.spec.ts` | 修改 | 更新现有联动用例，新增 1 条账户结构联动用例 |
| `test-report-position-custom-capital.md` | 新增 | 本报告 |

## 4. 设计要点（KISS / 高内聚 / 低耦合）

- **纯函数层**：U/WU 转换与校验独立成 `capital.ts`，无 React 依赖，可被切割仓位等其他输入复用。
- **非受控 + key 重挂载**：状态规则从 4 条降到 1 条（提交时验证），外部变化（推荐按钮）通过 `key` 自动同步，避免复杂的受控文本态。
- **零模型侵入**：`PositionConfig.totalCapitalWu` 不变，仅在输入/显示层转换。
- **防御式代码**：`commitCapital` 中对 detached input 的 guard 使用 `istanbul ignore next` 标注，属于无法触发的防御分支。

## 5. 边界行为验证

| 输入 | 行为 | 覆盖方式 |
|------|------|----------|
| `50000` | 提交，config = 5 WU，全链路联动 | 单元测试 + E2E |
| `50,000` / ` 50000 ` | 去逗号空格后提交 | 单元测试 |
| `0` / `-100` | 拒绝：“必须大于 0”，回退原值 | 单元测试 |
| `abc` / `1e` | 拒绝：“请输入有效数字”，回退原值 | 单元测试 |
| `99999999999` | 拒绝：超上限（10^10 U） | 单元测试 |
| `50`（< 100 U） | 提交但显示“金额过小”提示 | 单元测试 |
| 清空后 blur/Enter | 视为未修改，回退显示当前 config 值 | 单元测试 |
| 输入中点推荐按钮 | 未提交内容丢弃，输入框同步推荐值 | 单元测试 |

## 6. 回归说明

- 既有全部用例保留，仅 `updates total capital` 随 UI 契约（label 与提交方式）更新断言。
- 未修改任何与仓位管理无关的模块。
- 未修改 `PositionConfig` 数据模型、持久化格式、计算逻辑。

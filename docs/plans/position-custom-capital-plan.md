# 仓位管理"自定义总资金（U）"方案（审计修订版）

> 对初版方案的严格审计结果：7 个缺陷已修正，以本文为准实施。
> 需求：用户直接以 U 输入总资金，全部分析与计算基于该资金联动。

---

## 0. 审计结论：初版方案的 7 个缺陷

| # | 缺陷 | 严重度 | 修正 |
|---|------|--------|------|
| 1 | **受控文本态方案过度复杂**：本地文本 state + blur/Enter 提交 + 非法回退 + "外部变化同步文本"共 4 条状态规则，且"同步"规则有个没写清的坑——用户输入一半时点了推荐按钮，文本被覆盖 | 高 | 改为**非受控 + key 重挂载**方案（见 1.1），状态规则从 4 条降到 1 条 |
| 2 | **"允许输入 0"语义错误**：总资金为 0 时所有桶归零、风控直接落入"无法覆盖"级，是无意义配置而非合法输入；`totalCapitalWu \|\| 1` 只是防崩溃，不是产品语义 | 中 | 下限改为 **> 0**（最小 1 U），拒绝 0 与负数，提示"必须大于 0" |
| 3 | **小额精度丢失未处理**：< 100 U（< 0.01 WU）在 WU 体系（保留 2 位小数）里被抹零，各桶显示全 0，用户会以为出 bug | 中 | 不拒绝，但输入 < 100 U 时显示提示"金额过小，分配将失去参考意义" |
| 4 | **解析顺序有隐藏 bug**：`Number("")` 返回 0 而非 NaN，必须先判空再解析，否则"清空视为未修改"规则失效 | 中 | 明确解析顺序：trim → 空则回退 → 去逗号 → Number → 有限性/范围 |
| 5 | **既有测试影响描述错误**：label 从"总资金（WU）"改为"总资金（U）"后，`position-config-panel.test.tsx` 的 `updates total capital` 用例会失败——初版说"补交互用例"，实际是**修改既有用例断言**（契约更新，用例保留） | 中 | 测试计划精确到：改 1 个既有用例的 label 与提交方式，新增 6 个交互用例 |
| 6 | **切割仓位输入同病不同治**：`cutPositionWu` 输入也是 `Number(e.target.value)`，同样有清空归零问题，初版没提 | 低 | 明确范围：本次只修总资金（用户需求）；`parseCapitalInput` 设计成可复用纯函数，切割仓位复用留作后续，不蔓延 |
| 7 | **blur 提交导致 E2E 细节缺失**：非受控 + blur 提交下，E2E 的 `fill` 不会触发提交 | 低 | E2E 用 `press("Tab")` 或点击他处触发 blur 后断言联动 |

---

## 1. 修订后方案

核心原则不变：**内部数据模型（WU）零改动，只在输入层做单位转换与校验**。下游计算、持久化格式、旧数据零影响。

### 1.1 输入交互：非受控 + key 重挂载（替代初版的受控文本态）

```tsx
<input
  key={config.totalCapitalWu}          // 外部变化（推荐按钮）→ 重挂载自动同步
  type="text"                          // 不用 number，避免清空变 0 和 spinner
  inputMode="decimal"
  defaultValue={formatWuAsU(config.totalCapitalWu)}
  onBlur={commit}
  onKeyDown={(e) => e.key === "Enter" && commit()}
/>
```

状态规则只有 1 条：**提交时验证，合法则 `applyPatch`，非法则回退显示**。
- 输入过程不触发任何 config 变更（无中间态污染）；
- 清空后 blur → 空文本视为未修改 → 回退显示当前值（天然解决"清空归零"）；
- 外部 config 变化（推荐按钮）→ `key` 变化 → 输入框重挂载显示新值（极端场景"输入中点推荐按钮"会丢失未提交内容，可接受且行为可预期）。

### 1.2 纯函数转换层（`frontend/lib/position/capital.ts`，可复用）

`parseCapitalInput(text)` 解析顺序（修审计 4）：

```
1. trim → 空 → { ok: false, reason: "empty" }        （调用方视为未修改，回退）
2. 去逗号 → Number → 非有限数 → { ok: false, reason: "请输入有效数字" }
3. <= 0 → { ok: false, reason: "必须大于 0" }         （修审计 2）
4. > 10^10 U → { ok: false, reason: "超出合理上限（100 亿 U）" }
5. 否则 → { ok: true, u, wu: u / WU_UNIT }
   附带提示：u < 100 → warning "金额过小，分配将失去参考意义"  （修审计 3）
```

`formatWuAsU(wu)`：WU → U 回显（整数去小数，小数保留必要精度）。

### 1.3 联动语义（不变）

提交合法后走既有 `applyPatch → updateConfig → createDefaultBalance` 链路，全部下游（各桶/风控/试算/验证/诊断/Header）自动联动；面板加一行提示"修改后将按当前配比重新分配各账户金额"。

### 1.4 明确不做（范围边界）

- 不改 `PositionConfig` 数据模型与持久化格式，不做迁移；
- 不加 WU/U 切换器、不加快捷金额按钮；
- 切割仓位（cutPositionWu）输入本次不动，`parseCapitalInput` 已可复用，后续单独跟进；
- Header 卡片保持只读。

## 2. 改动文件清单

| 文件 | 改动 | 规模 |
|------|------|------|
| `frontend/lib/position/capital.ts`（新增） | `parseCapitalInput` / `formatWuAsU` 纯函数 | ~40 行 |
| `frontend/components/position/position-config-panel.tsx` | 总资金输入：label 改"总资金（U）"，非受控 + key + blur/Enter 提交 + 错误/小额提示 | ~35 行 |
| `frontend/lib/position/capital.test.ts`（新增） | 纯函数全分支 | ~70 行 |
| `frontend/components/position/position-config-panel.test.tsx` | **修改** `updates total capital` 用例（label + blur 提交），新增 6 个交互用例 | ~70 行 |
| `frontend/e2e/position.spec.ts` | 新增 1 条：输入资金 + Tab → Header 与各桶联动 | ~15 行 |

## 3. 测试方案（维持 100% 覆盖门槛）

| 层 | 用例 |
|----|------|
| `capital.ts` | 合法整数/小数/带逗号/带空格、空文本（reason=empty）、NaN、0、负数、超上限、边界 1 U、100 U 提示档、WU↔U 往返 |
| 组件 | 输入"50000"+blur → config=5 WU；输入"abc" → 回退 + 错误提示；清空+blur → 回退原值不归零；输入"50" → 小额提示；Enter 提交；推荐按钮后输入框同步新值 |
| E2E | `fill` 总资金 + `press("Tab")` → Header 总资金卡片与账户结构同步更新（修审计 7） |
| 回归 | 既有全部用例保留，仅 1 个用例随契约更新断言 |

## 4. 边界情况（终版）

| 输入 | 行为 |
|------|------|
| `50000` | 提交，config = 5 WU，全链路联动 |
| `50,000` / ` 50000 ` | 去逗号空格后提交 |
| `0` / `-100` | 拒绝："必须大于 0"，回退原值 |
| `abc` / `1e` | 拒绝："请输入有效数字"，回退原值 |
| `99999999999` | 拒绝：超上限（10^10 U） |
| `50`（< 100 U） | 提交但显示"金额过小"提示 |
| 清空后 blur/Enter | 视为未修改，回退显示当前 config 值 |
| 输入中点推荐按钮 | 未提交内容丢弃，输入框同步推荐值（key 重挂载） |

## 5. 实施顺序

1. `capital.ts` 纯函数 + 单测（100%）；
2. config panel 输入改造 + 组件测试（修改 1 既有用例 + 新增 6）；
3. E2E 补 1 条联动断言；
4. 全量回归（vitest 100% 阈值 + Playwright + 既有测试零新增失败）+ 测试报告。

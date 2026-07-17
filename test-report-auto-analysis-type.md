# 分析类型"自动设置"（auto）— 实现与测试报告

## 实现范围

按 `docs/plans/auto-analysis-type-plan.md`（审计修订版）实施，只做 A 方案：**全量检测 + 引擎产出单一权威 `resolved_type`**。审计发现的 6 个缺陷全部在实现中闭环。

### 后端（5 处小改）

| 位置 | 改动 |
|------|------|
| `app/domain/enums.py` | `AnalysisType` 增加 `AUTO = "auto"`（`/api/markets` 与校验器自动支持，零额外代码） |
| `app/infra/pyharmonics_adapter.py` | 计算门改为 `analysis_type in ("forming", "auto")` 时执行 `hs.forming()`；formed/divergence 手动模式维持跳过 forming 的省算力行为 |
| `app/domain/signals.py` | 新增纯函数 `resolve_analysis_type(signal)`：signal-centric 单源解析（有信号→formed/forming，无信号→None），6 行 |
| `app/services/analysis.py` | `_build_trade_signal` 返回 Signal 对象（而非 dict），orchestrator 用纯函数解析并写入 `technical.resolved_type`；`AnalysisData.analysis_type` 保持**请求值**（rerun 可重放 auto 语义） |
| `app/domain/schemas.py` | `TechnicalResult.resolved_type: Optional[str]`（Optional，向后兼容） |

### 前端（4 处小改）

| 位置 | 改动 |
|------|------|
| `frontend/types/index.ts` | `AnalysisType` 增加 `"auto"`；`TechnicalResult.resolved_type` |
| `frontend/hooks/use-analyze.ts` | 默认表单 `analysis_type: "auto"` |
| `frontend/components/dashboard/analyze-form.tsx` | **修复审计发现的 label bug**：三元表达式会把 auto 渲染成"背离"，改为显式映射表 `TYPE_LABELS`，auto→"自动设置"并置首位 |
| `frontend/components/dashboard/result-panel.tsx` | `resolved_type` 非空时显示"自动 → 已形成/形成中"徽标 |

### 真实 API 验证

```
POST /api/analyze {"analysis_type": "auto"}  (BTCUSDT 1h)
→ requested analysis_type: auto          # 请求值原样保留
→ resolved_type: formed                  # 引擎实际采用
→ signal: C 级 long 0.707
→ /api/markets analysis_types: [auto, forming, formed, divergence] ✅
```

## 设计原则落实

- **KISS**：核心是一个 6 行纯函数 + 一个枚举值；无新抽象、无新依赖、无状态机变更。
- **高内聚低耦合**：解析逻辑收在纯函数领域层；orchestrator 只编排；字段语义三分（请求值 `analysis_type` / 采用值 `resolved_type` / 原始检测 `pattern_type`），杜绝 v4 之前的双口径矛盾。
- **signal-centric**：解析值永远描述用户实际看到的产出，绝不制造"已形成但无信号"的矛盾。
- **不影响其他功能**：旧三个分析类型行为零变化；新字段全部 Optional。

## 测试执行结果

### 1. 后端单元测试

```bash
python -m pytest tests/test_auto_analysis_type.py
# 14 passed
```

新增 `tests/test_auto_analysis_type.py`（14 用例）：
- 枚举与校验：auto 值、`validate_analysis_type("auto")`、非法值仍拒绝、markets 包含 auto
- 纯函数：`resolve_analysis_type` 全 3 分支（None/formed/forming）
- adapter 计算门：auto/forming 调用 `hs.forming`，formed/divergence 不调用（mock 断言 ×4）
- orchestrator 集成：auto 请求值保留 + resolved_type=formed、无信号 resolved_type=None、手动模式 resolved_type 也正确填充

`app/domain/signals.py` 覆盖率保持 **100%**（含新函数）。

### 2. 后端全量回归

```bash
python -m pytest tests/ --ignore=tests/test_integration.py   # 364 passed, 2 skipped
DISABLE_AUTH=1 python -m pytest tests/test_integration.py     # 16 passed
```

- **0 新增失败**，全部既有用例保留
- 默认模式 integration 401 为改造前已知现象（需 `DISABLE_AUTH=1`），与本次无关

### 3. 前端单元测试（100% 覆盖门槛通过）

```bash
npm run test:coverage
# 20 files / 159 tests passed, All files 100/100/100/100
```

新增两个组件测试文件（均纳入 100% 覆盖率阈值管控）：
- `components/dashboard/analyze-form.test.tsx`（11 用例）：auto 置首位、label 映射（auto 不渲染成"背离"）、markets 为空回退、未知类型回退原值、四个下拉 onChange、空标的占位、高级面板开合、数值输入、提交/加载/禁用态 —— **analyze-form.tsx 覆盖率 100%**
- `components/dashboard/result-panel.test.tsx`（12 用例）：加载/错误（含 request_id）/空态、resolved_type 徽标 formed/forming/隐藏、看空、原始状态透传、信号卡渲染、稀疏字段容错 —— **result-panel.tsx 覆盖率 100%**

`npm run lint` 通过（仅 2 条改造前已存在的 `<img>` 警告）。

### 4. 前端 E2E（Playwright）

```bash
npx playwright test e2e/dashboard.spec.ts   # 8 passed / 0 failed
npx playwright test                         # 15 passed, 3 failed
```

- 分析工作台 8 个用例全部通过，含新增 **"分析类型默认值应为自动设置"**（断言 `toHaveValue("auto")` + 首选项为"自动设置"）与信号卡用例中的 **"自动 → 已形成"** 徽标断言
- 完整套件 3 个失败均位于 `e2e/auth.spec.ts`，系本地强制 `NEXT_PUBLIC_E2E_AUTH=true` 的预存环境问题，与本次无关，用例完整保留

## 变更文件清单

**新增（3）**：`tests/test_auto_analysis_type.py`、`frontend/components/dashboard/analyze-form.test.tsx`、`frontend/components/dashboard/result-panel.test.tsx`

**修改（10）**：`app/domain/enums.py`、`app/infra/pyharmonics_adapter.py`、`app/domain/signals.py`、`app/services/analysis.py`、`app/domain/schemas.py`、`frontend/types/index.ts`、`frontend/hooks/use-analyze.ts`、`frontend/components/dashboard/analyze-form.tsx`、`frontend/components/dashboard/result-panel.tsx`、`frontend/vitest.config.ts`、`frontend/e2e/helpers.ts`、`frontend/e2e/dashboard.spec.ts`

## 明确未做（按方案范围边界）

- divergence 不作为一级解析类型（保持共振因子定位）
- B 方案：auto 联动自动调参（`percent_complete`/`limit_to`），待 P3 回测数据支撑
- 自动选周期（interval）

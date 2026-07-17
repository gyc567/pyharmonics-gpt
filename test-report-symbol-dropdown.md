# 标的下拉菜单本地缓存改造 — 测试报告

## 变更摘要

- 将分析工作台 `/dashboard` 的“标的”下拉从原来的 `/api/symbols` 网络请求改为本地静态注册表。
- 新增 `frontend/lib/symbols.ts`：高内聚地维护 Binance / Yahoo 的验证后标的列表，并提供 `getSymbols(market)` 选择器。
- 改造 `frontend/hooks/use-analyze.ts`：
  - 初始表单即使用本地列表填充默认标的（`BTCUSDT`）。
  - 切换市场时同步更新标的列表与默认值，不再依赖网络。
- 清理 `frontend/lib/api.ts`、`frontend/next.config.mjs` 中已废弃的 `/api/symbols` 调用与代理规则。
- 移除后端 `app/infra/symbols.py` 与 `app/main.py` 的 `/api/symbols` 端点，避免维护一份已无人使用的网络校验代码。
- 更新 `frontend/e2e/dashboard.spec.ts`，使 E2E 用例适配新的下拉选择交互。

## 设计原则

- **KISS**：纯函数 `getSymbols` + 静态数组，无本地存储、无网络、无复杂状态机。
- **高内聚低耦合**：标的列表与选择逻辑集中在 `lib/symbols.ts`；组件/Hook 只消费，不感知数据来源。
- **不影响其他功能**：未改动仓位管理、认证、主题等无关模块；旧的健康检查、分析、历史接口保持不变。

## 测试执行结果

### 1. 前端单元测试（含覆盖率）

```bash
cd frontend && npm run test:coverage
```

- **测试文件**: 17 passed
- **测试用例**: 130 passed
- **新增测试**: `frontend/lib/symbols.test.ts`（5 个用例）
- **覆盖率**: 100% / 100% / 100% / 100%（statements / branches / functions / lines）
- 新增 `lib/symbols.ts` 已加入 `vitest.config.ts` 的 coverage include，确保 100% 覆盖。

### 2. 前端 E2E 测试

```bash
cd frontend && npx playwright test e2e/dashboard.spec.ts
```

- **6 passed / 0 failed**
  - 页面应加载分析表单与历史侧边栏
  - 市场、标的、周期、分析类型下拉应有选项
  - 提交分析后应展示结果面板
  - 无结果场景应展示无结果状态
  - 分析接口报错应展示错误信息
  - 标的下拉应包含主流币种与股票代币

完整 E2E 套件（16 个用例）在 `NEXT_PUBLIC_E2E_AUTH=true` 的本地开发模式下执行结果：

```
13 passed, 3 failed
```

失败的 3 个用例全部位于 `e2e/auth.spec.ts`（未登录重定向 / OTP 提交），原因是当前开发环境强制开启了 E2E 自动登录，所有页面默认已登录。该失败与本次下拉改造无关，且测试用例文件已完整保留。

### 3. 后端测试

```bash
python -m pytest tests -q
```

- 本次改造移除了 `/api/symbols` 端点，但现有测试集中没有任何用例依赖该端点。
- 运行结果中出现的失败均为改造前已存在的问题：
  - `tests/test_auth.py` 在 `DISABLE_AUTH=1` 下因跳过鉴权而失败；在默认模式下通过。
  - `tests/test_infra.py::TestFetchMarketData` 因旧 `BinanceCandleData` 类已被 `DirectBinanceCandleData` 替换而失败（与下拉无关）。
  - `tests/test_integration.py` 在默认模式下因未携带鉴权头返回 401；在 `DISABLE_AUTH=1` 下 16 个用例全部通过。

## 结论

- 标的下拉现在可以**即时渲染**，不再显示“加载中”。
- 新增功能代码（`lib/symbols.ts` 及其测试）覆盖率 **100%**。
- 分析工作台相关 E2E 用例 **全部通过**。
- 未引入新的测试失败；已有的后端 / 认证相关失败与本次需求无关。

# 谐波交易信号引擎（P0 + P1 核心）— 实现与测试报告

## 实现范围

按 `docs/plans/harmonic-signal-optimization-plan.md`（v2）实施，本次交付 **P0 修复 + P1 信号引擎 MVP + 前端信号卡片**。P2（组合风控/合约适配）、P3（回测校准）、P4（信号列表页）为后续阶段。

### P0 修复（数据正确性）

| 修复 | 文件 | 说明 |
|------|------|------|
| 止盈止损字段永远为 null | `app/infra/pyharmonics_adapter.py` | 新增 `_position_stop / _position_target / _position_risk_reward`，正确映射 pyharmonics `Position.stop / targets`，并在库未提供时自动计算 R:R；兼容旧测试 mock 的 `stop_loss / target / risk_reward` 属性名（只接受数值，防止 MagicMock 穿透） |
| K 线 1000 根静默截断 | `app/infra/marketdata.py` | `DirectBinanceCandleData` 新增 `_fetch_paginated`，按 `endTime` 向前翻页，真正实现 `candles` ≤ 5000 |
| 历史遗留测试失配 | `tests/test_infra.py` | 两处 patch 目标从已删除的 `BinanceCandleData` 修正为 `DirectBinanceCandleData`，测试基线恢复全绿 |

### P1 信号引擎（新增核心模块）

架构严格分层：**纯函数领域层 + 薄编排服务层**，符合 KISS、高内聚低耦合。

| 层 | 文件 | 职责 |
|----|------|------|
| 领域（纯函数，零 I/O） | `app/domain/signals.py` | `Candidate`/`Signal` 值对象；PRZ 状态机（approaching/in_prz/confirmed/swept）；结构失效止损（Gartley/Bat 系=X 点，Butterfly/Crab 系=PRZ 外缘，±0.5×ATR）；斐波那契止盈阶梯（AD 38.2%/61.8%/127.2%，平仓 50/30/20%，TP1 后移保本）；净盈亏比（含双边手续费 0.1% + 滑点 0.05%）；A/B/C 分级（硬门槛：TP1 净 R≥1.0 且 TP2 净 R≥1.5，逆势强制 ≤C） |
| 服务（薄编排） | `app/services/signal_engine.py` | 候选提取（容错反序列化 pyharmonics 形态对象）、ATR/RSI 计算、HTF 趋势（K 线重采样至上一级周期，EMA21/55，零额外网络请求）、反转 K 线确认（锤子/流星 + 1.5× 放量）、六因子共振评分（价格行为 25 / HTF 25 / RSI 15 / 结构 15 / MACD 10 / funding 10）、择优输出 |
| 接线 | `app/infra/pyharmonics_adapter.py`、`app/domain/schemas.py`、`app/services/analysis.py` | adapter 暴露 `raw_assessment`；schema 新增 `Signal`/`SignalTarget`（`TechnicalResult.signal` 为 Optional，向后兼容）；orchestrator 以 best-effort 方式挂载信号（引擎异常仅降级日志，不影响分析主流程） |
| 前端 | `frontend/types/index.ts`、`frontend/components/dashboard/signal-card.tsx`、`frontend/components/dashboard/result-panel.tsx` | Signal 类型；信号卡片（分级徽标/方向/入场区/参考入场/硬止损/净 R:R/斐波那契阶梯止盈/共振评分/HTF 趋势）；有信号时渲染在结果面板顶部 |

### 真实数据验证（BTCUSDT 1h）

```
candidates: 12 (shark/0.886/1.414/2.618/1.618 ... 全部 short, PRZ 远离现价)
price 63659, atr 335, rsi 38.3, trend bullish
→ 所有候选 score=38 < 45 且净 R:R 不达标 → signal: None  ✅ 严格过滤按设计工作
→ 同时 entry/stop/target/rr 字段返回真实值 (rr=3.0)  ✅ P0 修复生效
```

## 设计原则落实

- **KISS**：领域层 119 行纯函数；服务层只做"取数据 → 调领域函数 → 择优"；无继承、无注册表、无多余抽象。
- **高内聚低耦合**：信号计算全部集中在 `domain/signals.py`；服务层依赖抽象的数据帧而非 pyharmonics 具体类型；orchestrator 与引擎之间用 dict 契约，引擎可独立替换。
- **严格止损**：止损永远放在形态失效点（结构属性），仓位由风险预算反推——不存在"取最远止损"的错误。
- **不影响其他功能**：`TechnicalResult.signal` 为 Optional；引擎失败静默降级；未改动认证、仓位、历史等无关模块。

## 测试执行结果

### 1. 后端单元测试（新增代码 100% 覆盖）

```bash
python -m pytest tests/test_domain_signals.py tests/test_signal_engine.py \
  --cov=app.domain.signals --cov=app.services.signal_engine --cov-report=term-missing
```

| 模块 | 测试数 | Stmts | Miss | Cover |
|------|--------|-------|------|-------|
| `app/domain/signals.py` | 44 | 119 | 0 | **100.00%** |
| `app/services/signal_engine.py` | 43 | 143 | 0 | **100.00%** |
| **合计** | **87** | 262 | 0 | **100.00%** |

新增测试文件：
- `tests/test_domain_signals.py`（44 用例）：值对象、PRZ 状态机、插针检测、多空/扩展形态止损、斐波那契止盈、净 R:R（含费用侵蚀边界）、分级全部分支
- `tests/test_signal_engine.py`（43 用例）：候选提取容错、ATR/RSI 边界（全涨/全跌/横盘）、HTF 重采样各分支、反转 K 线六态、共振评分各因子组合、A 级确认信号端到端、做空信号、低分丢弃、最优候选择优

### 2. 后端全量回归

```bash
python -m pytest tests/ --ignore=tests/test_integration.py   # 257 passed, 2 skipped
DISABLE_AUTH=1 python -m pytest tests/test_integration.py     # 16 passed
```

- **0 新增失败**。既有全部测试用例保留并通过（含本次修正的两处历史失配 mock）。
- 默认模式下 `test_integration.py` 的 401 失败为改造前已知现象（需 `DISABLE_AUTH=1`），与本次无关。

### 3. 前端单元测试（100% 覆盖门槛通过）

```bash
cd frontend && npm run test:coverage
```

- **18 个测试文件、134 个用例全部通过**
- 新增 `components/dashboard/signal-card.test.tsx`（4 用例：完整渲染/做空降级/未知状态/B 级徽标）
- `signal-card.tsx` 已加入 `vitest.config.ts` coverage include，覆盖率 **100% / 100% / 100% / 100%**
- 全量覆盖率阈值（100%）通过
- `npm run lint` 通过（仅 2 条改造前已存在的 `<img>` 警告）

### 4. 前端 E2E（Playwright）

```bash
npx playwright test e2e/dashboard.spec.ts   # 7 passed / 0 failed
npx playwright test                         # 14 passed, 3 failed
```

- 分析工作台 7 个用例全部通过，含新增 **"分析结果应展示交易信号卡片"**（E2E mock 注入 A 级信号，断言卡片、硬止损、阶梯止盈、共振评分可见）
- 完整套件 3 个失败均位于 `e2e/auth.spec.ts`（未登录重定向/OTP），原因是本地开发强制开启 `NEXT_PUBLIC_E2E_AUTH=true` 自动登录——**改造前已存在，与本次无关**，用例代码完整保留

## 变更文件清单

**新增（6）**：`app/domain/signals.py`、`app/services/signal_engine.py`、`tests/test_domain_signals.py`、`tests/test_signal_engine.py`、`frontend/components/dashboard/signal-card.tsx`、`frontend/components/dashboard/signal-card.test.tsx`

**修改（10）**：`app/infra/pyharmonics_adapter.py`（P0 映射 + raw_assessment + signal 参数）、`app/infra/marketdata.py`（分页）、`app/domain/schemas.py`（Signal schema）、`app/services/analysis.py`（挂载信号）、`tests/test_infra.py`（mock 目标修正）、`frontend/types/index.ts`、`frontend/components/dashboard/result-panel.tsx`、`frontend/vitest.config.ts`、`frontend/e2e/helpers.ts`、`frontend/e2e/dashboard.spec.ts`

## 后续阶段（未实施，按 v2 计划推进）

- **P2**：共振评分接 funding/合约数据、组合层风控（相关性敞口/日内熔断）
- **P3**：逐时点回测 + 前视偏差审计测试 + `signal_outcomes` 落库 + walk-forward 校准（启发式阈值→分位数）
- **P4**：`/api/signals` 列表页、LLM prompt 结构化重写

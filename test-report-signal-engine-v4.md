# 谐波交易信号引擎 v4（P0 事故修复 + P1 有效性验证）— 实现与测试报告

## 实现范围

按 `docs/plans/harmonic-signal-optimization-plan.md`（v4）实施，本次交付：
- **P0 事故修复**：SOXLUSDT 陈旧信号事故的全部 5 个根因
- **P1 有效性验证**：四支柱中的 P4 支柱（多窗口稳定性 / 量化陷阱 / 量价真实性 / regime）
- **P2 统计核心**：动量夏普否决 + 波动率目标仓位系数 + reasoning 理由模板

P2 纪律层（冷却/去重/熔断）与 P3（回测校准/校正因子环）为后续阶段。

### P0 事故修复（SOXLUSDT 案例，5 个根因全部闭环）

| 根因 | 修复 | 验证 |
|------|------|------|
| 陈旧形态未过滤 | `filter_candidates`：空间距离 >3×ATR → `stale_distance`；D 点 >20 根 K 线 → `stale_age`；forming 退化 PRZ → `degenerate_prz`；价格穿越失效点 → `violated`；已涨/跌过 TP2 → `completed` | 合成 PRZ=191.04、现价 127.82 的做空候选被以 `stale_distance`（10.7×ATR）正确丢弃，输出无信号 |
| 状态机缺失效态 | violated/completed 判定落地为过滤规则 | 单元测试多空双向覆盖 |
| 双口径输出矛盾 | `technical_result` 的 entry/stop/target/RR **只从选中 Signal 派生**；无信号则为 null，不再展示库默认值 | 实测 API：legacy 字段与信号卡完全同源 |
| 止损方向无校验 | `direction_invariant_ok`：多 `stop < entry ≤ TP1 < TP2 < TP3`，空镜像，违反即丢弃（纵深防御） | 白盒测试覆盖 |
| ATR 失真 | 稳健 ATR = `min(14周期, 100周期均值)`，暴跌行情不再放大缓冲 | 单元测试覆盖 |

### P1 有效性验证（v4 核心，新增 `app/domain/validation.py` 纯函数模块）

| 验证器 | 规则 | 处置 |
|--------|------|------|
| 量化陷阱风险 | 假突破率（>25% 否决）、止损猎杀、量能高潮、**PRZ 支撑/阻力失败（否决）** | 否决或扣分 |
| 量价真实性 | 量价对齐 40% + 脉冲率 40% + 量能自相关 20% | <40 价格行为因子减半，<25 全部否决 |
| 多窗口稳定性 | A/B 级信号触发：全窗口/去尾 5 根/去头 5 根各跑一次检测；形态仅存在于全窗口 = 疑似人造 → **否决** | 稳定分 85/55/40/25/20 |
| 量化 regime | 跳空频率 + 日内反转率 + 量能 CV + 肥尾率 → normal/moderate/high_quant | high_quant 时 A 级门槛 75→85、仓位系数 ×0.6 |

### P2 统计核心

- **动量夏普否决**（每根 K 线 mean/std，区间无关）：多头遭遇夏普 < −1.0 的一致性下跌（接飞刀）否决；空头遭遇 > +1.0 的一致性上涨（逼空）否决；温和逆势不罚（PRZ 反转的常态）
- **波动率目标仓位系数**：`clamp(2.5% / ATR%, 0.5, 1.5)`，高波动标的自动缩仓
- **reasoning 理由模板**：方向/入场区/止损/三档止盈/净 R:R/高周期趋势，前端可折叠展示

### 真实数据验证

```
SOXLUSDT 合成事故候选（做空 PRZ=191.04，现价 127.82，距离 10.7×ATR）
  → stale_distance 丢弃，无信号 ✅

BTCUSDT 4h：候选 21 → 有效 2（stale×16, completed×3）→ 无信号 ✅
BTCUSDT 1h：候选 14 → 有效 2 → C 级观察信号（RR2=0.35 < 1.5 门槛，正确降级）
ETHUSDT 4h：候选 8 → 全部 stale → 无信号 ✅
```

绝大多数被丢弃的候选都是陈旧形态——**这正是事故根因的实锤，过滤器按设计工作**。

## 设计原则落实

- **KISS**：`validation.py` 全部纯函数（K 线进 → 分数/否决出）；引擎只消费总分与否决标志；无外部新依赖。
- **高内聚低耦合**：验证逻辑全部收在 `domain/validation.py`；引擎与 orchestrator 之间用 dict 契约；多窗口检测以可注入 callable（`stability_detector`）解耦，测试中轻松替换。
- **否决优先于评分**：P4 否决项命中即丢弃，与共振分数无关——宁缺毋滥。
- **不影响其他功能**：Signal schema 新字段全部 Optional；引擎失败静默降级；未改动认证/仓位/历史模块。

## 测试执行结果

### 1. 后端新增代码覆盖率（100% 达标）

```bash
python -m pytest tests/test_domain_signals.py tests/test_domain_validation.py \
  tests/test_signal_engine.py --cov=app.domain.signals --cov=app.domain.validation \
  --cov=app.services.signal_engine --cov-report=term-missing
```

| 模块 | 测试数 | Stmts | Miss | Cover |
|------|--------|-------|------|-------|
| `app/domain/signals.py` | 50 | 136 | 0 | **100.00%** |
| `app/domain/validation.py`（新增） | 71 | 224 | 0 | **100.00%** |
| `app/services/signal_engine.py` | 57 | 193 | 0 | **100.00%** |
| **合计** | **178** | 553 | 0 | **100.00%** |

新增/更新测试文件：
- `tests/test_domain_validation.py`（71 用例，新增）：stale 四类原因边界、不变量全违例组合、假突破三档+否决、止损猎杀、量能高潮、PRZ 支撑/阻力失败、量价真实性各档、稳定性判定全 9 态、regime 三档、夏普零方差 ±inf、否决方向、波动率系数 clamp
- `tests/test_domain_signals.py`（50 用例，+6）：v4 元数据 to_dict、a_min 阈值、reasoning 模板三分支
- `tests/test_signal_engine.py`（57 用例，+14）：陈旧过滤、时间过期、陷阱否决、动量否决、量价否决、稳定性否决/保留/部分匹配/检测器异常、不变量白盒、v4 元数据完整性

### 2. 后端全量回归

```bash
python -m pytest tests/ --ignore=tests/test_integration.py   # 350 passed, 2 skipped
DISABLE_AUTH=1 python -m pytest tests/test_integration.py     # 16 passed
```

- **0 新增失败**，全部既有用例保留
- 契约更新 2 处（统一输出口径）：`test_infra.py::test_with_position` 改为断言无信号时字段为 None，并新增 2 个 signal 派生用例；`test_services.py::test_analyze_with_patterns` 同步更新注释与断言
- 默认模式 integration 401 为改造前已知现象（需 `DISABLE_AUTH=1`），与本次无关

### 3. 前端单元测试（100% 覆盖门槛通过）

- **18 个测试文件、136 个用例全部通过**
- `signal-card.test.tsx` 增至 6 用例（v4 元数据渲染/regime 警告/reasoning 折叠/缺失字段隐藏）
- `signal-card.tsx` 覆盖率 **100% / 100% / 100% / 100%**；全量覆盖率阈值通过
- `npm run lint` 通过（仅 2 条改造前已存在的 `<img>` 警告）

### 4. 前端 E2E（Playwright）

```bash
npx playwright test e2e/dashboard.spec.ts   # 7 passed / 0 failed
npx playwright test                         # 14 passed, 3 failed
```

- 分析工作台 7 个用例全部通过（含信号卡片用例）
- 完整套件 3 个失败均位于 `e2e/auth.spec.ts`，系本地强制 `NEXT_PUBLIC_E2E_AUTH=true` 的预存环境问题，与本次无关，用例完整保留

## 变更文件清单

**新增（2）**：`app/domain/validation.py`、`tests/test_domain_validation.py`

**修改（11）**：`app/domain/signals.py`（Candidate.times、Signal 元数据、a_min、reasoning）、`app/services/signal_engine.py`（稳健 ATR、时间戳提取、否决管线、regime 分级、稳定性检测）、`app/infra/pyharmonics_adapter.py`（统一输出口径）、`app/services/analysis.py`（stability_detector 注入）、`app/domain/schemas.py`（Signal v4 字段）、`tests/test_infra.py`、`tests/test_services.py`、`tests/test_domain_signals.py`、`tests/test_signal_engine.py`、`frontend/types/index.ts`、`frontend/components/dashboard/signal-card.tsx` + 测试

## 后续阶段（未实施，按 v4 计划推进）

- **P2 纪律层**：冷却期/去重/全局上限/日内熔断、杠杆与强平缓冲提示
- **P3 回测+校正环**：逐时点回放 + 前视偏差审计 + `signal_outcomes` 落库 + 5 日 cutoff 快报 + 校正因子反馈环 + walk-forward 校准

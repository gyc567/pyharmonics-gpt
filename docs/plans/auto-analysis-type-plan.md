# 分析类型"自动设置"优化方案（审计修订版）

> 范围锁定：只做 A（全量检测 + 自动解析类型并回传），不做 B（联动自动调参）。
> 本文档是对初版方案的严格审计结果，**6 个缺陷已全部修正**，以本文为准实施。

---

## 0. 审计结论：初版方案的 6 个缺陷

| # | 缺陷 | 严重度 | 修正方向 |
|---|------|--------|----------|
| 1 | **解析规则基于"候选存在"而非"最终采用"**：有效 formed 候选存在就解析为 formed，但该候选可能评分不达标被丢弃、无信号产出——用户看到"已形成"却没有信号卡，重现 v4 刚消灭的双口径矛盾 | 高 | 解析值必须以**引擎最终产出**为唯一来源（signal-centric），见 2.2 |
| 2 | **divergence 作为一级解析类型没有管线支撑**：只有背离时 `has_patterns=false` → `status=no_result` → 前端渲染"暂无分析结果"空态。解析值"divergence"与实际展示矛盾；且背离在 v4 体系里的定位是共振因子，不是独立分析模式 | 高 | 背离**不做一级解析类型**；无形态时一律 `no_result`，背离数据仍留在 `technical_result.divergences` 供卡片消费 |
| 3 | **pattern_type 双源冲突**：adapter 旧逻辑按家族优先级独立设置 `pattern_type`，引擎解析又是另一套——两个"类型"可能打架（adapter 选到陈旧 formed 标 formed，引擎无产出） | 中 | `resolved_type` 单源化：只由信号引擎产出；`pattern_type` 保留为"原始检测信息"，语义在文档中显式切分（见 2.4） |
| 4 | **前端 label 三元映射 bug**：`analyze-form.tsx` 中 `t === "forming" ? "形成中" : t === "formed" ? "已形成" : "背离"`，`auto` 会落入 else 被渲染成**"背离"** | 高 | label 改为显式映射表，auto → "自动设置"并置首位 |
| 5 | **历史记录 rerun 语义未定义**：若把解析值（formed）存进历史，rerun 会以 formed 重跑，失去 auto 语义 | 中 | 历史与 `AnalysisData.analysis_type` 一律存**请求值** `auto`；rerun 自动保持自动 |
| 6 | **默认值切换的计算成本未声明**：`hs.forming()` 是重计算，auto 作为默认后每次分析都执行 | 低 | 可接受（与今天手动选 forming 同成本），文档声明；formed/divergence 手动模式保留跳过 forming 的省算力行为 |

---

## 1. 语义定义（一句话）

> **auto = 全量检测（forming + formed + divergence）+ 由信号引擎产出单一权威解析值 `resolved_type`。**

系统底层（v4 信号引擎）本来就跨类型收集全部候选、统一过滤、统一评分择优——auto 只是把"跑全部 + 汇报用了什么"形式化，**不引入任何新的决策逻辑**。

## 2. 修订后方案

### 2.1 解析规则（纯函数，signal-centric）

`resolve_analysis_type(signal) -> Optional[str]`：

```
signal 存在  → "formed" if signal.formed else "forming"
signal 为空  → None   （无达标信号/无有效形态，前端显示"暂无有效信号"）
```

设计理由（对应审计 1/2）：
- 解析值描述的是**用户实际看到的产出**，不是中间过程的候选——有信号说类型，没信号就是没信号，绝不制造"已形成但空空如也"的矛盾；
- C 级观察信号也会被 `build_signal` 返回，因此" forming 接近中"这类观察场景依然能解析为 forming，观察名单体验不受影响。

### 2.2 后端改动点（5 处，均为小改）

| 位置 | 改动 |
|------|------|
| `app/domain/enums.py` | `AnalysisType` 增加 `AUTO = "auto"`（`/api/markets` 自动包含；`validate_analysis_type` 基于 `AnalysisType(value)` **零改动**） |
| `app/infra/pyharmonics_adapter.py` | `detect_patterns` 的计算门：`analysis_type in ("forming", "auto")` 时执行 `hs.forming()`（formed/背离本来全跑；formed/divergence 手动模式维持跳过 forming 的省算力行为） |
| `app/services/signal_engine.py` | 新增纯函数 `resolve_analysis_type(signal)`（6 行） |
| `app/services/analysis.py` | orchestrator 将 `resolved_type` 写入 `TechnicalResult`；`AnalysisData.analysis_type` 保持**请求值**（审计 5） |
| `app/domain/schemas.py` | `TechnicalResult` 增加 `resolved_type: Optional[str] = None`（Optional，向后兼容） |

### 2.3 前端改动点（3 处）

| 位置 | 改动 |
|------|------|
| `frontend/types/index.ts` | `AnalysisType` 增加 `"auto"` |
| `frontend/hooks/use-analyze.ts` | `DEFAULT_FORM.analysis_type` 改为 `"auto"`（默认即自动） |
| `frontend/components/dashboard/analyze-form.tsx` | label 改显式映射表：`auto → "自动设置"`、`forming → "形成中"`、`formed → "已形成"`、`divergence → "背离"`，**auto 置首位**（修审计 4 的 bug） |

结果面板无需新组件：`resolved_type` 非空时在"形态类型"旁显示"自动 → 已形成/形成中"小徽标（复用现有 badge 样式，约 10 行）。

### 2.4 字段语义切分（防再混淆，写入代码注释）

| 字段 | 语义 | 来源 |
|------|------|------|
| `analysis_type` | 用户**请求**的模式（含 auto） | 请求原样 |
| `resolved_type` | 引擎**实际采用**的类型（formed/forming/null） | 信号引擎，唯一权威 |
| `pattern_type` / `pattern_family` | **原始检测信息**（未经 v4 过滤，可能含陈旧形态） | adapter，仅参考 |

### 2.5 边界情况

| 场景 | resolved_type | status | 前端表现 |
|------|---------------|--------|----------|
| A/B/C 级 formed 信号 | formed | completed | 信号卡 + "自动 → 已形成" |
| A/B/C 级 forming 信号 | forming | completed | 信号卡 + "自动 → 形成中" |
| formed 全陈旧、无 forming 达标 | null | completed / no_result | "暂无有效信号"，无误导性类型 |
| 只有背离、无形态 | null | no_result | 空态；背离数据仍在 technical_result 内 |
| 手动选 formed/forming/divergence | 照常解析 | 与今天一致 | 行为零变化（resolved_type 顺带填充，更一致） |

### 2.6 测试方案（100% 覆盖新增代码）

- **单元**：`resolve_analysis_type` 全 3 分支；adapter 计算门（auto 调 `hs.forming`、formed/divergence 不调，mock 断言）；label 映射快照；
- **集成**：`POST /api/analyze {"analysis_type": "auto"}` → 200 且 `resolved_type ∈ {formed, forming, null}`、`analysis_type == "auto"`；非法值仍 400；
- **前端**：下拉默认选中"自动设置"、四选项 label 正确（auto 不得渲染成"背离"）；
- **E2E**：dashboard 现有用例全保留；新增断言"分析类型默认值为自动设置"；mock 含 `resolved_type: "formed"` 时展示"自动 → 已形成"。

### 2.7 影响面与兼容性

- 请求合法域 3→4，旧值行为**零变化**；响应新增 Optional 字段，旧客户端不崩；
- 历史记录/rerun 存请求值，auto 语义可重放；
- 计算成本：auto ≈ 今天手动选 forming；formed/divergence 手动模式维持省算力路径。

## 3. 明确不做（防范围蔓延）

1. divergence 不作为一级解析类型（保持共振因子定位）；
2. `pattern_family/pattern_type` 原始检测字段**不过滤**（保留为检测参考信息，语义已在 2.4 切分）；
3. B 方案（auto 联动自动调参 `percent_complete`/`limit_to`）——等 P3 回测数据支撑后再议；
4. 自动选周期（interval）——超出需求。

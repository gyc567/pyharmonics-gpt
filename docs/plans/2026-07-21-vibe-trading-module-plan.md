# Vibe Trading 模块设计方案

> 状态：方案草案，待评审确认  
> 目标：在 Pyharmonics SaaS 主界面增加一个“Vibe Trading”智能交易助手模块  
> 参考来源：[HKUDS/Vibe-Trading](https://github.com/HKUDS/Vibe-Trading)  
> 生成日期：2026-07-21

---

## 一、背景与目标

### 1.1 为什么参考 Vibe-Trading

HKUDS/Vibe-Trading 的核心价值是**让交易者用自然语言驱动一个具备记忆、工具和回测能力的 AI Agent**。其关键能力包括：

| 能力 | 说明 | 对我们项目的启发 |
|------|------|------------------|
| **自然语言研究** | 用对话提问市场、标的、策略 | 把当前表格式分析变成对话式 |
| **工具调用** | 68+ 工具覆盖数据、回测、报告 | 把 Pyharmonics 分析、仓位检查、信号扫描封装成工具 |
| **多 Agent 协作** | 29 种 swarm preset（投研委员会、量化组、风控组） | 未来可扩展为多角色研究 |
| **Shadow Account** | 从交易记录提取规则并回测 | 可与本项目的交易日志/长期价值仓结合 |
| **Alpha Zoo** | 456 个预置因子 | 当前项目以谐波形态为主，暂不复制 |
| **持久记忆** | 跨会话记忆、技能 CRUD | 长期愿景，MVP 可先做到会话内上下文 |
| **MCP 开放** | 暴露工具给外部客户端 | 未来可把本项目的分析能力作为 MCP Server |

### 1.2 本项目现状

当前 Pyharmonics SaaS 已具备：

- **分析工作台** `/dashboard`：表单提交市场/标的/周期/分析类型，返回谐波形态检测结果 + 模型解读 + 图表。
- **仓位管理** `/position`：WU 单位资金拆分、风控等级、冷静清单、what-if 模拟。
- **认证与额度** Supabase Auth + usage_ledger 每日配额。
- **技术栈** Flask (Python) + Next.js 14 (TypeScript/Tailwind/shadcn) + Supabase。

### 1.3 模块定位

在本项目主界面新增一个 **“Vibe 交易”** 入口（暂定名），它不是简单复制 Vibe-Trading 的全部功能，而是**以本项目已有的谐波形态检测、信号引擎、仓位管理为底座**，叠加一层自然语言交互 Agent，让用户可以：

1. 用中文/英文对话式提出交易问题；
2. Agent 自动调用 Pyharmonics 分析、信号生成、仓位风控、回测验证等工具；
3. 在聊天流中给出可执行的结论（信号卡片、风控提示、下一步建议）；
4. 保留会话上下文，支持多轮追问；
5. 所有输出**只读/建议**，不直接连接交易所，确保安全第一。

---

## 二、产品形态：放在哪里？

### 2.1 两种可选形态

| 方案 | 做法 | 优点 | 缺点 | 推荐度 |
|------|------|------|------|--------|
| **A. Dashboard 内嵌 Vibe 面板** | 在 `/dashboard` 右侧或下方新增一个可折叠的聊天侧边栏 | 不新增页面，用户分析完可直接提问；与分析表单联动强 | 空间受限，复杂会话体验一般 | ★★★★☆ |
| **B. 独立 `/vibe` 页面** | 新增一个全屏对话工作台 | 体验接近 Vibe-Trading 原版的 Agent 界面，可容纳复杂分支、图表、回测结果 | 需要用户切换页面，初期认知成本高 | ★★★★★ |
| **C. A+B 组合** | Dashboard 显示精简 Vibe 快捷输入，点击“展开全屏”进入 `/vibe` | 兼顾快捷与深度 | 实现量稍大 | ★★★★★ |

**已确认：采用 B（独立 `/vibe` 页面）**。Dashboard 在 Phase 1 暂不放常驻 Vibe 面板，但可在分析结果中保留“在 Vibe 中追问”的快捷跳转链接。

### 2.2 导航变更

- `frontend/components/layout/sidebar.tsx` 的 `NAV_ITEMS` 增加：
  ```ts
  { href: "/vibe", label: "Vibe 交易", icon: Sparkles }
  ```
  图标使用 `lucide-react` 的 `Sparkles` 或 `Bot`。
- `frontend/components/providers/app-shell.tsx` 的 `getPageTitle` 增加 `/vibe` → “Vibe 交易”。

---

## 三、MVP 功能范围（Phase 1）

### 3.1 用户旅程

```text
用户进入 /vibe
  └─ 看到欢迎语 + 推荐问题卡片
     └─ 输入自然语言问题，例如：
        “帮我看看 BTCUSDT 1h 有没有形成中的做多机会，并检查我当前仓位能不能上”
     └─ Agent 开始思考（显示工具调用卡片）
        1. get_market_data(BTCUSDT, 1h)
        2. analyze_harmonic(BTCUSDT, 1h, forming)
        3. build_trade_signal(...)
        4. position_check(symbol=BTCUSDT, planned_size_wu=0.5)
     └─ 返回结构化结论
        - 信号卡片（方向、入场、止损、目标、RR）
        - 风控提示（触发等级、是否需要冷静清单）
        - 建议下一步（去 Dashboard 看详细图表 / 去 Position 做 what-if / 保存到日志）
     └─ 用户可继续追问
        “那 4h 呢？”
        “如果止损放大到 5%，仓位建议多少？”
```

### 3.2 MVP 工具集（Tool Registry）

每个工具都是 Flask 后端可调用的 Python 函数，Agent 通过 OpenAI function-calling / tool-calling 协议调用。

| 工具名 | 能力 | 对应现有模块 |
|--------|------|--------------|
| `analyze_harmonic` | 运行谐波形态/背离检测 | `AnalysisOrchestrator.analyze` |
| `get_market_data` | 拉取 OHLCV 数据摘要 | `app.infra.pyharmonics_adapter.fetch_market_data` |
| `build_trade_signal` | 基于检测结果生成结构化信号 | `app.services.signal_engine` |
| `scan_watchlist` | 对自选列表批量扫描形态 | 复用 `analyze_harmonic` 循环 |
| `position_check` | 检查计划交易金额在当前仓位配置下的风控等级 | 复用 `frontend/lib/position/calculator.ts` 逻辑，后端需同步实现 |
| `backtest_signal` | 对历史信号做简单回放（命中、胜率、RR）；支持默认模板 30/90/180 天与用户自定义区间 | 新增，基于 Pyharmonics 历史数据 + 信号规则 |
| `explain_market` | 用 LLM 解读给定数据 | 复用 `query_openai` |
| `save_to_journal` | 把当前结论保存为交易日志草稿 | 可写入 `trade_readiness_logs` 或新表 |

**Phase 1 不做**：真实下单、连接券商、多 Agent swarm、外部 MCP Server、Alpha Zoo。

### 3.3 输出卡片类型

聊天流中不只返回纯文本，而是返回可渲染的结构化卡片：

1. **SignalCard**（复用现有）：方向、入场、止损、目标、RR、置信度。
2. **AnalysisMiniCard**：标/周期/形态/图表缩略图，点击跳转 `/analysis/[id]`。
3. **PositionCheckCard**：风控等级、触发阻力、建议等待时间。
4. **BacktestResultCard**：回测区间、信号数、胜率、盈亏比、最大回撤。
5. **ToolCallCard**：显示 Agent 正在调用哪个工具、参数、耗时（类似 Vibe-Trading 的实时反馈）。
6. **SuggestionChips**：下一轮推荐问题。

---

## 四、系统架构

### 4.1 整体架构图

```text
┌─────────────────────────────────────────────────────────────┐
│  Next.js Frontend                                           │
│  ├─ /dashboard  (内嵌 Vibe 快捷输入 + 结果卡片)              │
│  ├─ /vibe       (完整 Agent 对话工作台)                      │
│  └─ 共享组件: VibeChat, ToolCallCard, SuggestionChips       │
├─────────────────────────────────────────────────────────────┤
│  Flask API                                                  │
│  ├─ /api/vibe/sessions            创建会话                   │
│  ├─ /api/vibe/sessions/<id>       获取会话元数据             │
│  ├─ /api/vibe/sessions/<id>/messages  SSE 流式对话           │
│  ├─ /api/vibe/sessions/<id>/messages (POST) 非流式/重放      │
│  ├─ /api/vibe/tools/<name>        直接调用工具（调试/前端用）│
│  └─ VibeOrchestrator + ToolRegistry                         │
├─────────────────────────────────────────────────────────────┤
│  Agent Runtime                                                │
│  ├─ 基于 OpenAI-compatible LLM 的 function-calling 循环      │
│  ├─ 工具执行隔离（超时、异常捕获、只读优先）                 │
│  ├─ 会话上下文管理（system + user/assistant/tool messages）  │
│  └─ 流式 SSE 输出（思考/工具调用/最终结论）                  │
├─────────────────────────────────────────────────────────────┤
│  Tool Implementations                                         │
│  ├─ analyze_harmonic / get_market_data / build_trade_signal  │
│  ├─ position_check（后端复用仓位计算）                        │
│  ├─ backtest_signal（新增）                                   │
│  └─ save_to_journal（新增）                                   │
├─────────────────────────────────────────────────────────────┤
│  Persistence                                                  │
│  ├─ vibe_sessions  (会话表)                                  │
│  ├─ vibe_messages  (消息/工具调用记录)                        │
│  ├─ vibe_runs      (每次 Agent 运行记录与审计)                │
│  └─ usage_ledger   (额度扣减)                                 │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 后端新增组件

| 组件 | 职责 | 文件建议 |
|------|------|----------|
| `VibeOrchestrator` | 管理单次 Agent 运行：加载上下文 → LLM 调用 → 工具分发 → 流式输出 | `app/services/vibe/orchestrator.py` |
| `ToolRegistry` | 注册、发现、校验工具签名 | `app/services/vibe/tools/registry.py` |
| Tool Implementations | 每个工具一个文件，保持单一职责 | `app/services/vibe/tools/*.py` |
| `VibeSessionStore` | 会话与消息读写 | `app/infra/vibe_session_store.py` |
| `VibeStreamHandler` | 把 Agent 事件转换为 SSE 数据包 | `app/api/vibe_stream.py` |
| API Routes | `/api/vibe/*` | `app/api/vibe_routes.py` |

### 4.3 Agent 循环设计

采用 **ReAct / Function Calling** 简化版：

```text
1. 用户发送消息 → 追加到 vibe_messages
2. Orchestrator 构建 messages 列表（system + 历史上下文 + 当前消息）
3. 调用 LLM with tools
4. LLM 返回：
   - text → 直接流式返回给用户
   - tool_calls → 流式显示 ToolCallCard，执行工具，追加 tool_result，再次调用 LLM
5. 到达终止条件（自然结束 / 最大迭代数 / 工具失败）后，生成最终回复
6. 保存 assistant message 与 tool results，扣减额度
```

**安全与兜底**：

- 最大迭代数：默认 10 次，防止死循环。
- 工具超时：每个工具 30 秒，超时不阻塞整体运行。
- 只读优先：Phase 1 所有工具只读或仅写入用户自己的日志表，不触碰外部资金。
- 审计：每次运行写入 `vibe_runs`，包含工具调用链、耗时、token 用量、用户 ID。

---

## 五、数据模型

### 5.1 新增表（Supabase）

```sql
-- 1. Vibe 会话
CREATE TABLE IF NOT EXISTS vibe_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,                       -- 自动生成，如 "BTCUSDT 1h 分析"
    status TEXT NOT NULL DEFAULT 'active',  -- active, archived, deleted
    context JSONB DEFAULT '{}',       -- 会话级上下文（自选列表、默认市场等）
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vibe_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can manage own vibe sessions" ON vibe_sessions
    FOR ALL USING (auth.uid() = user_id);

-- 2. Vibe 消息（支持流式消息的最终持久化）
CREATE TABLE IF NOT EXISTS vibe_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vibe_sessions(id) ON DELETE CASCADE,
    role TEXT NOT NULL,               -- system, user, assistant, tool
    content TEXT,
    tool_calls JSONB,                 -- assistant 的 tool_calls
    tool_call_id TEXT,                -- tool result 对应的 call_id
    tool_name TEXT,
    tool_input JSONB,
    tool_output JSONB,
    cards JSONB,                      -- 前端渲染用的结构化卡片数组
    created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE vibe_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own vibe messages" ON vibe_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM vibe_sessions s
            WHERE s.id = vibe_messages.session_id AND s.user_id = auth.uid()
        )
    );

-- 3. Vibe 运行记录（审计 + 额度）
CREATE TABLE IF NOT EXISTS vibe_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vibe_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL,             -- running, completed, failed, cancelled
    tool_trace JSONB DEFAULT '[]',    -- 工具调用链
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
ALTER TABLE vibe_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own vibe runs" ON vibe_runs
    FOR ALL USING (auth.uid() = user_id);
```

### 5.2 额度设计

Vibe 交易单次运行可能调用多次 LLM + 工具，额度消耗应高于普通分析：

| 计费项 | 建议 | 备注 |
|--------|------|------|
| 每创建/回复一次会话 | 1 unit | 与 `/api/analyze` 一致 |
| 工具调用本身 | 不计费 | 已摊入 LLM 调用成本 |
| 失败/取消 | 释放额度 | 复用现有 `release_ledger_quota` |

是否单独设立“Vibe 额度池”？建议**先复用 `usage_ledger`**，在 `action_type` 字段区分 `vibe_run`。

---

## 六、前端设计

### 6.1 `/vibe` 页面信息架构

```text
┌─────────────────────────────────────────────────────────────┐
│  Topbar（复用，标题“Vibe 交易”）                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 欢迎区 / 会话标题                                    │   │
│  │  推荐问题卡片（横向滚动）                            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 聊天流                                               │   │
│  │  ├─ user: 自然语言消息                              │   │
│  │  ├─ assistant: 文本 / 信号卡片 / 风控卡片 / 回测卡片 │   │
│  │  ├─ tool_call: 实时工具调用状态（折叠/展开）         │   │
│  │  └─ error: 失败提示                                  │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ 输入区                                               │   │
│  │  ├─ 文本输入框（多行，支持 Enter 发送）             │   │
│  │  ├─ 快捷上下文按钮（引用最新分析 / 引用仓位配置）   │   │
│  │  └─ 发送 / 停止 按钮                                 │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 推荐问题卡片

基于当前用户状态动态生成：

- “帮我扫描自选列表里的形成中形态”
- “基于我的仓位，0.5 WU 可以开 BTCUSDT 吗？”
- “解释刚刚 AAPL 的分析结果”
- “对 ETHUSDT 1h 的做多信号做 30 天回测”

### 6.3 Dashboard 内嵌 Vibe 快捷条

在 `/dashboard` 的 `AnalyzeForm` 与 `ResultPanel` 之间插入一个窄条：

```text
┌────────────────────────────────────────────┐
│ 🤖 用自然语言提问，例如“帮我分析 BTCUSDT 1h” │
│ [输入框] [→]                                │
└────────────────────────────────────────────┘
```

点击“→”跳转 `/vibe?prompt=...&market=binance&symbol=BTCUSDT&interval=1h`，自动带入上下文。

### 6.4 新增组件清单

```text
frontend/
├── app/
│   └── vibe/
│       └── page.tsx                    # Vibe 工作台页面
├── components/
│   ├── vibe/
│   │   ├── vibe-chat.tsx               # 聊天容器
│   │   ├── vibe-message.tsx            # 单条消息渲染
│   │   ├── vibe-tool-call-card.tsx     # 工具调用实时卡片
│   │   ├── vibe-suggestion-chips.tsx   # 推荐问题
│   │   ├── vibe-composer.tsx           # 输入框
│   │   └── vibe-welcome.tsx            # 欢迎区
│   └── dashboard/
│       └── vibe-quick-bar.tsx          # Dashboard 快捷条
├── hooks/
│   └── use-vibe.ts                     # Vibe 会话 + SSE 管理
├── lib/
│   └── api-vibe.ts                     # /api/vibe/* 请求封装
└── types/
    └── vibe.ts                         # Vibe 相关类型
```

---

## 七、后端实现要点

### 7.1 API 路由

| 方法 | 路由 | 说明 |
|------|------|------|
| POST | `/api/vibe/sessions` | 创建新会话，返回 session_id |
| GET  | `/api/vibe/sessions` | 列出当前用户会话（分页） |
| GET  | `/api/vibe/sessions/<id>` | 获取会话元数据 |
| DELETE | `/api/vibe/sessions/<id>` | 归档/删除会话 |
| GET  | `/api/vibe/sessions/<id>/messages` | SSE 流式对话（核心） |
| POST | `/api/vibe/sessions/<id>/messages` | 非流式发送消息 |
| POST | `/api/vibe/tools/<name>` | 直接调用某个工具（调试用，也供前端某些固定操作） |

### 7.2 SSE 事件格式

```json
// 工具调用开始
{"type": "tool_call_start", "call_id": "call_xxx", "tool": "analyze_harmonic", "input": {"symbol": "BTCUSDT"}}

// 工具调用结束
{"type": "tool_call_end", "call_id": "call_xxx", "output": {"status": "completed", "summary": "..."}}

// 文本片段（流式）
{"type": "delta", "content": "从技术面看"}

// 结构化卡片
{"type": "card", "card_type": "signal", "payload": {"direction": "long", ...}}

// 完成
{"type": "done", "run_id": "...", "input_tokens": 1200, "output_tokens": 800}

// 错误
{"type": "error", "code": "MODEL_ERROR", "message": "...", "retryable": true}
```

### 7.3 工具签名示例

以 `analyze_harmonic` 为例：

```json
{
  "type": "function",
  "function": {
    "name": "analyze_harmonic",
    "description": "对指定标的运行谐波形态与背离检测",
    "parameters": {
      "type": "object",
      "properties": {
        "market": {"type": "string", "enum": ["binance", "yahoo"]},
        "symbol": {"type": "string"},
        "interval": {"type": "string", "enum": ["15m", "1h", "4h", "1d", "1w"]},
        "analysis_type": {"type": "string", "enum": ["auto", "forming", "formed", "divergence"]},
        "candles": {"type": "integer", "default": 1000}
      },
      "required": ["market", "symbol", "interval"]
    }
  }
}
```

### 7.4 与现有分析流程的复用

`analyze_harmonic` 工具内部应直接调用 `AnalysisOrchestrator.analyze(...)`，但做以下调整：

- 不生成完整图表上传（节省配额/时间），只返回技术结果和缩略图或图表 URL；
- 异常时返回结构化错误，不抛异常中断 Agent；
- 输出字段需适配 Agent 可读（精简、带方向/入场/止损/目标）。

---

## 八、Phase 2~4 扩展路线

| 阶段 | 主题 | 内容 |
|------|------|------|
| **Phase 2** | 策略沙盒 | 用户用自然语言描述策略 → Agent 生成回测配置 → 运行本地回试 → 输出报告卡片 |
| **Phase 3** | 记忆与技能 | 跨会话记忆用户偏好、自选列表、仓位风格；允许保存常用指令为“技能” |
| **Phase 4** | 多 Agent / MCP | 引入 swarm 模式（投研/风控/执行角色）；对外暴露 MCP Server |
| **Phase 5** | 券商连接（远期） | 在严格的安全边界（沙箱、模拟盘、kill switch、mandate）下连接券商，仅用于查询/模拟下单 |

**Phase 5 之前绝不触碰真实资金。**

---

## 九、测试与质量

### 9.1 测试矩阵

| 层级 | 内容 |
|------|------|
| 单元测试 | ToolRegistry、每个 tool 的输入输出、position_check 后端复用计算 |
| 集成测试 | Orchestrator 单次运行、SSE 事件序列、数据库读写 |
| API 测试 | `/api/vibe/*` 路由、认证、配额、错误处理 |
| 前端测试 | `useVibe` hook、消息渲染、SSE 重连、卡片组件 |
| E2E | 登录 → 进入 /vibe → 提问 → 看到工具调用 → 看到信号卡片 |

### 9.2 关键验收标准

- [ ] 用户能在 `/vibe` 用自然语言完成一次谐波分析问答。
- [ ] Agent 调用 `analyze_harmonic` 后，聊天流中显示对应 SignalCard。
- [ ] 涉及仓位的问题能正确返回风控等级（Phase 1 可先做只读查询）。
- [ ] 会话历史可在重新进入 `/vibe` 时恢复。
- [ ] 每次运行都经过额度检查，失败/取消释放额度。
- [ ] 所有新增后端代码保持 ≥ 80% 覆盖率。

---

## 十、风险与缓解

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| LLM 幻觉导致错误交易建议 | 高 | 所有结论必须附带数据来源（分析 ID、日期）；界面显著提示“仅供研究，不构成投资建议” |
| 工具调用失败/超时影响体验 | 中 | 每个工具独立超时、异常隔离；失败时 Agent 用已有信息继续或明确告知用户 |
| 额度消耗不可控 | 中 | 最大迭代数限制、单次会话 token 上限、失败不扣费 |
| 真实交易误操作 | 高 | **Phase 1 不实现任何下单/券商连接**；所有输出只读 |
| 上下文过长导致成本激增 | 中 | 5 层上下文压缩：只保留最近 N 条消息 + 关键卡片摘要 |
| LLM 不支持 function-calling | 高 | 运行时检测模型能力，不支持则降级为“单轮分析 + 前端结构化提取” |
| SSE 在代理/容器中不稳定 | 中 | 默认 SSE，同时支持 POST 轮询降级；生产用 Gunicorn/gevent |
| 消息/图片数据增长过快 | 中 | 大图不存 message content，只存 chart URL；历史消息按策略归档/摘要 |
| Agent 被诱导输出危险指令 | 高 | 系统提示限定只读工具；所有输出带免责声明；禁止任何下单/转账语义工具 |

---

## 十一、实现顺序建议

1. **方案确认**：与用户确认范围、形态、额度模型。
2. **能力基线**：检测 `OPENAI_API_MODEL` 是否支持 function-calling；不支持则先实现“分析请求解析 + 单轮回复”降级路径。
3. **数据库迁移**：执行 5.1 SQL。
4. **后端计算移植**：把 `frontend/lib/position/calculator.ts` 的核心逻辑移植到 Python，确保 `position_check` 工具在后端可独立运行。
5. **后端骨架**：`VibeOrchestrator` + `ToolRegistry` + `/api/vibe/sessions` 路由 + SSE/POST 双通道。
6. **核心工具**：先实现 `analyze_harmonic`、`explain_market`；工具输出必须返回前端可渲染的 schema。
7. **前端页面**：`/vibe` + `VibeChat` + SSE 消费 + 轮询降级。
8. **扩展工具**：`position_check`、`backtest_signal`、`save_to_journal`。
9. **历史与会话恢复**：会话列表、消息重放、大图只存 URL。
10. **测试覆盖**：单元/集成/API/前端/E2E；Orchestrator 必须支持 mock LLM 以通过 CI。
11. **安全加固**：工具输入校验、用户级速率限制、输出免责声明、审计日志。
12. **文档更新**：更新 README、前端设计文档、API 文档。

---

## 十二、待确认问题

以下问题会直接影响实现细节，请产品/用户确认：

1. **模块名称**：叫“Vibe 交易”、“AI 交易助手”还是其他？
2. **入口形态** ✅ 已确认：优先独立 `/vibe` 页面。
3. **额度模型** ✅ 已确认：复用每日分析配额，单次运行扣 1 unit。
4. **LLM 模型** ✅ 已确认：复用现有 `OPENAI_API_MODEL` 环境变量。
5. **Phase 1 包含仓位联动** ✅ 已确认：Agent 可读取用户 `position_config` 与 `position_balance`，对计划交易给出风控等级与建议。
6. **是否保存会话历史到 Supabase**：还是先做本地 `localStorage` 降级？
7. **是否支持语音/图片输入**：MVP 是否只做文本？
8. **语言**：对话支持中文/英文双语，还是默认跟随用户系统语言？
9. **是否暴露为 MCP Server**：是否希望把本项目的分析能力作为 MCP 工具对外提供？
10. **回测工具的数据源**：复用 Pyharmonics 的 Yahoo/Binance 数据，还是需要扩展更多源？

---

---

## 十三、方案审计与优化建议

以下是对当前方案的独立审计。审计维度包括架构可行性、安全风控、成本、数据持久化、前端体验与可测试性。每项都给出**问题描述 + 优化建议 + 优先级**。

---

### 13.1 架构可行性

#### 问题 1：过度依赖 LLM 的 function-calling 能力
当前方案默认 Agent 通过 OpenAI function-calling 循环驱动工具。但项目现有的 `query_openai` 仅调用普通 chat completion，且用户配置的 `OPENAI_API_MODEL` 可能是 DeepSeek、Kimi、GPT-3.5 等，**并非所有模型都稳定支持 tool-calling**，或各厂商的工具调用字段存在差异。

**优化建议：**
- 在 `VibeOrchestrator` 初始化时增加 **模型能力探测**（capability probe）：先发送一个带 `tools` 的 cheap 请求，根据返回判断是否支持工具调用。
- 对不支持 function-calling 的模型，提供**降级路径**（已确认）：把工具描述拼进 system prompt，让 LLM 以 markdown/JSON 形式输出 `"tool": "analyze_harmonic"` 等意图，后端用正则/JSON 解析后执行。
- 把 tool schema 与 LLM 调用层解耦：`ToolRegistry` 返回 schema，`LLMProvider` 决定如何序列化（OpenAI tools / Anthropic tools / prompt-injection）。

**优先级：P0**

#### 问题 2：SSE 在生产环境不稳定
Flask 默认开发服务器对长连接支持有限；在 Docker/Nginx/Cloudflare 等代理后，SSE 容易被缓冲或断开。移动端/弱网场景下用户体验会受损。

**优化建议：**
- `/api/vibe/sessions/<id>/messages` 同时支持两种模式：
  - **SSE 模式**：`Accept: text/event-stream`，实时推送。
  - **POST 轮询模式**：一次性返回 `run_id`，前端通过 `GET /api/vibe/runs/<run_id>/events` 轮询事件队列（Redis/list）。
- 前端实现自动重连 + `Last-Event-ID`；重连失败时降级为轮询。
- 生产部署文档中明确要求使用 **Gunicorn + gevent/eventlet** 或迁移到 ASGI（如 FastAPI）以支持长连接。

**优先级：P1**

#### 问题 3：Flask 全局状态与并发
`AnalysisOrchestrator` 目前是单例全局对象。如果 Vibe 运行是长时间运行的 Agent 循环，会阻塞请求线程，影响 `/api/health`、普通分析等接口。

**优化建议：**
- 把 Agent 运行拆分为**异步任务**（已确认）：使用 **Redis + RQ**（推荐）或 Celery。HTTP 层只负责启动运行和拉取事件。
- 每个运行有独立的 `run_id`，前端通过事件流或轮询获取状态。
- 限制单用户并发运行数（如最多 2 个），防止资源耗尽。

**优先级：P1**

---

### 13.2 安全与风控

#### 问题 4：工具输入缺乏严格校验
`analyze_harmonic` 等工具的 `symbol` 参数直接传给 Pyharmonics/Yahoo/Binance。恶意输入可能导致 SSRF（虽然当前数据源限制较严），或产生大量无效请求。

**优化建议：**
- 每个工具增加 `InputValidator`：
  - `symbol`：白名单/黑名单字符、长度限制、拒绝 URL/路径 traversal。
  - `interval`：严格 enum。
  - `candles`、`limit_to`：边界检查。
- 对网络请求类工具统一设置超时、重试、失败熔断。
- 增加用户级速率限制：例如每用户每分钟最多 30 次工具调用，防止刷额度/刷数据。

**优先级：P0**

#### 问题 5：LLM 可能被诱导输出危险交易指令
虽然 Phase 1 不连接交易所，但用户可能通过 prompt injection 让 Agent “模拟下单”或给出高风险建议。系统提示若没有明确边界，Agent 可能输出“建议 all in”等不负责任的结论。

**优化建议：**
- system prompt 明确约束：
  - 只做市场分析、信号生成、风控提示、日志记录。
  - 禁止提供具体杠杆倍数、满仓建议、借贷/配资建议。
  - 任何涉及资金的操作必须引导用户去 `/position` 做 what-if 模拟。
- 输出层增加 **内容安全检查**：对回复做关键词扫描（如“全仓”“梭哈”“借钱”），触发时追加风险提示。
- 所有 SignalCard 必须同时显示止损价，且默认 RR ≥ 1.5 才展示为“可关注”，否则标注为“风险收益比不佳”。

**优先级：P0**

#### 问题 6：审计日志不足
`vibe_runs` 表记录了工具调用链，但没有明确记录用户原始输入、模型版本、系统提示版本、关键决策依据。后续出现纠纷或需要复盘时信息不够。

**优化建议：**
- `vibe_runs` 增加字段：
  - `user_prompt`：用户原始输入。
  - `system_prompt_version`：提示版本号。
  - `model`：实际调用的模型名。
  - `decision_basis`：Agent 最终结论所依赖的工具调用摘要。
- 关键安全事件（如检测到 prompt injection、拒绝危险指令）单独写入 `audit_log`。

**优先级：P1**

---

### 13.3 成本与额度

#### 问题 7：“单次运行扣 1 unit”过于粗放
一个复杂问题可能触发 5 次工具调用 + 3 轮 LLM，而一个简单问题只调用 1 次。统一扣 1 unit 会导致成本不均，也限制了后续精细化运营。

**优化建议：**
- Phase 1 仍采用“1 unit/运行”的简化模型，但**在运行结束时记录实际消耗**：
  - LLM token 数（input/output）。
  - 工具调用次数。
  - 数据获取耗时。
- 后台增加 `vibe_usage_stats` 视图，用于观察真实成本。
- Phase 2 引入 **动态额度**：
  - 基础 1 unit + 每多一次 LLM 调用 +0.2 unit + 每多一次复杂工具（回测）+0.5 unit。
  - 设置单次运行上限（如最多 5 unit），防止恶意消耗。

**优先级：P1**

#### 问题 8：上下文窗口成本未加控制
多轮会话会不断追加消息。若用户连续对话 50 轮，token 成本会指数级上升，且可能超出模型上下文限制。

**优化建议：**
- 实现**会话上下文压缩策略**：
  - 保留最近 6 轮用户/助手消息。
  - 更早的消息压缩为“会话摘要”（由 LLM 或规则生成），只保留关键事实：当前关注的标的、已确认的信号、仓位配置摘要。
  - 工具调用结果若已渲染为卡片，后续只保留卡片摘要，不保留完整 JSON。
- 单条消息大小限制：工具输出超过 8K token 时，由 Tool 层自动摘要后再传给 LLM。

**优先级：P1**

---

### 13.4 数据持久化

#### 问题 9：消息表可能快速增长
`vibe_messages.content` 存储完整文本，`tool_output` 存储完整工具返回。如果工具返回大量 OHLCV 数据或多次运行，数据库体积会迅速膨胀。

**优化建议：**
- **工具输出分层存储**：
  - 原始完整输出存入对象存储（Supabase Storage / S3）或单独的 `vibe_tool_outputs` 表，按 TTL 过期。
  - `vibe_messages.tool_output` 只存摘要（< 2KB）和指向完整输出的引用。
- **图表不存入消息内容**：只存 `chart_url`，URL 过期后由前端按 `analysis_id` 重新获取。
- **归档策略**：已完成且 30 天未访问的会话，自动将消息压缩为摘要，释放原始消息。

**优先级：P2**

#### 问题 10：会话标题与搜索
当前 `vibe_sessions.title` 未说明如何生成。如果标题为空，用户很难在历史列表中定位会话。

**优化建议：**
- 首次用户消息后，由 LLM 生成一句话标题（≤ 20 字），异步更新 `title`。
- 为 `vibe_messages.content` 增加 FTS5/GIN 索引，支持会话内容搜索。
- 历史列表展示：标题 + 最后一条消息摘要 + 时间。

**优先级：P2**

---

### 13.5 前端与用户体验

#### 问题 11：移动端聊天体验未细化
当前方案主要按桌面端设计。在手机上，键盘弹起、输入框位置、工具调用卡片的展开都会影响可用性。

**优化建议：**
- 采用 **mobile-first** 布局：输入区固定在底部，聊天流 `padding-bottom` 随键盘高度调整。
- 工具调用卡片默认折叠，只显示工具名和状态；用户可点击展开。
- SignalCard 在移动端垂直堆叠，避免横向信息过密。
- 提供“一键复制结论”按钮，方便用户粘贴到备忘录或社交应用。

**优先级：P1**

#### 问题 12：新用户冷启动问题
用户第一次进入 `/vibe` 时不知道能问什么，容易流失。

**优化建议：**
- 欢迎区根据用户已有数据动态生成推荐问题：
  - 若用户已保存仓位配置：优先展示“检查仓位”类问题。
  - 若用户有最近分析：优先展示“追问该分析”类问题。
  - 否则展示通用问题：BTCUSDT / AAPL / ETHUSDT 等。
- 提供“示例指令模板”：
  - “分析 [symbol] [interval] 的形态”
  - “检查 [size] WU 买 [symbol] 是否超配”
  - “对 [symbol] 的 [方向] 信号做 30 天回测”

**优先级：P1**

#### 问题 13：流式输出状态管理复杂
SSE 事件类型多（delta/tool_call/card/done/error），前端需要维护完整状态机，容易出现消息错位、重复渲染。

**优化建议：**
- 定义统一的前端事件 schema，所有事件必须带 `run_id` 和 `event_id`。
- `useVibe` hook 内部用 reducer 管理消息列表，按 `event_id` 去重。
- 对 tool_call 事件采用“乐观占位”：收到 `tool_call_start` 时先渲染 loading 卡片，`tool_call_end` 时填充结果。
- 取消/停止按钮必须真正中断后端运行（通过 `DELETE /api/vibe/runs/<run_id>`），而不是仅前端停止渲染。

**优先级：P1**

---

### 13.6 测试与可维护性

#### 问题 14：LLM 调用难以测试
如果测试依赖真实 LLM，CI 会不稳定、成本高、耗时长。

**优化建议：**
- `VibeOrchestrator` 设计为 **LLMProvider 可注入**。
- 测试使用 `MockLLMProvider`，按固定剧本返回工具调用或文本，验证：
  - 工具调用序列正确。
  - SSE 事件顺序正确。
  - 额度扣减/释放正确。
  - 异常场景（工具失败、超时、无效 tool_call）处理正确。
- 真实 LLM 的冒烟测试标记为 `@pytest.mark.integration`，默认不跑。

**优先级：P0**

#### 问题 15：工具输出 schema 演进缺少版本管理
随着 Phase 2/3 扩展，工具输出字段会增加。前端卡片组件需要知道 schema 版本。

**优化建议：**
- 每个工具输出增加 `schema_version` 字段（如 `analyze_harmonic_output_v1`）。
- 前端渲染函数按 schema_version 分发，避免新旧数据混用导致 UI 崩溃。
- 在 CI 中增加 schema 兼容性检查：工具单测必须覆盖所有 declared output 字段。

**优先级：P2**

#### 问题 16：可观测性不足
Agent 运行黑盒化后，排查“为什么 Agent 没有调用某个工具”或“为什么输出不符合预期”会很困难。

**优化建议：**
- 每次运行生成 `trace.json`（已确认允许保存）：包含完整 messages 列表、每次 LLM 请求/响应、工具调用输入输出、耗时。
- trace 存储路径：`/tmp/vibe_traces/<run_id>.json`（开发）或对象存储（生产）。
- `vibe_runs` 表扩展 `raw_request`、`raw_response` 字段（按用户隔离）。
- 提供调试端点：`/api/vibe/runs/<run_id>/trace`（仅本用户或管理员）。
- 关键指标上报：运行数、平均工具调用次数、LLM token 消耗、失败率、平均耗时。

**优先级：P2**

---

### 13.7 最值得优先落地的 5 项优化

按性价比排序，建议在编码前先落地：

| 优先级 | 优化项 | 原因 |
|--------|--------|------|
| P0 | **模型能力探测 + 降级路径** | 决定整个 Agent 循环是否能跑通 |
| P0 | **LLMProvider 可注入 + Mock 测试** | 保证 CI 稳定、可维护 |
| P0 | **工具输入校验 + 用户级限流** | 安全基线 |
| P1 | **后端实现 `position_check` 计算** | 已确认要做仓位联动，必须先把前端计算搬到后端 |
| P1 | **SSE + 轮询双通道 + 取消机制** | 生产可用性与用户体验 |

---

## 十四、审计后更新的待确认问题

在 12 节基础上，补充审计发现的关键问题：

11. **prompt-injection 降级路径** ✅ 已确认：允许。当模型不支持 function-calling 时，通过 system prompt 注入工具描述，让 LLM 以 JSON/markdown 输出意图，后端解析执行。
12. **后台任务队列** ✅ 已确认：引入。Agent 运行放入后台队列（推荐 Redis + RQ，与 Flask 集成简单），HTTP 层只负责启动与拉取事件。
13. **trace 与原始 LLM 响应保存** ✅ 已确认：允许保存。`vibe_runs` 扩展字段记录原始请求/响应；trace 文件按用户隔离，仅本用户和管理员可访问。
14. **回测工具时间区间** ✅ 已确认：提供默认模板（30/90/180 天），同时允许用户自定义区间（受数据可用性和最大窗口限制）。
15. **是否对 Vibe 输出做 A/B 或质量评估**？例如让 LLM 自动给每次回复打“可执行性分数”。

---

*方案已完成审计与优化建议，等待进一步确认。*

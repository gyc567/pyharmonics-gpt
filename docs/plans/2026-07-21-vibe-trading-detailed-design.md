# Vibe Trading 模块详细设计文档

> 状态：基于已确认方案输出的详细设计  
> 依赖方案：`2026-07-21-vibe-trading-module-plan.md`  
> 范围：Phase 1（MVP）  
> 产品显示名称：**AI 交易助手**（内部技术代号 Vibe，路由/表名保留 `vibe_` 前缀）  
> 原则：只输出设计，不写实现代码

---

## 一、设计前提（已确认决策汇总）

| 决策项 | 已确认内容 |
|--------|------------|
| 入口 | 独立页面 `/vibe`，Sidebar 新增导航“AI 交易助手” |
| 额度 | 复用 `usage_ledger`，单次运行扣 1 unit，失败/取消释放 |
| LLM | 复用 `OPENAI_API_MODEL`；支持 function-calling 与 prompt-injection 降级 |
| 仓位联动 | Agent 读取 `profiles.position_config` / `position_balance` 做只读风控检查 |
| 运行方式 | Redis + RQ 后台队列；HTTP 层启动运行 + SSE/轮询双通道 |
| 持久化 | **本地 `localStorage` 优先 + 异步同步 Supabase**；后端表结构与 Supabase 一致，用于多设备同步与备份 |
| Trace | 允许保存原始 LLM 请求/响应与 trace，按用户隔离 |
| MCP | **Phase 1 预留 MCP Server 接口**，暴露分析类工具给外部客户端 |
| 回测 | 默认 30/90/180 天模板，支持用户自定义区间 |
| 安全 | Phase 1 只读工具，禁止任何资金操作 |

---

## 二、产品名称、语言与品牌

### 2.1 产品名称

- **对外显示名称**：AI 交易助手
- **内部技术代号**：Vibe（表名、路由、组件名保留 `vibe_` / `Vibe` 前缀）
- **Sidebar 导航文案**：`AI 交易助手`
- **页面标题**：`AI 交易助手 · Pyharmonics`
- **空状态欢迎语**：`我是你的 AI 交易助手，可以帮你分析形态、检查仓位、回测信号。`

### 2.2 语言策略

- **默认语言：中文（zh-CN）**。
- 所有系统提示、界面文案、工具描述、错误信息默认使用中文。
- LLM 系统提示中明确要求：用户用中文提问时用中文回答，用户用英文提问时可用英文回答，但默认优先中文。
- 前端 `lang="zh-CN"` 已存在，无需改动。

---

## 三、API 接口设计

### 2.1 接口总览

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/vibe/sessions` | 创建会话 |
| GET | `/api/vibe/sessions` | 列会话（分页） |
| GET | `/api/vibe/sessions/<id>` | 获取会话元数据 |
| DELETE | `/api/vibe/sessions/<id>` | 软删除/归档会话 |
| GET | `/api/vibe/sessions/<id>/messages` | SSE 流式对话 |
| POST | `/api/vibe/sessions/<id>/messages` | 非流式发送消息，返回 `run_id` |
| GET | `/api/vibe/runs/<id>` | 获取运行元数据 |
| GET | `/api/vibe/runs/<id>/events` | 轮询运行事件 |
| DELETE | `/api/vibe/runs/<id>` | 取消运行 |
| GET | `/api/vibe/runs/<id>/trace` | 获取运行 trace（仅本人/管理员） |
| POST | `/api/vibe/tools/<name>` | 直接调用单个工具（调试/固定操作） |

所有接口需 Bearer Token，走现有 `@require_auth` 中间件。

---

### 2.2 创建会话

**Request**

```json
POST /api/vibe/sessions
{
  "title": "可选标题，为空时后端自动生成",
  "context": {
    "default_market": "binance",
    "default_symbol": "BTCUSDT"
  }
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "title": "BTCUSDT 1h 分析",
    "status": "active",
    "context": {"default_market": "binance", "default_symbol": "BTCUSDT"},
    "created_at": "2026-07-21T10:00:00Z",
    "updated_at": "2026-07-21T10:00:00Z"
  }
}
```

**规则**
- `title` 为空时，后端在用户首次发送消息后再异步生成。
- `context` 用于存储会话级默认市场/标的、自选列表等，Agent 系统提示可引用。

---

### 2.3 发送消息（流式）

**Request**

```json
GET /api/vibe/sessions/<session_id>/messages?stream=true
Headers: Authorization: Bearer <token>
```

请求体通过 `POST` 同一地址携带：

```json
POST /api/vibe/sessions/<session_id>/messages
{
  "content": "帮我分析 BTCUSDT 1h 的形成中形态",
  "attachments": []
}
```

> 注：SSE 无法直接带 body，实际实现时前端用 `POST` 发送内容，后端返回 `text/event-stream`，或在 URL query 中携带简化内容。推荐实现：**POST 提交消息并启动运行，返回 SSE 流**。

**SSE 事件流**

```text
event: run_started
data: {"run_id": "run_uuid", "status": "running"}

event: tool_call_start
data: {"event_id": "evt_1", "run_id": "run_uuid", "call_id": "call_abc", "tool": "analyze_harmonic", "input": {"symbol": "BTCUSDT", "interval": "1h"}}

event: tool_call_end
data: {"event_id": "evt_2", "run_id": "run_uuid", "call_id": "call_abc", "tool": "analyze_harmonic", "output": {"status": "completed", "direction": "bullish", "pattern": "gartley"}}

event: delta
data: {"event_id": "evt_3", "run_id": "run_uuid", "content": "从技术面看，"}

event: delta
data: {"event_id": "evt_4", "run_id": "run_uuid", "content": "BTCUSDT 1h 形成一个看涨的 Gartley 形态。"}

event: card
data: {"event_id": "evt_5", "run_id": "run_uuid", "card_type": "signal", "payload": {"direction": "long", "entry_price": 67500, "stop_loss": 66800, "target_price": 69000, "rr": 2.14}}

event: done
data: {"run_id": "run_uuid", "status": "completed", "input_tokens": 1200, "output_tokens": 800, "duration_ms": 4500}

event: error
data: {"run_id": "run_uuid", "code": "MODEL_ERROR", "message": "模型调用失败", "retryable": true}
```

**SSE 重连**
- 支持 `Last-Event-ID` header，断开后从 `event_id` 之后重放事件。
- 后端事件队列保留最近 5 分钟事件。

---

### 2.4 发送消息（非流式 / 轮询）

**Request**

```json
POST /api/vibe/sessions/<session_id>/messages
Headers: Accept: application/json
{
  "content": "帮我分析 BTCUSDT 1h 的形成中形态"
}
```

**Response 202**

```json
{
  "success": true,
  "data": {
    "run_id": "run_uuid",
    "status": "running"
  }
}
```

前端随后通过 `GET /api/vibe/runs/<run_id>/events` 轮询。

---

### 2.5 轮询运行事件

**Request**

```text
GET /api/vibe/runs/<run_id>/events?after=<last_event_id>&limit=50
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "run_id": "run_uuid",
    "status": "running",
    "events": [
      {"event_id": "evt_1", "type": "tool_call_start", ...},
      {"event_id": "evt_2", "type": "tool_call_end", ...}
    ],
    "has_more": true
  }
}
```

---

### 2.6 取消运行

**Request**

```text
DELETE /api/vibe/runs/<run_id>
```

**Response 200**

```json
{
  "success": true,
  "data": {"run_id": "run_uuid", "status": "cancelled"}
}
```

后端通过 RQ 的 `job.cancel()` 或 kill signal 终止运行，释放额度。

---

### 2.7 直接调用工具

**Request**

```json
POST /api/vibe/tools/analyze_harmonic
{
  "market": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "analysis_type": "forming"
}
```

**Response 200**

```json
{
  "success": true,
  "data": {
    "schema_version": "analyze_harmonic_output_v1",
    "status": "completed",
    "market": "binance",
    "symbol": "BTCUSDT",
    "interval": "1h",
    "direction": "bullish",
    "pattern_family": "xabcd",
    "pattern_type": "gartley",
    "confidence": "medium",
    "entry_price": 67500,
    "stop_loss": 66800,
    "target_price": 69000,
    "risk_reward_ratio": 2.14,
    "signal": {...},
    "chart_url": "/api/charts/<analysis_id>.png"
  }
}
```

---

## 四、持久化策略

### 3.0 本地缓存优先 + 异步同步

**已确认**：Phase 1 会话历史先写入浏览器 `localStorage`，再异步同步到 Supabase。

**原因**：
- 减少 Supabase 写入次数，降低延迟与成本。
- 用户在弱网或无网络环境下仍可查看历史。
- 额度检查仍走后端，不影响安全与配额逻辑。

**策略细节**：

| 场景 | 行为 |
|------|------|
| 创建会话 | 先写 `localStorage`，后台异步 POST `/api/vibe/sessions` 创建 Supabase 记录 |
| 发送消息 | 立即写入 `localStorage`；Agent 运行完成后，批量同步本轮消息到 Supabase |
| 刷新页面 | 优先从 `localStorage` 恢复会话列表与消息；若本地为空，再请求 Supabase |
| 多设备同步 | 登录时拉取 Supabase 会话列表，与本地合并（以更新时间为准） |
| 清空本地数据 | 提供“同步到云端”按钮，强制全量上传；用户登出时可选清空本地缓存 |

**localStorage 键名**：
- `pyharmonics:vibe:sessions`：会话列表摘要。
- `pyharmonics:vibe:messages:<session_id>`：单会话消息数组。
- `pyharmonics:vibe:draft`：未发送的输入框草稿。

**冲突解决**：
- 以 `updated_at` 时间戳为准，本地较新则上传云端，云端较新则下载覆盖本地。
- 合并时按 `event_id` / `id` 去重。

---

## 五、数据库详细设计

### 3.1 表结构

#### `vibe_sessions`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 会话 ID |
| `user_id` | UUID | FK → profiles(id), NOT NULL | 所属用户 |
| `title` | TEXT |  | 会话标题，自动生成 |
| `status` | TEXT | NOT NULL DEFAULT 'active' | active / archived / deleted |
| `context` | JSONB | DEFAULT '{}' | 会话上下文 |
| `summary` | TEXT |  | 会话摘要（用于上下文压缩）|
| `message_count` | INTEGER | DEFAULT 0 | 消息数缓存 |
| `last_message_at` | TIMESTAMPTZ |  | 最后消息时间 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `updated_at` | TIMESTAMPTZ | DEFAULT NOW() | 更新时间 |

**索引**
- `vibe_sessions_user_id_created_at_idx` on (`user_id`, `created_at DESC`)
- `vibe_sessions_last_message_at_idx` on (`user_id`, `last_message_at DESC`)

**RLS Policy**
```sql
CREATE POLICY "Users can manage own vibe sessions" ON vibe_sessions
    FOR ALL USING (auth.uid() = user_id);
```

---

#### `vibe_messages`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 消息 ID |
| `session_id` | UUID | FK → vibe_sessions(id), NOT NULL | 所属会话 |
| `run_id` | UUID | FK → vibe_runs(id) | 关联运行 |
| `role` | TEXT | NOT NULL | system / user / assistant / tool |
| `content` | TEXT |  | 文本内容 |
| `tool_calls` | JSONB |  | assistant 的 tool_calls 列表 |
| `tool_call_id` | TEXT |  | tool result 对应的 call_id |
| `tool_name` | TEXT |  | 工具名（role=tool 时）|
| `tool_input` | JSONB |  | 工具输入摘要 |
| `tool_output_ref` | TEXT |  | 指向完整 tool_output 的引用 |
| `tool_output_summary` | JSONB |  | 工具输出摘要（用于前端渲染）|
| `cards` | JSONB |  | 前端渲染卡片数组 |
| `event_id` | TEXT |  | 对应 SSE event_id，用于重连去重 |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |

**索引**
- `vibe_messages_session_id_created_at_idx` on (`session_id`, `created_at DESC`)
- `vibe_messages_run_id_idx` on (`run_id`)

**RLS Policy**
```sql
CREATE POLICY "Users can read own vibe messages" ON vibe_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM vibe_sessions s
            WHERE s.id = vibe_messages.session_id AND s.user_id = auth.uid()
        )
    );
```

---

#### `vibe_runs`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | UUID | PK | 运行 ID |
| `session_id` | UUID | FK → vibe_sessions(id), NOT NULL | 所属会话 |
| `user_id` | UUID | FK → profiles(id), NOT NULL | 所属用户 |
| `status` | TEXT | NOT NULL | running / completed / failed / cancelled |
| `tool_trace` | JSONB | DEFAULT '[]' | 工具调用链摘要 |
| `input_tokens` | INTEGER |  | LLM input tokens |
| `output_tokens` | INTEGER |  | LLM output tokens |
| `duration_ms` | INTEGER |  | 运行耗时 |
| `user_prompt` | TEXT |  | 用户原始输入 |
| `system_prompt_version` | TEXT |  | 系统提示版本 |
| `model` | TEXT |  | 实际调用模型 |
| `decision_basis` | JSONB |  | 决策依据摘要 |
| `raw_request` | JSONB |  | 原始请求（可选，受隐私配置控制）|
| `raw_response` | JSONB |  | 原始响应（可选）|
| `error` | TEXT |  | 错误信息 |
| `cancelled_by` | UUID |  | 取消者用户 ID |
| `created_at` | TIMESTAMPTZ | DEFAULT NOW() | 创建时间 |
| `completed_at` | TIMESTAMPTZ |  | 完成时间 |

**索引**
- `vibe_runs_user_id_created_at_idx` on (`user_id`, `created_at DESC`)
- `vibe_runs_session_id_idx` on (`session_id`)

**RLS Policy**
```sql
CREATE POLICY "Users can read own vibe runs" ON vibe_runs
    FOR ALL USING (auth.uid() = user_id);
```

---

### 3.2 完整 SQL 迁移

```sql
-- 1. Vibe 会话
CREATE TABLE IF NOT EXISTS vibe_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    context JSONB DEFAULT '{}',
    summary TEXT,
    message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vibe_sessions_user_id_created_at_idx
    ON vibe_sessions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vibe_sessions_last_message_at_idx
    ON vibe_sessions (user_id, last_message_at DESC);

ALTER TABLE vibe_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can manage own vibe sessions" ON vibe_sessions;
CREATE POLICY "Users can manage own vibe sessions" ON vibe_sessions
    FOR ALL USING (auth.uid() = user_id);

-- 2. Vibe 消息
CREATE TABLE IF NOT EXISTS vibe_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vibe_sessions(id) ON DELETE CASCADE,
    run_id UUID REFERENCES vibe_runs(id) ON DELETE SET NULL,
    role TEXT NOT NULL,
    content TEXT,
    tool_calls JSONB,
    tool_call_id TEXT,
    tool_name TEXT,
    tool_input JSONB,
    tool_output_ref TEXT,
    tool_output_summary JSONB,
    cards JSONB,
    event_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS vibe_messages_session_id_created_at_idx
    ON vibe_messages (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vibe_messages_run_id_idx
    ON vibe_messages (run_id);

ALTER TABLE vibe_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own vibe messages" ON vibe_messages;
CREATE POLICY "Users can read own vibe messages" ON vibe_messages
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM vibe_sessions s
            WHERE s.id = vibe_messages.session_id AND s.user_id = auth.uid()
        )
    );

-- 3. Vibe 运行记录
CREATE TABLE IF NOT EXISTS vibe_runs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES vibe_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL,
    tool_trace JSONB DEFAULT '[]',
    input_tokens INTEGER,
    output_tokens INTEGER,
    duration_ms INTEGER,
    user_prompt TEXT,
    system_prompt_version TEXT,
    model TEXT,
    decision_basis JSONB,
    raw_request JSONB,
    raw_response JSONB,
    error TEXT,
    cancelled_by UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS vibe_runs_user_id_created_at_idx
    ON vibe_runs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS vibe_runs_session_id_idx
    ON vibe_runs (session_id);

ALTER TABLE vibe_runs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can read own vibe runs" ON vibe_runs;
CREATE POLICY "Users can read own vibe runs" ON vibe_runs
    FOR ALL USING (auth.uid() = user_id);

-- 4. 触发器：更新 vibe_sessions 的 message_count 和 last_message_at
CREATE OR REPLACE FUNCTION update_vibe_session_stats()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE vibe_sessions
    SET message_count = message_count + 1,
        last_message_at = NEW.created_at,
        updated_at = NOW()
    WHERE id = NEW.session_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_vibe_messages_insert ON vibe_messages;
CREATE TRIGGER trg_vibe_messages_insert
    AFTER INSERT ON vibe_messages
    FOR EACH ROW
    EXECUTE FUNCTION update_vibe_session_stats();
```

---

## 六、MCP Server 预留设计

### 5.1 预留目标

Phase 1 不实现完整 MCP Server，但后端架构需预留接口，使 Phase 2/3 能以最小改动暴露工具。

### 5.2 预留方式

- `ToolRegistry` 额外输出 **MCP-compatible tool schema**（OpenAI / Anthropic 格式均可）。
- 新增 `app/mcp/` 目录占位：
  ```text
  app/mcp/
  ├── __init__.py
  ├── server.py          # 未来 FastMCP / mcp.server 入口
  └── adapters/
      └── tool_adapter.py  # 把 ToolRegistry 转换为 MCP tools
  ```
- 每个 Tool 的 `run()` 方法不依赖 HTTP 上下文，可直接被 MCP Server 调用。
- 环境变量预留：`MCP_SERVER_ENABLED=0`，Phase 1 关闭；Phase 2 开启。

### 5.3 Phase 1 需遵守的约束

- 工具实现中禁止读取 `flask.request`；所需用户信息通过 `ToolRuntime` 注入。
- 认证上下文抽象为 `AgentContext`（user_id, session_id, run_id, role）。
- 所有工具返回值必须是可 JSON 序列化的结构化数据，不能返回 HTML/图片二进制。

---

## 七、后端组件详细设计

### 4.1 组件分层

```text
app/
├── api/
│   └── vibe_routes.py          # Flask 路由：认证、参数解析、流式响应
├── services/
│   └── vibe/
│       ├── __init__.py
│       ├── orchestrator.py     # VibeOrchestrator：Agent 运行主控
│       ├── runner.py           # 后台运行入口（RQ job）
│       ├── stream.py           # SSE / 轮询事件队列管理
│       ├── context.py          # 会话上下文压缩与摘要
│       ├── llm/
│       │   ├── provider.py     # LLMProvider 抽象接口
│       │   ├── openai_provider.py
│       │   └── prompt_provider.py  # 降级：prompt injection 解析
│       └── tools/
│           ├── registry.py     # ToolRegistry
│           ├── base.py         # Tool 基类与 schema
│           ├── analyze_harmonic.py
│           ├── build_trade_signal.py
│           ├── position_check.py
│           ├── backtest_signal.py
│           ├── explain_market.py
│           └── save_to_journal.py
├── infra/
│   ├── vibe_session_store.py   # 会话/消息/运行 CRUD
│   ├── vibe_event_store.py     # 事件队列（Redis List）
│   └── vibe_trace_store.py     # trace 文件存储
└── domain/
    └── vibe_schemas.py         # Vibe 相关 Pydantic schema
```

### 4.2 核心接口（伪接口，非实现）

#### `LLMProvider`

```python
class LLMProvider:
    name: str

    def is_tool_call_supported(self) -> bool:
        """运行时探测是否支持 tool-calling"""
        ...

    def chat(self, messages: list[dict], tools: list[dict] | None, **kwargs) -> LLMResponse:
        """发送聊天请求，返回结构化响应"""
        ...

    def count_tokens(self, text: str) -> int:
        ...
```

#### `Tool`

```python
class Tool:
    name: str
    description: str
    input_schema: dict
    output_schema: dict

    def run(self, input: dict, runtime: ToolRuntime) -> ToolOutput:
        """执行工具，返回结构化输出"""
        ...

    def validate_input(self, input: dict) -> ValidationResult:
        ...
```

#### `VibeOrchestrator`

```python
class VibeOrchestrator:
    def __init__(self, llm_provider: LLMProvider, tool_registry: ToolRegistry,
                 session_store: VibeSessionStore, event_store: VibeEventStore,
                 quota_service: QuotaService):
        ...

    def run(self, session_id: str, user_id: str, user_message: str,
            context: dict) -> str:
        """启动一次 Agent 运行，返回 run_id"""
        ...

    def cancel(self, run_id: str, cancelled_by: str) -> bool:
        ...
```

### 4.3 数据流时序

```text
用户 POST /api/vibe/sessions/<id>/messages
        │
        ▼
 vibe_routes.py
   ├─ 验证用户、session 所有权
   ├─ 保存 user message 到 vibe_messages
   ├─ 检查额度（预占 1 unit）
   ├─ 创建 vibe_runs 记录（status=running）
   └─ 提交 RQ job: vibe_runner.run(session_id, run_id, user_id, prompt)
        │
        ▼
 vibe_runner.run (RQ worker)
   ├─ 加载会话历史（最近 N 条 + 摘要）
   ├─ 构建 system prompt + messages
   ├─ 探测/选择 LLM 模式（tool-calling / prompt injection）
   ├─ 循环：
   │    LLM 调用
   │    ├─ text → 直接输出 delta
   │    └─ tool_call → event_store.publish(tool_call_start)
   │         ToolRegistry 执行工具
   │         event_store.publish(tool_call_end)
   │         追加 tool result
   │    直到终止
   ├─ 生成最终回复 + cards
   ├─ 保存 assistant message + tool messages
   ├─ 更新 vibe_runs（status, tokens, duration, trace）
   ├─ 消费额度 / 失败释放
   └─ event_store.publish(done/error)
        │
        ▼
 前端 SSE / 轮询消费事件
```

---

## 八、前端组件详细设计

### 5.1 页面与组件树

```text
app/vibe/page.tsx
└─ <VibeWorkspace>
   ├─ <VibeHeader>
   │   └─ 会话标题 + 新建会话按钮
   ├─ <VibeChat>
   │   ├─ <VibeWelcome>         (空会话时显示)
   │   │   └─ <SuggestionChips>
   │   ├─ <VibeMessageList>
   │   │   └─ <VibeMessage>
   │   │      ├─ <VibeTextBubble>
   │   │      ├─ <VibeToolCallCard>
   │   │      ├─ <SignalCard>    (复用 dashboard)
   │   │      ├─ <VibePositionCheckCard>
   │   │      ├─ <VibeBacktestCard>
   │   │      └─ <VibeSuggestionChips>
   │   └─ <VibeComposer>
   │      ├─ 上下文按钮（引用最新分析 / 引用仓位）
   │      ├─ 文本输入
   │      └─ 发送 / 停止按钮
   └─ <VibeSessionDrawer>        (可选：会话历史侧边栏)
```

### 5.2 核心 Hook：`useVibe`

职责：
- 加载会话列表与当前会话消息。
- 管理 SSE 连接：连接、重连、取消、事件去重。
- 发送消息：流式 / 非流式。
- 取消运行。

状态：
- `sessions: VibeSession[]`
- `currentSessionId: string | null`
- `messages: VibeMessage[]`
- `loading: boolean`（是否有运行中）
- `error: ApiError | null`

### 5.3 消息渲染协议

每条 `VibeMessage` 结构：

```typescript
interface VibeMessage {
  id: string;
  session_id: string;
  run_id?: string;
  role: "user" | "assistant" | "tool";
  content?: string;
  tool_call_id?: string;
  tool_name?: string;
  tool_input?: Record<string, unknown>;
  tool_output_summary?: Record<string, unknown>;
  cards?: VibeCard[];
  created_at: string;
}

type VibeCard =
  | { type: "signal"; payload: Signal }
  | { type: "position_check"; payload: PositionCheckResult }
  | { type: "backtest"; payload: BacktestResult }
  | { type: "analysis_mini"; payload: AnalysisMiniCard };
```

渲染规则：
- `role=user`：右对齐气泡，只显示 `content`。
- `role=assistant`：左对齐，依次渲染 `content` + `cards` + 推荐 chips。
- `role=tool`：默认折叠的 ToolCallCard，展示工具名、输入摘要、状态、输出摘要。

### 5.4 SSE 事件处理状态机

```text
Idle → Sending → Streaming → Completed/Failed
              ↓
         Cancelling → Cancelled
```

事件处理：
- `run_started`：设置 `loading=true`，清空当前运行的事件缓存。
- `tool_call_start`：在消息列表末尾插入一条 `role=tool` 的占位消息。
- `tool_call_end`：更新对应 tool 消息的状态和输出摘要。
- `delta`：追加到当前 assistant 消息的 `content`。
- `card`：追加到当前 assistant 消息的 `cards`。
- `done`：设置 `loading=false`。
- `error`：设置 `loading=false`，显示错误。

---

## 九、工具注册表与工具 Schema

### 6.1 ToolRegistry 职责

- 注册所有 Tool 实例。
- 根据模型能力返回合适的 schema 描述（OpenAI tools / prompt text）。
- 根据工具名分发调用。
- 统一捕获工具异常，返回 `ToolOutput.error`。

### 6.2 工具列表与 I/O

#### `analyze_harmonic`

**Input**

```json
{
  "market": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "analysis_type": "forming",
  "candles": 1000
}
```

**Output**

```json
{
  "schema_version": "analyze_harmonic_output_v1",
  "status": "completed",
  "market": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "analysis_type": "forming",
  "analysis_id": "uuid",
  "direction": "bullish",
  "pattern_family": "xabcd",
  "pattern_type": "gartley",
  "confidence": "medium",
  "entry_price": 67500.0,
  "stop_loss": 66800.0,
  "target_price": 69000.0,
  "risk_reward_ratio": 2.14,
  "signal": { /* Signal schema */ },
  "chart_url": "/api/charts/<analysis_id>.png",
  "interpretation_summary": "..."
}
```

---

#### `build_trade_signal`

**Input**

```json
{
  "market": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "analysis_type": "forming"
}
```

**Output**

```json
{
  "schema_version": "trade_signal_output_v1",
  "status": "completed",
  "signal": { /* Signal schema */ }
}
```

---

#### `position_check`

**Input**

```json
{
  "symbol": "BTCUSDT",
  "planned_trade_wu": 0.5,
  "direction": "long"
}
```

**Output**

```json
{
  "schema_version": "position_check_output_v1",
  "status": "completed",
  "symbol": "BTCUSDT",
  "planned_trade_wu": 0.5,
  "risk_level": 1,
  "risk_label": "1 级",
  "trouble": "需划转小账户备用",
  "cooldown": "暂停 5 分钟",
  "available_wu": 0.35,
  "will_use_reserve": true,
  "checks": {
    "within_small_tradable": false,
    "within_small_account": true,
    "within_altcoin_limit": true,
    "within_btc_trend": true,
    "within_regular_fund": true
  },
  "suggestion": "建议减少至 0.35 WU 以内，或等待冷静清单通过。"
}
```

**实现注意**
- 后端需从 `profiles` 表读取 `position_config` 与 `position_balance`。
- 复用现有前端 `calculator.ts` 的核心公式，移植到 Python。
- 如果用户未配置仓位，返回 `status: "no_config"`，并提示前往 `/position` 设置。

---

#### `backtest_signal`

**Input**

```json
{
  "market": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "direction": "long",
  "entry_price": 67500,
  "stop_loss": 66800,
  "target_price": 69000,
  "lookback_days": 90
}
```

**Output**

```json
{
  "schema_version": "backtest_signal_output_v1",
  "status": "completed",
  "market": "binance",
  "symbol": "BTCUSDT",
  "interval": "1h",
  "lookback_days": 90,
  "start_date": "2026-04-21",
  "end_date": "2026-07-21",
  "total_signals": 12,
  "win_count": 7,
  "loss_count": 5,
  "win_rate": 0.583,
  "avg_rr": 1.85,
  "max_drawdown": 0.12,
  "profit_factor": 1.42,
  "note": "基于固定入场/止损/目标的简化回测，未考虑滑点和手续费。"
}
```

**限制** ✅ 已确认：
- `lookback_days` 上限 **365 天**，防止数据量过大。
- 如果用户未指定 `lookback_days`，Agent 默认使用 90 天模板；可在追问中要求自定义区间。

---

#### `explain_market`

**Input**

```json
{
  "context": "刚刚的 BTCUSDT 1h 分析结果",
  "question": "这个形态什么时候会失效？"
}
```

**Output**

```json
{
  "schema_version": "explain_market_output_v1",
  "status": "completed",
  "answer": "..."
}
```

---

#### `save_to_journal`

**Input**

```json
{
  "symbol": "BTCUSDT",
  "direction": "long",
  "planned_size_wu": 0.5,
  "entry_price": 67500,
  "stop_loss": 66800,
  "target_price": 69000,
  "reasoning": "Gartley 形态，偏多"
}
```

**Output**

```json
{
  "schema_version": "save_to_journal_output_v1",
  "status": "completed",
  "journal_id": "uuid",
  "message": "已保存到交易日志草稿"
}
```

**实现注意**
- 写入 `trade_readiness_logs` 表或新建 `trade_journal_drafts` 表。
- 不触发真实交易，仅作为用户备忘录。

---

## 十、Agent 循环详细设计

### 7.1 System Prompt 框架

```text
你是一位专业的技术分析助手，只提供市场研究和风险提示，不提供具体投资建议。

可用工具：
{tool_descriptions}

安全约束：
- 禁止建议用户满仓、杠杆、借贷或进行任何真实资金操作。
- 任何涉及仓位的问题必须先调用 position_check 工具检查风控等级。
- 任何交易信号必须同时给出止损价；风险收益比低于 1.0 时，必须标注“风险收益比不佳”。
- 若用户问题超出技术分析范畴，礼貌拒绝并说明范围。

会话上下文：
- 默认市场：{default_market}
- 默认标的：{default_symbol}
- 用户仓位配置摘要：{position_config_summary}

当前时间：{current_time}
```

### 7.2 循环终止条件

1. LLM 返回纯文本且不含 tool_calls。
2. 达到最大迭代数（默认 10）。
3. 工具调用失败且 LLM 决定不再重试。
4. 用户取消运行。
5. 额度/时间预算耗尽。

### 7.3 上下文压缩策略

当会话消息 token 数超过阈值（如 6000）时：

1. 保留最近 4 轮 user/assistant 对话。
2. 将更早的消息交由 LLM 生成一段摘要（包含：关注的标的、已确认的信号、仓位状态、未决问题）。
3. 用摘要替换旧消息，重新构建 messages 列表。
4. 摘要保存到 `vibe_sessions.summary`。

---

## 十一、额度与审计流程

### 8.1 单次运行额度流程

```text
1. 用户发送消息
2. 后端预占 1 unit（创建 ledger 记录，状态 pending）
3. 启动 RQ job
4. job 成功完成 → consume_ledger_quota(ledger_id, tokens)
5. job 失败/取消 → release_ledger_quota(ledger_id)
6. 写入 vibe_runs 审计记录
```

### 8.2 usage_ledger 扩展

现有 `usage_ledger` 表若存在 `action_type` 字段，新增枚举值 `vibe_run`。

单次运行记录：
- `units`: 1
- `input_tokens`: 实际 LLM input
- `output_tokens`: 实际 LLM output
- `metadata`: {"run_id", "tool_count", "session_id"}

---

## 十二、错误处理策略

### 9.1 错误分类

| 错误码 | 场景 | 前端表现 |
|--------|------|----------|
| `MODEL_ERROR` | LLM 调用失败 | 显示重试按钮 |
| `TOOL_TIMEOUT` | 工具执行超时 | 提示该工具超时，Agent 用已有信息继续 |
| `TOOL_INVALID_INPUT` | Agent 生成错误参数 | 提示参数错误，Agent 自动重试（最多 2 次）|
| `QUOTA_EXCEEDED` | 额度不足 | 禁用输入，提示明日恢复 |
| `SESSION_NOT_FOUND` | 会话不存在 | 跳转新建会话 |
| `RUN_CANCELLED` | 用户取消 | 停止渲染，保留已输出内容 |
| `INTERNAL_ERROR` | 未知错误 | 通用错误提示 + 请求 ID |

### 9.2 Agent 自我修复

- 工具调用失败时，把错误信息以 `tool` role 返回给 LLM，由 LLM 决定重试或换工具。
- 连续 2 次工具失败后，强制终止循环，返回“部分工具不可用，已根据已有信息作答”。

---

## 十三、实现文件清单

### 后端

```text
app/
├── api/
│   └── vibe_routes.py
├── domain/
│   └── vibe_schemas.py
├── services/
│   └── vibe/
│       ├── __init__.py
│       ├── orchestrator.py
│       ├── runner.py
│       ├── stream.py
│       ├── context.py
│       ├── llm/
│       │   ├── __init__.py
│       │   ├── provider.py
│       │   ├── openai_provider.py
│       │   └── prompt_provider.py
│       └── tools/
│           ├── __init__.py
│           ├── registry.py
│           ├── base.py
│           ├── analyze_harmonic.py
│           ├── build_trade_signal.py
│           ├── position_check.py
│           ├── backtest_signal.py
│           ├── explain_market.py
│           └── save_to_journal.py
├── infra/
│   ├── vibe_session_store.py
│   ├── vibe_event_store.py
│   └── vibe_trace_store.py
└── tasks/
    └── vibe_worker.py          # RQ worker 启动入口
```

### 前端

```text
frontend/
├── app/
│   └── vibe/
│       └── page.tsx
├── components/
│   ├── vibe/
│   │   ├── vibe-workspace.tsx
│   │   ├── vibe-header.tsx
│   │   ├── vibe-chat.tsx
│   │   ├── vibe-welcome.tsx
│   │   ├── vibe-message-list.tsx
│   │   ├── vibe-message.tsx
│   │   ├── vibe-text-bubble.tsx
│   │   ├── vibe-tool-call-card.tsx
│   │   ├── vibe-position-check-card.tsx
│   │   ├── vibe-backtest-card.tsx
│   │   ├── vibe-suggestion-chips.tsx
│   │   ├── vibe-composer.tsx
│   │   └── vibe-session-drawer.tsx
│   └── dashboard/
│       └── vibe-quick-link.tsx
├── hooks/
│   └── use-vibe.ts
├── lib/
│   ├── api-vibe.ts
│   └── vibe/
│       ├── event-reducer.ts
│       └── message-builder.ts
└── types/
    └── vibe.ts
```

---

## 十四、测试计划

### 11.1 后端测试

| 测试文件 | 覆盖内容 |
|----------|----------|
| `tests/test_vibe_schemas.py` | Pydantic schema 校验 |
| `tests/test_vibe_tool_registry.py` | 工具注册、schema 生成、异常隔离 |
| `tests/test_vibe_tools.py` | 每个工具的输入校验与输出 schema |
| `tests/test_vibe_orchestrator.py` | MockLLM 下的循环、工具调用序列、终止条件 |
| `tests/test_vibe_routes.py` | API 路由、认证、SSE/轮询、取消 |
| `tests/test_vibe_position_check.py` | 后端仓位计算与前端 calculator.ts 结果一致性 |

### 11.2 前端测试

| 测试文件 | 覆盖内容 |
|----------|----------|
| `frontend/hooks/use-vibe.test.tsx` | SSE 连接、消息追加、取消、错误 |
| `frontend/components/vibe/vibe-message.test.tsx` | 各类卡片渲染 |
| `frontend/components/vibe/vibe-composer.test.tsx` | 输入、发送、停止 |
| `frontend/lib/vibe/event-reducer.test.ts` | 事件去重、状态转换 |

### 11.3 E2E 测试

| 测试文件 | 覆盖内容 |
|----------|----------|
| `frontend/e2e/vibe.spec.ts` | 登录 → 进入 /vibe → 提问 → 看到 tool_call → 看到 signal card → 追问 |

---

## 十五、部署与运维补充

### 12.1 新增依赖

| 依赖 | 用途 |
|------|------|
| `rq` + `redis` | 后台任务队列 |
| `gunicorn[gevent]` | 生产 SSE 长连接 |
| `pydantic` | 已存在，用于 schema |

### 12.2 环境变量

```bash
# 已存在
OPENAI_API_KEY=
OPENAI_API_MODEL=
OPENAI_API_BASE_URL=

# 新增
REDIS_URL=redis://localhost:6379/0
VIBE_MAX_ITERATIONS=10
VIBE_TOOL_TIMEOUT_SECONDS=30
VIBE_MAX_RUN_MINUTES=5
VIBE_TRACE_RETENTION_DAYS=30
VIBE_ENABLE_RAW_TRACE=1   # 是否保存原始 LLM 请求/响应
```

### 12.3 启动命令

```bash
# 开发
python app/main.py
python app/tasks/vibe_worker.py

# 生产
gunicorn -k gevent -w 4 -b 0.0.0.0:5000 app.main:app
python app/tasks/vibe_worker.py --workers 2
```

---

## 十六、遗留问题（编码前仍需确认）

1. **模块名称** ✅ 已确认：对外显示 **AI 交易助手**，内部技术代号 Vibe。
2. **会话历史持久化策略** ✅ 已确认：**本地 `localStorage` 优先 + 异步同步 Supabase**。
3. **语言默认** ✅ 已确认：**中文（zh-CN）优先**。
4. **是否暴露 MCP Server** ✅ 已确认：**Phase 1 预留接口**，后端工具实现需解耦 HTTP 上下文。
5. **用户可自定义回测区间上限** ✅ 已确认：**最大 365 天**。

---

*详细设计完成，可作为 Phase 1 编码依据。*

# Pyharmonics SaaS Web 项目设计方案

- 日期：2026-07-14
- 状态：方案草案，等待实施
- 部署目标：Vercel
- 产品阶段：邀请制 Beta
- 已确认决策：多用户 SaaS、平台承担模型费用、结构化表单与自然语言并存、Next.js + Python Function + Supabase

## 1. 结论

将当前 Flask 技术演示升级为邀请制行情分析 SaaS。前端使用 Next.js 和 TypeScript，部署在 Vercel；现有 pyharmonics 分析能力保留在 Python Function 中；Supabase 负责身份认证、PostgreSQL、私有图表存储和实时状态。第一版采用同步分析请求，不引入独立队列或计算服务，但通过任务记录、状态机和性能门槛保留后续异步迁移路径。

推荐架构的核心原则：

1. 表单参数直接进入分析流程，不使用模型猜测用户意图。
2. 自然语言只负责填充表单，用户确认后才执行付费分析。
3. pyharmonics 只接收经过白名单和边界校验的参数。
4. 模型输出必须是结构化 JSON，页面按字段渲染，不直接渲染模型 HTML。
5. 图表上传到私有对象存储，不再以内嵌 Base64 放进 API 响应。
6. 每次分析先原子预占额度，避免双击、并发请求和恶意调用造成失控费用。
7. Beta 先验证分析质量、成功率、耗时和单次成本，再决定支付与后台任务系统。

## 2. 当前项目分析

### 2.1 已有能力

- `app/main.py` 提供 `/` 页面和 `/query` 分析接口。
- `app/openai_handler.py` 已封装 OpenAI 兼容接口，并通过 `FUNCTION_ROUTER` 限制可调用的分析函数。
- `app/pyharmonics_handler.py` 已实现 Binance、Yahoo、谐波形态、背离、仓位和图表生成。
- `prompt_intent.yaml` 已拆分参数提取与技术分析两类提示词。
- Dockerfile 和 docker-compose 可用于本地容器运行。
- `app/main.py` 位于 Vercel 支持的 Flask 入口位置，理论上可以直接部署为单个 Python Function。

### 2.2 必须解决的问题

| 问题 | 当前证据 | 用户影响 | 方案 |
|---|---|---|---|
| 页面只是单文件聊天 Demo | `app/templates/chat_ui.html` 内联 CSS/JS | 移动端、加载态、历史记录和账户能力不足 | Next.js 重做应用壳与工作台 |
| 模型输出通过 `innerHTML` 渲染 | `chat_ui.html:118` | 可能产生跨站脚本攻击 | 结构化 JSON + React 字段渲染；Markdown 必须消毒 |
| 一个请求串行执行两次模型调用和一次重计算 | `app/main.py:34-72` | 延迟高、失败点多、成本不稳定 | 表单路径取消参数提取模型调用 |
| 600 DPI PNG 转 Base64 返回 | `pyharmonics_handler.py:43,47` | 内存和响应体过大，可能超过 Vercel 4.5 MB 限制 | 降低分辨率、压缩并上传 Supabase Storage |
| 输入缺乏严格校验 | `app/main.py:26-50` | 参数越界、异常和费用滥用 | Pydantic/JSON Schema 白名单校验 |
| 错误信息直接暴露异常文本 | `app/main.py:52-89` | 泄露内部信息，用户也无法恢复 | 稳定错误码、友好提示、服务端详细日志 |
| 无用户、额度、历史与审计 | 全仓库无相关模型 | 无法作为平台付费的多用户产品运行 | Supabase Auth + PostgreSQL + 用量账本 |
| 无测试和 CI | 仓库无测试目录或配置 | 改造风险不可控 | 单元、集成、E2E、部署冒烟测试 |
| 依赖版本较旧且无 Python 版本声明 | `requirements.txt` | Vercel 构建和运行结果不可复现 | `pyproject.toml`/锁文件、Python 版本与依赖体积门槛 |

发现一个现有缺陷：`app/pyharmonics_handler.py:120` 的 `return p. yo` 会在期权兴趣路径产生运行时错误。实施前应先用回归测试锁定并修复，不能把已知错误带入新架构。

## 3. 产品范围

### 3.1 目标用户

邀请加入的交易研究用户。他们希望快速检查某个股票或加密货币在指定周期上是否存在形成中或已形成的谐波形态、背离和候选交易区间。

### 3.2 Beta 核心页面

1. `/login`：邮箱魔法链接登录，只允许已邀请邮箱。
2. `/dashboard`：结构化分析表单、自然语言快捷输入、最近分析。
3. `/analysis/[id]`：分析详情、结构化结论、图表、原始参数、再次运行。
4. `/history`：分页、按市场/标的/周期/状态筛选。
5. `/settings`：账户信息、每日额度和用量。
6. `/admin`：邀请用户、停用用户、调整额度、查看成功率、耗时和模型成本。

### 3.3 核心交互

```text
结构化路径
[市场] -> [标的] -> [周期] -> [高级参数] -> [确认] -> [分析]

自然语言路径
[输入问题] -> [模型提取结构化参数] -> [用户确认/修改] -> [分析]
```

表单建议字段：

- 市场：Binance 加密货币 / Yahoo 股票。
- 标的：如 `BTCUSDT`、`AAPL`。
- 周期：只允许 pyharmonics 和数据源共同支持的枚举值。
- 分析类型：形成中、最近形成、背离，可根据现有能力逐步开放。
- `limit_to`：限定范围并设置安全上下限。
- `percent_complete`：默认 0.8，限制在产品允许区间。
- 蜡烛数量：Beta 使用服务端配置，不对普通用户开放。

### 3.4 结果页

- 状态：完成、无结果、失败、额度不足。
- 市场与参数摘要。
- 多空倾向、形态名称、形成状态和关键价位。
- 入场、止损、目标、风险收益比。数据不足时明确显示“无法计算”，不能由模型编造。
- 结构化风险说明和模型生成的简短解读。
- 可缩放图表。
- 数据时间、模型版本、分析耗时和“仅供研究”声明。

### 3.5 Beta 成功标准

- 20 至 50 名邀请用户可以独立完成登录、分析和历史查看。
- 分析请求成功率不低于 95%，上游市场数据不可用单独统计。
- 结构化表单路径 P50 小于 20 秒、P95 小于 60 秒；超出后触发异步化评估。
- API JSON 响应小于 200 KB，单张压缩图表目标小于 1 MB。
- 不发生跨用户数据读取、服务端密钥泄露或额度绕过。
- 每次模型调用都有用户、分析 ID、token、估算费用和结果状态记录。
- Vercel Preview 与 Production 可以由同一套配置重复部署。

## 4. 架构方案与取舍

### 4.1 方案比较

| 方案 | 优点 | 缺点 | 结论 |
|---|---|---|---|
| Flask 单体 | 改动小、复用最多 | UI、鉴权、状态管理和长期维护能力弱 | 不选 |
| Next.js + Python Function + Supabase | 保留 Python 核心，SaaS 基础完整，Vercel 部署统一 | 需要管理 TypeScript/Python 边界和 Python 包体积 | 采用 |
| Vercel 前端 + 独立 Python 服务 | 计算资源和任务时长更自由 | 多一套部署、监控和成本系统 | 达到迁移门槛后再评估 |

### 4.2 目标架构

```text
┌──────────────────────────────────────────────────────────────┐
│                         Vercel                               │
│                                                              │
│  ┌──────────────────────┐       ┌─────────────────────────┐  │
│  │ Next.js Web          │       │ Python Analyze Function │  │
│  │ - 登录态与页面       │ POST  │ - 鉴权与参数校验        │  │
│  │ - 表单与结果渲染     ├──────>│ - 额度预占              │  │
│  │ - 历史与管理后台     │       │ - 行情与 pyharmonics    │  │
│  └──────────┬───────────┘       │ - 模型结构化解读        │  │
│             │                   │ - 图表压缩与上传         │  │
│             │                   └──────┬──────────┬───────┘  │
└─────────────┼──────────────────────────┼──────────┼──────────┘
              │                          │          │
              v                          v          v
┌──────────────────────────┐   ┌─────────────┐  ┌──────────────┐
│ Supabase                 │   │ Market Data │  │ OpenAI-兼容  │
│ Auth / Postgres / Storage│   │ Yahoo/Binance│ │ Model API    │
└──────────────────────────┘   └─────────────┘  └──────────────┘
```

### 4.3 边界设计

Next.js 负责：

- 页面、路由、响应式布局和可访问性。
- Supabase 登录态和服务端页面保护。
- 历史、账户和管理员界面。
- 自然语言参数提取接口及确认交互。
- 结果字段渲染，不解释 pyharmonics 内部对象。

Python Function 负责：

- 验证 Supabase 用户令牌。
- 输入归一化、白名单校验和额度预占。
- 市场数据获取、pyharmonics 运算和确定性结果转换。
- 模型结构化解读、图表生成、压缩和上传。
- 任务状态、计量、错误码和耗时记录。

Supabase 负责：

- 邀请制认证和会话。
- 带行级安全策略的数据持久化。
- 私有图表对象存储和短期签名 URL。
- 可选的分析状态订阅。

## 5. 数据模型

### 5.1 `profiles`

- `id`：对应 Auth 用户 UUID。
- `email`、`display_name`。
- `role`：`user | admin`。
- `status`：`active | suspended`。
- `daily_quota`：Beta 默认值由配置决定，建议从 5 次开始。
- `created_at`、`last_seen_at`。

### 5.2 `invites`

- `id`、`email`、`invited_by`。
- `status`：`pending | accepted | revoked | expired`。
- `expires_at`、`accepted_at`、`created_at`。

不自行存储可直接登录的明文邀请令牌。优先使用 Supabase 管理 API 发邀请，业务表只保存状态和审计信息。

### 5.3 `analyses`

- `id`、`user_id`。
- `input_mode`：`form | natural_language`。
- `market`、`symbol`、`interval`、`analysis_type`。
- `parameters`：经过校验的 JSON。
- `status`：状态机枚举。
- `technical_result`：确定性分析 JSON。
- `interpretation`：通过 JSON Schema 校验的模型结果。
- `chart_path`：私有 Storage 路径，不存长期签名 URL。
- `model_provider`、`model_name`、`prompt_version`。
- `input_tokens`、`output_tokens`、`estimated_cost_micros`。
- `error_code`、面向用户的 `error_message`；内部错误只进日志。
- `duration_ms`、`created_at`、`started_at`、`completed_at`。

### 5.4 `usage_ledger`

- `id`、`user_id`、`analysis_id`、`usage_date`。
- `units_reserved`、`units_consumed`。
- `status`：`reserved | consumed | released`。
- 模型 token 与估算费用快照。

额度通过数据库事务或 RPC 原子预占。失败请求按错误类型决定释放还是计费，避免两个并发请求同时通过余额检查。

### 5.5 `audit_events`

只记录管理员邀请、停用账号、调整额度和安全相关操作。不记录 API Key、完整提示词或敏感会话令牌。

### 5.6 状态机

```text
created
   |
   v
validating --> rejected
   |
   v
fetching_market_data --> failed_upstream
   |
   v
detecting_patterns --> no_result
   |
   v
interpreting --> failed_model
   |
   v
rendering_chart --> failed_chart
   |
   v
completed
```

所有终态都必须结算或释放额度。运行中记录超过最大允许时间后视为 `stale`，由维护任务或下一次读取修正为失败，避免界面永久显示“分析中”。

## 6. 请求与数据流

### 6.1 结构化分析

```text
浏览器
  -> 获取 Supabase 会话
  -> POST /api/analyze（令牌 + 幂等键 + 表单参数）
  -> Python 验证用户、角色、状态、参数
  -> 原子预占每日额度并创建 analyses 记录
  -> 获取行情
  -> pyharmonics 检测与确定性结果转换
  -> 调用一次模型生成结构化解读
  -> 生成低分辨率图表并上传私有 Storage
  -> 写入结果、费用和 completed 状态
  -> 返回 analysis_id 和最小结果摘要
  -> Next.js 打开 /analysis/[id]
```

### 6.2 自然语言输入

1. 调用轻量参数提取接口。
2. 模型只能返回预定义 JSON Schema：市场、标的、周期和可选参数。
3. 服务端再次校验枚举和边界。
4. 页面把结果填入表单，由用户确认。
5. 用户确认后才进入正式分析并占用分析额度。

参数提取可以单独设置更低的速率限制和模型成本上限，不能直接触发 pyharmonics 函数。

### 6.3 幂等性

客户端每次点击生成唯一幂等键。`user_id + idempotency_key` 建唯一索引。重复提交返回原分析记录，不重复预占额度或调用模型。

## 7. API 设计原则

概念接口：

- `POST /api/parse-intent`：自然语言转待确认表单参数。
- `POST /api/analyze`：执行结构化分析。
- `GET /api/analyses/:id`：获取当前用户的一条分析。
- `GET /api/analyses`：分页历史和筛选。
- `POST /api/analyses/:id/rerun`：基于旧参数创建新分析。
- `GET /api/analyses/:id/chart-url`：生成短期签名图表 URL。
- 管理接口：邀请、撤销邀请、停用用户、调整额度、汇总指标。

响应遵循统一错误结构：

```json
{
  "error": {
    "code": "MARKET_DATA_UNAVAILABLE",
    "message": "暂时无法获取该标的行情，请稍后重试。",
    "retryable": true,
    "request_id": "..."
  }
}
```

内部异常、第三方返回内容和堆栈不能直接返回浏览器。

## 8. 安全与成本控制

### 8.1 身份与权限

- 使用 Supabase Auth 邮箱邀请与魔法链接。
- 所有业务表启用行级安全，普通用户只能访问 `user_id = auth.uid()` 的记录。
- 管理员操作只允许服务端执行，并同时检查数据库角色。
- Supabase Service Role、模型 API Key 只存在于 Vercel 服务端环境变量。
- Preview、Production 使用不同 Supabase 项目或至少不同密钥与数据环境。

### 8.2 输入安全

- 请求体大小、字符串长度、symbol 格式和参数范围均设上限。
- 市场、周期、分析类型和函数路由使用枚举，不接受模型生成的任意函数名。
- 拒绝未知字段，避免参数悄悄穿透到 pyharmonics。
- 模型响应必须通过 JSON Schema；失败可以重试一次，之后返回明确错误。
- Markdown 如确有必要，只允许安全子集并经过消毒；默认按纯文本/结构化字段渲染。

### 8.3 费用保护

- 邀请制登录、每日额度、每用户短时速率限制。
- 幂等键防止双击重复消费。
- 单次请求最多一次正式分析模型调用；参数提取单独计量。
- 限制模型最大输出 token、超时和重试次数。
- 按用户、模型、状态记录 token 与估算费用。
- 设置每日平台费用预警和总熔断开关。超过阈值后停止新分析，但仍允许用户查看历史。

## 9. Vercel 部署设计

### 9.1 官方约束

截至 2026-07-14，Vercel 官方文档说明：

- Flask 可以作为单个 Python Function 部署，`app/main.py` 是支持的入口位置。
- Python Runtime 仍标记为 Beta。
- Python Function 标准未压缩包体上限为 500 MB。
- Hobby 计划函数默认与最大时长为 300 秒，Pro/Enterprise 可配置更长时长。
- Function 请求或响应体最大为 4.5 MB。
- Python 默认版本为 3.12；项目应显式声明支持版本。
- Python 不自动做依赖 tree-shaking，应只打包运行时依赖并显式排除无关文件。

参考：

- https://vercel.com/docs/functions/runtimes/python
- https://vercel.com/docs/frameworks/backend/flask
- https://vercel.com/docs/functions/limitations

### 9.2 部署配置

- 单仓库、单个 Vercel Project。
- Next.js 作为主框架，Python 分析入口放在 Vercel 可识别位置，并明确函数配置。
- Python 版本固定，依赖使用可复现锁定方式。
- `maxDuration` 初始建议 120 秒；产品超时应更短，例如 75 秒，以便返回可恢复错误。
- 函数区域与 Supabase 区域尽量同区，并验证该区域能稳定访问 Binance、Yahoo 和模型提供商。
- 静态资源放 `public/`，不经过 Flask 静态文件服务。
- 图表写 Supabase Storage，不写本地持久文件系统。

### 9.3 必须设置的环境变量

- Supabase URL、匿名公钥、服务端密钥。
- 模型 API Key、Base URL、模型名。
- 默认每日额度、平台费用阈值。
- 应用 URL、环境标识、日志采样配置。

每个变量需要明确 Preview/Production 作用域；日志中禁止输出密钥值。

### 9.4 部署门槛

上线前必须在真实 Vercel Preview 中测量：

1. Python 构建包未压缩大小。
2. 冷启动时间。
3. 1000 根蜡烛下各分析路径的 P50/P95。
4. 峰值内存。
5. PNG 生成耗时与文件大小。
6. Binance/Yahoo 从所选 Vercel 区域的可达性。
7. 模型和市场数据超时时的用户错误体验。

以下任一条件持续出现，应把 Python 分析迁移到独立计算服务或正式后台工作流：

- 包体接近 450 MB。
- P95 超过 60 秒。
- 峰值内存接近计划上限。
- 用户断开连接导致任务频繁丢失。
- 并发任务造成明显超时或成本异常。

## 10. 性能设计

- 将图表 DPI 从当前 600 调整到适合 Web 的范围，并设置最大像素尺寸。
- 优先生成压缩 PNG；实测后可评估 WebP。图表上传后释放内存。
- 不在响应里返回 Base64 图表。
- 行情和技术结果可按 `market + symbol + interval + 参数 + 数据时间窗` 做短期缓存，但 Beta 初期先测量再加缓存。
- 复用模型和 HTTP 客户端，设置连接与读取超时。
- 历史列表只读取摘要字段，不加载完整技术 JSON。
- 数据库索引至少覆盖 `analyses(user_id, created_at desc)`、状态和幂等键。
- 分页使用游标或稳定时间排序，避免历史增长后全表扫描。

## 11. 错误处理与恢复

| 失败场景 | 系统行为 | 用户体验 | 额度处理 |
|---|---|---|---|
| 未登录或账号停用 | 立即拒绝 | 跳转登录或提示联系管理员 | 不预占 |
| 参数非法 | 返回字段级错误 | 表单定位并保留输入 | 不预占 |
| 重复提交 | 返回已有任务 | 自动打开原任务 | 不重复计费 |
| 每日额度不足 | 返回额度错误 | 显示重置时间 | 不预占 |
| Binance/Yahoo 超时 | 标记上游失败 | 可重试，说明不是“无形态” | 释放 |
| 没有检测到形态 | 正常终态 `no_result` | 展示清晰空状态 | 建议计入较低单位或正常计次，Beta 中测量后确定 |
| 模型超时/格式错误 | 重试一次后失败 | 可重试，不展示原始异常 | 释放或只记录模型实际费用 |
| 图表失败 | 保留结构化结果 | 告知图表暂不可用 | 分析可视为部分成功 |
| 函数超时 | 标记或修复陈旧任务 | 允许重新运行 | 释放未完成额度 |
| Storage 上传失败 | 不写无效路径 | 结构化结果仍可查看 | 记录部分成功 |

## 12. 测试方案

### 12.1 测试栈

- Python：pytest，覆盖参数校验、行情适配、pyharmonics 转换、图表和错误映射。
- TypeScript：Vitest + React Testing Library，覆盖表单、状态、结果渲染和权限组件。
- 数据库：Supabase 本地/测试项目中的迁移、RPC 和行级安全集成测试。
- E2E：Playwright，覆盖真实浏览器主流程。
- 外部服务：默认使用固定样本和 mock；少量 Preview 冒烟测试访问真实上游。

### 12.2 覆盖图

```text
CODE PATHS                                         USER FLOWS
[GAP] 输入校验                                     [GAP][E2E] 邀请 -> 登录 -> 工作台
  ├── 合法股票/加密货币                              ├── 未邀请邮箱被拒绝
  ├── 非法 symbol/interval                           └── 会话过期重新登录
  └── 越界参数

[GAP] 额度预占                                     [GAP][E2E] 结构化分析
  ├── 正常预占与结算                                  ├── 成功结果与图表
  ├── 并发请求只成功一次                              ├── 无形态空状态
  └── 失败释放                                       └── 上游失败后重试

[GAP] pyharmonics                                  [GAP][E2E] 自然语言快捷输入
  ├── Binance/Yahoo 固定行情                           ├── 参数提取
  ├── formed/forming/divergence                       ├── 用户修改与确认
  ├── 无结果                                          └── 确认前不产生正式分析费用
  └── 已知 options_interest 回归

[GAP][EVAL] 模型结构化解读                          [GAP][E2E] 历史与权限
  ├── 完整字段                                        ├── 只看到自己的记录
  ├── 缺失/无效 JSON                                   ├── 重新运行生成新记录
  ├── 不编造缺失价位                                  └── 管理员与普通用户隔离
  └── 超时与单次重试

[GAP] 图表                                           [GAP][E2E] 费用保护
  ├── 文件尺寸上限                                    ├── 达到每日额度
  ├── 上传失败                                        ├── 双击不重复扣费
  └── 签名 URL 与跨用户隔离                           └── 平台熔断时历史仍可访问
```

新架构尚未实现，因此图中全部为计划中的测试缺口。实施时必须随功能一起补齐，不能把测试集中到最后。

### 12.3 性能与质量门槛

- Python 核心业务分支和错误路径达到接近 100% 的行为覆盖。
- 数据库额度 RPC 必须包含并发测试。
- 每次提示词或模型 Schema 修改必须运行固定行情样本的质量评估。
- E2E 至少覆盖邀请登录、成功分析、上游失败、额度耗尽、历史隔离和管理员权限。
- Preview 部署必须通过构建体积、函数时长、图表尺寸和真实上游冒烟测试。

## 13. 可观测性与运营

每个请求生成 `request_id`，贯穿浏览器、Vercel 日志、分析记录和模型用量。关键指标：

- 请求量、成功率、各错误码比例。
- 总耗时与行情、检测、模型、绘图各阶段耗时。
- 冷启动时间和函数峰值内存。
- 每用户/每日分析次数。
- 模型 token、估算费用、平均单次成本。
- 图表尺寸和上传失败率。
- 陈旧任务数量。

Beta 管理后台只展示必要汇总，详细排障使用结构化日志。不要在日志中记录完整访问令牌、API Key 或不必要的完整用户提示词。

## 14. 实施阶段

### Phase 0：锁定现有行为

- 为参数解析、函数路由、主要 pyharmonics 路径和已知错误建立回归测试。
- 使用固定行情样本，避免测试依赖实时 Yahoo/Binance。
- 测量当前图表大小、执行时间和依赖安装体积。
- 确认 pyharmonics 1.4.3 到当前 1.5.3 的兼容性；升级必须独立验证，不与架构迁移混在同一改动中。

### Phase 1：应用骨架与部署探针

- 建立 Next.js + TypeScript 应用骨架。
- 抽出 Python 分析核心，增加最小 Vercel Python 入口。
- 建立 Preview 部署，先验证 Python 构建、导入、包体、运行时间和区域访问。
- 暂不做完整 UI，先证明部署基础可行。

### Phase 2：认证与数据层

- 配置 Supabase Auth、邀请流程和会话保护。
- 建立数据库迁移、行级安全和私有 Storage。
- 实现 profiles、invites、analyses、usage_ledger、audit_events。
- 完成额度原子预占与并发测试。

### Phase 3：分析 API

- 用明确 Schema 代替模型驱动的函数路由。
- 接入行情、pyharmonics、确定性结果转换和结构化模型解读。
- 实现图表压缩、上传、错误码、幂等和用量结算。
- 加入超时、有限重试和平台熔断。

### Phase 4：用户体验

- 完成 Dashboard、自然语言填表、分析状态、结果页、历史和账户页。
- 完成移动端、键盘操作、空状态、错误恢复和加载状态。
- 明确数据时间和研究免责声明。

### Phase 5：管理、质量和发布

- 完成邀请与用户管理、成本和成功率面板。
- 补齐单元、集成、E2E、模型评估和性能测试。
- 建立 Preview/Production 环境变量清单和部署检查表。
- 邀请少量用户 Canary，观察一周后扩大 Beta。

## 15. 并行实施建议

| 工作流 | 模块 | 依赖 |
|---|---|---|
| A. Python 基线与分析 API | Python core、tests | 无 |
| B. Next.js 页面骨架 | web、components | 无 |
| C. Supabase 模型与权限 | database、auth、storage | 架构字段确认 |
| D. 前后端集成 | web、api、database | A + B + C |
| E. QA、性能与部署 | tests、Vercel config、docs | D |

执行顺序：A、B、C 可以并行；合并后执行 D；最后执行 E。A 与 D 都会触及 API 契约，应先冻结请求/响应 Schema，避免合并冲突。

## 16. 明确不在 Beta 范围内

- 订阅支付和正式套餐：先取得真实成本数据。
- 用户自带 API Key：平台统一承担模型费用。
- 自动交易、交易所下单和资金托管：安全与合规范围完全不同。
- 实时 WebSocket 行情和持续扫描：会引入常驻计算和通知系统。
- 投资组合、回测、策略市场和社交分享：不阻塞核心分析价值验证。
- 原生移动应用：先保证响应式 Web。
- 多模型自由选择：Beta 由平台固定模型，减少质量和成本变量。
- 独立队列/工作流/计算服务：只有达到迁移门槛后才引入。

## 17. 主要风险与应对

1. **Python 依赖包过大或冷启动慢**：Phase 1 先做真实 Vercel 部署探针；接近门槛时拆出独立计算服务。
2. **分析耗时影响体验**：减少一次模型调用、降低图表成本、阶段计时；P95 超过 60 秒则异步化。
3. **市场数据服务不稳定**：明确超时、可重试错误和固定样本测试；不能把上游故障显示成“没有形态”。
4. **平台 API Key 被滥用**：邀请制、额度、速率限制、幂等、费用阈值和熔断。
5. **模型生成不可靠交易价位**：确定性数据优先，缺失字段必须为空，Schema 校验和固定样本评估。
6. **金融信息责任**：明确数据时间、来源、计算假设和研究免责声明；公开发布前复核市场数据源条款与适用合规要求。
7. **同步请求中断**：任务状态持久化并修复陈旧任务；达到频率门槛后迁移后台任务。

## 18. 实施前仍需确认的默认值

以下内容不阻塞架构，可在实施开始时确定：

- Beta 每日默认额度，当前建议 5 次正式分析。
- 邀请过期时间，当前建议 7 天。
- 结果保留期，当前建议 Beta 期间长期保留，退出 Beta 后再定策略。
- 模型提供商和具体模型，由质量评估与成本基准决定。
- Supabase 与 Vercel 的具体区域，由 Binance/Yahoo 可达性和延迟测试决定。
- `no_result` 是否消耗完整额度，建议根据真实计算成本决定。

## 19. 验收定义

只有同时满足以下条件，Beta 才视为可发布：

- Preview 与 Production 均可从空环境按文档部署。
- 邀请、登录、会话过期、停用账号和管理员权限均通过 E2E。
- 用户无法读取或签名访问其他用户的分析和图表。
- 额度在双击和并发请求下不会重复消耗或透支。
- Binance 与 Yahoo 的成功、无结果、超时和无效标的均有清晰体验。
- 模型输出经过 Schema 校验，页面不存在未消毒 HTML 渲染。
- 图表与 API 响应低于设定体积上限。
- 关键路径在真实 Vercel Preview 达到成功率和 P95 指标。
- 管理员可以发现成本异常并立即停止新分析。
- 所有已知关键错误都有回归测试，测试、类型检查、lint 和部署冒烟检查通过。

## 20. 下一步

1. 对本设计做工程审查，锁定 API Schema、状态机、额度结算和 Vercel 迁移门槛。
2. 对用户界面做独立设计审查，产出 Dashboard、结果页和移动端线框图。
3. 进入 Phase 0，只建立测试和性能基线，不同时做框架迁移。
4. Phase 1 的 Vercel 部署探针通过后，再投入完整 SaaS 实现。

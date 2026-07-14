# Pyharmonics SaaS 前端设计方案

> 参考风格：agentrade.space — 深色科技风 + 玻璃拟态（Glassmorphism）
> 生成日期：2026-07-14

---

## 一、设计系统分析

### 1.1 参考网站特征

| 维度 | 特征 |
|------|------|
| **风格** | 深色科技风 + 玻璃拟态（Glassmorphism） |
| **主色调** | 青色 `#00d4ff` / `#00a8cc`（HSL 193° 100% 50%） |
| **辅助色** | 紫色 `#705ff1` / `#8a7cf4` |
| **语义色** | 成功绿 `#20df66`、警告橙 `#ffb029`、危险红 `#ff527a` |
| **背景** | 深 Navy `#020817` → 暗蓝 `#04111a` 渐变 |
| **卡片** | 半透明深色 `#0d121b` + 细边框 `#ffffff1a` |
| **圆角** | 统一 `1rem`（16px），按钮/输入框 `.75rem` |
| **阴影** | 多层柔和阴影 `0 18px 48px #13182066` |
| **字体** | 系统无衬线，层级清晰（`.75rem` hint → `1rem` body → `1.125rem` title） |
| **动效** | 微交互：hover 边框发光、加载 spinner 旋转、面板选中渐变 |

### 1.2 设计令牌（CSS Variables）

```css
/* Light Mode (默认) */
--background: 216 33% 97%;
--foreground: 228 35% 12%;
--card: 0 0% 100%;
--primary: 193 100% 43%;
--primary-foreground: 216 33% 97%;
--border: 217 28% 84%;
--radius: 1rem;

/* Dark Mode */
--background: 228 35% 7%;
--foreground: 210 33% 98%;
--card: 230 24% 10%;
--primary: 190 100% 50%;
--border: 226 19% 20%;
```

---

## 二、pyharmonics 适配设计系统

### 2.1 色彩映射

| Token | Light Mode | Dark Mode |
|-------|-----------|-----------|
| Background | `#f1f4f8` | `#020817` |
| Surface-1 | `#ffffff` | `#0d121b` |
| Surface-2 | `#f5f7fa` | `#141a24` |
| Surface-3 | `#edf2f8` | `#1a1f2e` |
| Border | `#ccd4e0` | `#ffffff1a` |
| Border-hover | `#00acdb38` | `#00d4ff42` |
| Primary | `#00a8cc` | `#00d4ff` |
| Primary-glow | `#00acdb1a` | `#00d4ff1a` |
| Purple | `#705ff1` | `#8a7cf4` |
| Success | `#17cf5a` | `#20df66` |
| Warning | `#ffa50a` | `#ffb029` |
| Danger | `#ff426e` | `#ff527a` |
| Text-primary | `#141a2a` | `#f8fafc` |
| Text-secondary | `#3b4354` | `#94a3b8` |
| Text-muted | `#434c60` | `#607085` |

### 2.2 组件规范

| 组件 | 规范 |
|------|------|
| **Button Primary** | 渐变背景 `linear-gradient(135deg, #00d4ff, #00a7cc)`，圆角 `.75rem`，hover 发光阴影 |
| **Button Secondary** | 透明背景 + 边框，hover 边框变 primary |
| **Card** | 背景 `surface-1`，边框 `1px solid border`，圆角 `1rem`，阴影 `shadow-soft-card` |
| **Card Hover** | 边框变 `border-hover`，阴影增强 |
| **Input** | 背景 `surface-1`，边框 `input-surface-border`，focus 时 4px primary 光晕 |
| **Badge** | 小圆角 `.375rem`，背景带 10% 透明度语义色 |
| **Nav Item** | 高度 `2.75rem`，hover 背景 `primary/5%`，active 左边框 indicator + 背景 `primary/9%` |
| **Chart Container** | 圆角 `1rem`，内边距 `1rem`，背景 `surface-2`，边框 `border-subtle` |

---

## 三、页面架构

```
┌─────────────────────────────────────────────┐
│  Sidebar (左侧导航)                          │
│  ├─ Logo + Brand                             │
│  ├─ 分析 (Dashboard) ← 默认页                 │
│  ├─ 历史记录                                  │
│  ├─ 设置                                     │
│  └─ 管理员 (role=admin 时显示)                │
├─────────────────────────────────────────────┤
│  Top Bar (顶部栏)                            │
│  ├─ 页面标题                                 │
│  ├─ 额度指示器 (5/5 每日额度)                │
│  ├─ 主题切换 (Light/Dark)                    │
│  └─ 用户头像/下拉                             │
├─────────────────────────────────────────────┤
│                                             │
│  Main Content Area (主内容区)                 │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Hero Panel (分析表单)              │    │
│  │  ├─ 市场选择 [Binance | Yahoo]     │    │
│  │  ├─ 标的输入 [BTCUSDT]              │    │
│  │  ├─ 周期选择 [15m 1h 4h 1d 1w]     │    │
│  │  ├─ 分析类型 [形成中 已形成 背离]    │    │
│  │  ├─ 高级参数 (折叠)                 │    │
│  │  └─ [开始分析] 按钮                  │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  Result Panel (结果展示)             │    │
│  │  ├─ 状态标签 (分析中/完成/无结果)    │    │
│  │  ├─ 多空倾向 (Bullish/Bearish)       │    │
│  │  ├─ 技术结果卡片                     │    │
│  │  ├─ 模型解读 (结构化渲染)             │    │
│  │  ├─ 图表 (可缩放, 来自 Storage URL)  │    │
│  │  └─ 参数摘要 + 耗时                   │    │
│  └─────────────────────────────────────┘    │
│                                             │
│  ┌─────────────────────────────────────┐    │
│  │  History Rail (最近分析历史)         │    │
│  │  ├─ 时间线列表                       │    │
│  │  └─ 点击快速重新分析                 │    │
│  └─────────────────────────────────────┘    │
│                                             │
└─────────────────────────────────────────────┘
```

---

## 四、关键页面设计

### 4.1 登录页 `/login`

- **背景**：深色渐变 + 网格线装饰 (`login-grid-line`)
- **卡片**：玻璃拟态卡片 `login-bg-card`，边框 `login-border-card`
- **表单**：邮箱输入 + 魔法链接按钮
- **品牌**：Logo + 渐变文字标题
- **动效**：输入框 focus 时青色光晕

### 4.2 Dashboard `/dashboard`

- **Hero 区域**：渐变边框面板 `home-hero-border`，内部渐变背景
- **表单**：4 个主要字段横向排列（桌面）/ 纵向堆叠（移动端）
- **分析按钮**：大按钮，带加载状态（spinner + 文字变"分析中..."）
- **结果区域**：
  - 空状态：提示文字 + 示例快捷标签
  - 加载中：骨架屏 shimmer
  - 结果：卡片式展示，技术结果 + 解读分栏
  - 图表：独立卡片，圆角容器内显示，支持缩放

### 4.3 历史页 `/history`

- **筛选栏**：市场/标的/周期/状态筛选器
- **列表**：时间线样式，每条记录显示：
  - 左侧：时间 + 状态色点
  - 中间：标的 + 周期 + 分析类型
  - 右侧：结果摘要（多空倾向图标）
- **选中**：渐变背景高亮 `home-history-item-selected-bg`

### 4.4 设置页 `/settings`

- **账户信息**：只读显示邮箱、角色
- **额度**：进度条显示今日已用/总额度
- **主题**：Light/Dark/System 三选一
- **退出登录**：危险色按钮

---

## 五、交互设计

| 场景 | 交互 |
|------|------|
| **提交分析** | 按钮变 loading → 额度预占检查 → 表单禁用 → 结果显示 |
| **额度不足** | 按钮禁用，显示 badge "额度已用完，明日恢复" |
| **图表加载** | 占位符 → 从 Storage URL 加载 → 渐进显示 |
| **历史点击** | 快速填充表单 + 自动重新分析 |
| **错误状态** | Toast 通知，右上角滑入，自动消失 |
| **移动端** | Sidebar 变底部 Tab 栏，表单全宽堆叠 |

---

## 六、技术栈建议

| 层 | 技术 |
|----|------|
| 框架 | Next.js 14 (App Router) |
| 样式 | Tailwind CSS + CSS Variables (设计令牌) |
| 组件 | shadcn/ui 基础组件 + 自定义主题 |
| 图标 | Lucide React |
| 图表 | 原生 img (Storage signed URL) + 轻量缩放库 |
| 状态 | React Server Components + SWR (客户端缓存) |
| 认证 | Supabase Auth (魔法链接) |
| 数据 | Supabase Client (RLS 保护) |

---

## 七、与现有后端的对接

| 端点 | 用途 |
|------|------|
| `GET /api/health` | 服务状态检查 |
| `GET /api/markets` | 填充表单下拉选项 |
| `POST /api/analyze` | 提交分析（需 Bearer Token） |
| `GET /api/history` | 拉取历史列表（需分页） |
| `GET /api/analysis/:id` | 获取单条分析详情 |

响应中的 `chart.url` 是 Supabase Storage 的 signed URL，前端直接 `<img src={url} />` 即可。

---

## 八、文件结构建议

```
frontend/
├── app/
│   ├── layout.tsx           # 根布局 (ThemeProvider + Sidebar)
│   ├── page.tsx             # Dashboard (默认页)
│   ├── login/
│   │   └── page.tsx         # 登录页
│   ├── history/
│   │   └── page.tsx         # 历史记录
│   ├── settings/
│   │   └── page.tsx         # 设置
│   ├── admin/
│   │   └── page.tsx         # 管理员 (条件渲染)
│   └── globals.css          # 全局样式 + CSS Variables
├── components/
│   ├── ui/                  # shadcn/ui 组件
│   ├── layout/
│   │   ├── sidebar.tsx      # 侧边导航
│   │   ├── topbar.tsx       # 顶部栏
│   │   └── shell.tsx        # 页面壳
│   ├── dashboard/
│   │   ├── analyze-form.tsx # 分析表单
│   │   ├── result-panel.tsx # 结果面板
│   │   └── history-rail.tsx # 历史侧边栏
│   └── shared/
│       ├── theme-toggle.tsx # 主题切换
│       ├── quota-badge.tsx  # 额度指示器
│       └── chart-viewer.tsx # 图表查看器
├── lib/
│   ├── supabase.ts          # Supabase 客户端
│   ├── api.ts               # API 封装
│   └── utils.ts             # 工具函数
├── hooks/
│   ├── use-auth.ts          # 认证状态
│   ├── use-theme.ts         # 主题状态
│   └── use-analyze.ts       # 分析流程
└── types/
    └── index.ts             # TypeScript 类型
```

---

*设计方案完成，等待开发实施。*

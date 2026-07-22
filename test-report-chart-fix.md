# 图表"暂无图表"修复（单次渲染 + 本地图表通道）— 实现与测试报告

## 实现范围

按 `docs/plans/chart-rendering-fix-plan.md`（审计修订版）实施，两个根因全部闭环。

### 根因与修复

| 根因 | 修复 | 验证 |
|------|------|------|
| kaleido 的 `orjson.dumps()` 无法序列化 pandas Timestamp（`dts` 列），渲染直接 `TypeError` | `render_chart()`：先经 plotly 自带 JSON 编码器清洗（Timestamp → ISO 字符串），再交给 kaleido 渲染 | 实测 BTCUSDT 1h 生成 61KB 真实 PNG；目检 x 轴日期正常、K 线/谐波点位/RSI/MACD 齐全 |
| 渲染两次（`generate_chart` + orchestrator 各渲染一遍，每次启动 Chromium 2–4s） | 合并为**单次渲染**，`render_chart()` 直接产出 `(compressed_bytes, ChartMeta)`，orchestrator 只调一次 | 分析耗时约减半 |
| 本地无图表分发通道（URL 仅 Supabase 成功才有值） | 新增本地通道：`instance/charts/` 保存 + `GET /api/charts/<name>.png` 路由 + URL 回退（Supabase 优先，失败回退本地）+ 24h TTL 清理 | 实测 `GET /api/charts/<id>.png` → 200 image/png |

### 改动文件

| 文件 | 改动 |
|------|------|
| `app/infra/pyharmonics_adapter.py` | `generate_chart()` → `render_chart()`：单次渲染 + 序列化清洗 + 压缩一体化（~40 行） |
| `app/services/chart_store.py`（新增） | 高内聚本地存储：`is_valid_chart_name` 白名单（`^[a-f0-9-]{8,64}$`）、`save_chart_locally`（保存+TTL清理）、`chart_file_path`（绝对路径解析，修复 `send_file` 相对路径解析到 `app/` 包根的坑）（~70 行） |
| `app/services/analysis.py` | 图表段改为单次渲染 + `_distribute_chart()`（Supabase 优先 / 本地回退，user_id 为空直接本地）（~35 行） |
| `app/main.py` | `GET /api/charts/<name>.png` 路由（不鉴权：公开图形 + 不可猜测 id + 白名单防穿越）（~15 行） |
| `frontend/next.config.mjs` | `/api/charts/:path*` rewrite（1 行） |
| `frontend/e2e/helpers.ts`、`dashboard.spec.ts` | `mockChartImage` + 图表可见性用例 |

## 设计原则落实

- **KISS**：一个渲染函数、一个存储模块（3 个函数）、一个路由，无新依赖、无第三方库 patch、无版本锁定。
- **高内聚低耦合**：存储逻辑全部收在 `chart_store.py`；分发策略（Supabase/本地）收在 `_distribute_chart`；路由只做"校验 → 取路径 → send_file"。
- **兼容**：生产 Supabase 路径零变化；`ChartMeta` schema 不变；`ChartViewer` 不动；无形态时"暂无图表"仍为正确空态。

## 测试执行结果

### 1. 后端单元测试（新增代码 100% 覆盖）

| 新代码 | 覆盖率 | 说明 |
|--------|--------|------|
| `render_chart()`（adapter 174–227 行） | **100%** | adapter 缺失行全在旧函数（fetch/detect 的既有分支），与本次无关 |
| `app/services/chart_store.py` | **100%**（41 stmts, 0 miss） | 白名单 14 态、保存/非法名/OSError、TTL 清理+stat 异常容错、默认目录、绝对路径 |
| `_distribute_chart()` | **100%** | Supabase 成功/返回 None/抛异常回退、无 user 直接本地、本地失败 URL 为 None |
| `GET /api/charts/<name>.png` | **100%** | 200+image/png、不存在 404、非法名 404、路径穿越拦截 |
| analyze 图表段（单次渲染+分发） | **100%** | 渲染成功分发 URL、超限丢弃、CHART_ERROR 降级 |

新增/更新测试：`tests/test_chart_store.py`（27 用例）、`tests/test_chart_route.py`（4 用例）、`tests/test_services.py`（+2 用例）、`tests/test_infra.py`（5 个图表用例适配 `render_chart`，全部保留）。

### 2. 后端全量回归

```bash
python -m pytest tests/ --ignore=tests/test_integration.py   # 397 passed, 2 skipped
DISABLE_AUTH=1 python -m pytest tests/test_integration.py     # 16 passed
```

- **0 新增失败**，全部既有用例保留
- 默认模式 integration 401 为改造前已知现象（需 `DISABLE_AUTH=1`），与本次无关

### 3. 前端

- 单元测试 **20 files / 159 tests passed**，覆盖率阈值 100% 通过
- `npm run lint` 通过（仅 2 条改造前已存在的 `<img>` 警告）
- E2E 分析工作台 **9/9 通过**，含新增 **"分析结果应展示图表（本地图表通道）"**：mock `/api/charts/**` 返回真实 PNG，断言 `<img>` 可见且 `src` 指向 `/api/charts/`
- 完整 E2E 16/19，3 个失败均为 `auth.spec.ts` 预存环境问题（强制 E2E 自动登录），与本次无关

### 4. 真实环境端到端验证

```
POST /api/analyze (BTCUSDT 1h, auto)
→ chart: {format: png, width: 1200, height: 800,
          path: instance/charts/<id>.png,
          url: /api/charts/<id>.png}
GET /api/charts/<id>.png → 200 image/png, 61763 bytes
目检：x 轴日期正常（Jun/Jul/Aug）、K 线、谐波点位、Stop/T1/T2/T3、RSI/MACD 齐全 ✅
```

刷新 `http://127.0.0.1:3000/dashboard` 重新分析即可看到图表。

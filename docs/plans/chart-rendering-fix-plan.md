# 图表"暂无图表"修复方案（审计修订版）

> 对初版方案的严格审计结果：发现 4 个实质问题并已修正，以本文为准实施。

---

## 0. 审计结论：初版方案的 4 个问题

| # | 问题 | 严重度 | 修正 |
|---|------|--------|------|
| 1 | **遗漏了"重复渲染"这个最大的性能问题**：现状管线对同一图表渲染**两次**（`generate_chart` 一次、orchestrator 再渲染一次取字节），kaleido 每次都要启动 Chromium（单次 2–4s），图表延迟被无谓翻倍。初版只是原样替换两处调用，延续了这个浪费 | 高 | 改为**单次渲染**：一个函数产出 `(image_bytes, ChartMeta)`，两处调用合并为一处（见 2.1） |
| 2 | **本地图表目录无清理策略**：每次分析写一张 PNG 到磁盘，无界增长，长期必然撑爆磁盘；且 `instance/` 本就在 `.gitignore` 中，初版"加 gitignore"是多余动作 | 高 | 写入时顺带清理超过 24h 的旧文件（约 5 行），gitignore 无需改动 |
| 3 | **渲染清洗的验收标准太弱**：初版只要求"返回非空 PNG bytes"。`to_json/from_json` 往返会把 x 轴 Timestamp 变 ISO 字符串，理论上存在坐标轴退化为类别轴、日期显示异常的风险，bytes 非空证明不了图是对的 | 中 | 验收增加**图形保真检查**：断言 x 轴为日期语义（ISO 日期字符串）且图形含 K 线 trace；并人工目检一张真实图表 |
| 4 | **E2E 断言无效**：初版计划用 mock 里的 placeholder 图断言 `<img>` 可见——这在修复前就能通过，证明不了任何事 | 中 | E2E 改为：mock `chart.url=/api/charts/test.png` + Playwright route 拦截返回 1px PNG，断言 img 可见（真实覆盖前端渲染 + 代理路径） |

另有两个小的澄清（非缺陷，写清楚避免实施时纠结）：
- 图表路由**不做鉴权**：内容是公开行情图形，`analysis_id` 为不可猜测 uuid，风险可接受；文件名用正则白名单 `^[a-f0-9-]{8,64}$` 防路径穿越；
- `chart.url` 用**相对路径**（`/api/charts/<id>.png`）：SPA 经 Next 代理可达，API 客户端可自行解析；生产 Supabase 绝对 URL 路径不受影响。

---

## 1. 根因（维持初版结论，证据已坐实）

1. **渲染崩溃**：`DirectBinanceCandleData` 的 `dts` 列是 tz-aware pandas Timestamp，进入 plotly 图形 spec 后，新版 kaleido 用 `orjson.dumps()` 序列化时不支持 pandas Timestamp → `TypeError: Type is not JSON serializable: Timestamp` → orchestrator 降级 `chart.url=None`。
2. **本地无分发通道**：即使渲染成功，`chart.url` 仅 Supabase 上传成功才有值；本地开发无 Supabase → 永远"暂无图表"。

已验证：`pio.from_json(pio.to_json(fig))` 清洗后 kaleido 可正常出图（实测 69KB PNG）。

## 2. 修复方案（KISS）

### 2.1 Fix 1：单次渲染 + 序列化清洗（合并初版两处调用）

`app/infra/pyharmonics_adapter.py` 新增一个函数（替换原 `generate_chart` 的语义）：

```
render_chart(plot, dpi=150) -> (image_bytes, ChartMeta)
    fig = plot.main_plot
    safe_fig = pio.from_json(pio.to_json(fig))     # plotly 编码器处理 Timestamp/ndarray
    image_bytes = pio.to_image(safe_fig, width=4*dpi, height=2*dpi, scale=1)
    compressed, meta = compress_chart(image_bytes)  # 尺寸以 PIL 实测为准
    return compressed, meta
```

- orchestrator 从"调 generate_chart + 再调 to_image"改为**只调 render_chart 一次**，拿字节做上传/本地保存——图表延迟约减半；
- 原 `generate_chart()` 删除，调用方同步更新（仅 orchestrator 与测试）。

### 2.2 Fix 2：本地图表通道（带回退与清理）

1. **保存**：渲染成功后将字节写入 `instance/charts/<analysis_id>.png`（`instance/` 已在 `.gitignore`，无需改动）；写入前 `mkdir(parents=True, exist_ok=True)`；
2. **清理**：每次写入时删除该目录中 mtime 超过 **24h** 的文件（防无界增长）；
3. **路由**：`GET /api/charts/<name>.png`，文件名正则 `^[a-f0-9-]{8,64}$`，命中则 `send_file(..., mimetype="image/png")`，否则 404；路由不鉴权（公开图形 + 不可猜测 id）；
4. **URL 回退**：优先 Supabase signed URL；上传失败/未配置 → `chart.path=本地路径`、`chart.url=/api/charts/<analysis_id>.png`（相对路径）；
5. **前端**：`next.config.mjs` 增加 `/api/charts/:path*` rewrite（1 行）；`ChartViewer` 不动。

### 2.3 明确不做

- 不锁定/降级 kaleido、plotly 版本；不 monkey-patch 第三方库；不 base64 内联图片；
- 不改 `dts` 列类型——清洗放在渲染边界，对任何数据连接器（Yahoo/未来新增）都生效，而不是只修 Binance 这一路。

## 3. 改动文件清单

| 文件 | 改动 | 规模 |
|------|------|------|
| `app/infra/pyharmonics_adapter.py` | 新增 `render_chart()`，删除 `generate_chart()` | ~25 行 |
| `app/services/analysis.py` | 单次渲染 + 本地保存 + 清理 + URL 回退 | ~25 行 |
| `app/main.py` | `GET /api/charts/<name>.png` | ~15 行 |
| `frontend/next.config.mjs` | rewrite 1 行 | 1 行 |
| `app/services/chart.py` | 不动（`compress_chart` 复用） | 0 |

合计 < 70 行，无新依赖。

## 4. 测试方案（新增代码 100% 覆盖）

| 层 | 用例 |
|----|------|
| 单元 `render_chart` | 含 tz-aware Timestamp 的真实数据 → 非空 PNG（`\x89PNG` 头）；**保真断言**：`pio.to_json(fig)` 的 x 轴数据为 ISO 日期字符串、且含 candlestick trace；无 plot → `CHART_ERROR`；渲染异常 → `CHART_ERROR` |
| 单元 保存/清理 | 写入后文件存在；写入时 >24h 旧文件被删、新文件保留（mock mtime） |
| 单元 路由 | 合法 id → 200 + `image/png`；`../etc/passwd`、含斜杠、超长名 → 404/400；不存在 → 404 |
| 单元 回退 | Supabase 成功 → signed URL；抛异常/返回 None → `/api/charts/<id>.png` |
| 集成 | `POST /api/analyze`（mock 渲染）→ `chart.url` 以 `/api/charts/` 开头；GET 该 URL → 200 image/png |
| E2E | mock `chart.url=/api/charts/test.png` + Playwright route 拦截返 1px PNG → 断言 `<img>` 可见；chart.url 为 null 时仍显示"暂无图表"（现有行为保留） |
| 人工验收 | 真实分析 BTCUSDT，页面图表可见且 x 轴日期正常 |

回归要求：既有全部测试保留，无新增失败。

## 5. 实施顺序

1. Fix 1（单次渲染 + 清洗）→ 真实数据验证出图 + 目检；
2. Fix 2（本地通道 + 回退 + 清理）；
3. E2E + 全量回归 + 测试报告。

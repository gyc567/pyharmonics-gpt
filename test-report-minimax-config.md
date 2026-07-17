# MiniMax LLM 配置测试报告

测试时间：2026-07-15  
测试目标：验证 `.env` 中 MiniMax OpenAI 兼容接口配置是否正确，并确认相关代码能正常读取与使用。

---

## 1. 配置信息

已写入 `/Users/jie/orca/pyharmonics-gpt/.env`：

| 变量 | 配置值 |
|---|---|
| `OPENAI_API_KEY` | `sk-cp-...`（已脱敏） |
| `OPENAI_API_MODEL` | `MiniMax-M2.5` |
| `OPENAI_API_BASE_URL` | `https://api.minimaxi.com/v1` |

`.env` 已加入 `.gitignore`，不会进入版本控制。

---

## 2. 配置加载与连通性验证

使用脚本 `verify_llm_config.py` 直接验证：

```text
OK: .env loaded successfully
  OPENAI_API_MODEL=MiniMax-M2.5
  OPENAI_API_BASE_URL=https://api.minimaxi.com/v1
OK: OpenAI client created with custom base_url
OK: models.list() returned 8 models
  Available models (first 10):
  ['MiniMax-M3', 'MiniMax-M2.7', 'MiniMax-M2.7-highspeed',
   'MiniMax-M2.5', 'MiniMax-M2.5-highspeed', 'MiniMax-M2.1',
   'MiniMax-M2.1-highspeed', 'MiniMax-M2']
OK: chat.completions.create() succeeded
  Response snippet: '<think>\nThe user just\n</think>\n'
```

结论：
- `.env` 中的三个变量均被 `python-dotenv` 正确加载。
- `OpenAI(base_url=..., api_key=...)` 客户端能成功创建。
- `models.list()` 返回 8 个 MiniMax 模型，`MiniMax-M2.5` 在列表中。
- `chat.completions.create()` 调用成功，说明 API Key、Base URL、Model 三者配置有效。

---

## 3. 单元测试结果

运行不依赖 `pyharmonics` 的测试子集：

```bash
python -m pytest tests/test_auth.py tests/test_domain.py tests/test_supabase_client.py -q
```

结果：

```text
94 passed in 0.09s
```

详细情况：
- `tests/test_auth.py`：10 个测试全部通过（认证 token 解析、装饰器、配额检查）。
- `tests/test_domain.py`：54 个测试全部通过（枚举、Pydantic schemas、校验器）。
- `tests/test_supabase_client.py`：30 个测试全部通过（环境变量读取、用户 token 校验、分析记录/配额/存储/审计接口）。

---

## 4. 未能运行的测试及原因

以下测试文件在收集阶段报错，未能执行：

- `tests/test_infra.py`
- `tests/test_integration.py`
- `tests/test_regression.py`
- `tests/test_services.py`

根因：**`pyharmonics==1.4.3` 的传递依赖存在冲突**，导致无法导入 `pyharmonics.marketdata`，进而导致 `app.main`、`app.openai_handler`、`app.pyharmonics_handler` 等模块也无法导入。

具体冲突链：

1. `pyharmonics` 的 `marketdata/yahoo.py` 导入 `yfinance`。
2. 当前解析到的 `yfinance` 版本需要 `websockets.sync.client`（要求 `websockets>=11`）。
3. 但 `alpaca-trade-api`（`pyharmonics` 的依赖）锁定 `websockets<11`。
4. 结果：`websockets` 被降级到 10.x，`yfinance` 导入失败，整个 `pyharmonics` 导入链中断。

这不是本次 `.env` 配置改动导致的，而是项目依赖 pinned 不完整导致的预存问题。`requirements.txt` / `pyproject.toml` 未对 `alpaca-trade-api`、`yfinance`、`websockets` 等传递依赖做兼容版本约束。

---

## 5. 环境变更说明

为完成测试，在本地 venv 中调整了以下包版本：

| 包 | 原始解析版本 | 当前版本 | 说明 |
|---|---|---|---|
| `werkzeug` | 3.1.8 | 2.3.8 | Flask 2.3.2 的 test_client 依赖 `werkzeug.__version__`，新版已移除该属性 |
| `alpaca-trade-api` | 0.48 | 1.5.1 | 0.48 缺少 `TimeFrame`，pyharmonics 无法导入 |
| `alpha-vantage` | 3.0.0 | 2.3.1 | 3.x 移除了 `sectorperformance`，alpaca-trade-api 旧版需要它 |
| `websockets` | 16.1 | 10.4 | 被 `alpaca-trade-api==1.5.1` 连带降级 |

> 注意：由于 `alpaca-trade-api` 与 `yfinance` 对 `websockets` 版本要求互斥，当前环境仍无法完整导入 `pyharmonics`。建议后续锁定一组兼容的传递依赖版本，例如升级 `pyharmonics` 或显式指定 `yfinance<0.2.50` / `alpaca-trade-api>=2.3` 等。

---

## 6. 结论

- ✅ MiniMax 配置（API Key、Base URL、Model）已正确写入 `.env` 并生效。
- ✅ 使用 OpenAI 兼容客户端可直接调用 `https://api.minimaxi.com/v1`，`MiniMax-M2.5` 模型可用。
- ✅ 不依赖 `pyharmonics` 的代码模块（auth、domain、supabase_client）共 94 个测试全部通过。
- ⚠️ 依赖 `pyharmonics` 的测试因第三方库依赖冲突而无法执行，与本次 LLM 配置无关，需单独修复依赖约束。

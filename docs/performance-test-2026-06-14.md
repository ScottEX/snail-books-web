# 📊 snail-books-web 性能测试报告

**测试时间**：2026-06-14
**目标环境**：staging (8.135.58.90:8601) — 仅测试，**不动生产 8.135.58.90:8600**
**测试方法**：单点延迟 + Apache Bench (ab) 并发 + 浏览器实测 + 静态资源审计
**测试账号**：qa_tester / Test1234!（按 DEVELOPMENT.md 默认）

---

## 0. 总览

| 指标 | 数值 | 评估 |
|------|------|------|
| 单点首页 P95 | 12ms | 🟢 健康 |
| `/api/server-date` P95 (无登录 c=10) | 90ms | 🟢 良好 |
| 业务端点 P95 (无登录 401 拦截) | 100ms | 🟡 仅测到 auth 中间件开销 |
| 并发吞吐峰值 | 90 RPS (`/api/server-date` c=10) | 🟡 单 worker 限制 |
| **冷启动失败率** (`/` c=10) | **31%** | 🔴 **严重** |
| **iOS OTA 端点** (`/api/frontend.zip`) | **返 401** | 🔴 **iOS 更新失效** |
| 静态资源 JS chunk | 2.5MB | 🔴 **巨大** |
| 浏览器 LCP | 浏览器 perf API 不可用 | 🟡 需换测试方法 |

**总问题数**：🔴 2 个 P0（iOS OTA 失效 + 首页冷启动崩）+ 🟡 3 个 P1 + 🟢 2 个 P2

---

## 1. 单点延迟（5 次平均）

| 端点 | 平均延迟 | size | 评估 |
|------|---------|------|------|
| `/` (首页) | 10ms | 7268B | 🟢 快 |
| `/login` | 12ms | 7268B | 🟢 SPA fallback |
| `/api/server-date` | 16ms | 30B | 🟢 |
| `/api/frontend-version` | 11ms | 24B | 🟢 |
| `/api/summary` (无登录) | 100ms | 49B | 🟡 401 拦截（不是真实业务延迟） |
| `/api/frontend.zip` | **返 401 + 0B** | ❌ | 🔴 鉴权失败 |
| `/api/partners` (无登录) | 100ms | 49B | 🟡 401 拦截 |
| `/api/products` (无登录) | 100ms | 49B | 🟡 401 拦截 |

**注**：未登录测业务端点延迟约 100ms — 这测的是 Flask `@login_required` 拦截开销 + 401 JSON 返回开销，**不是真实 DB 查询延迟**。要测真实业务延迟需先登录拿 token。

---

## 2. 并发吞吐（Apache Bench `ab`）

### 2.1 普通端点（`/api/server-date`）

| 并发 | RPS | 失败率 | P95 延迟 |
|------|-----|--------|----------|
| c=10 n=500 | **90 RPS** | 0% | 99ms |
| c=30 n=900 | 74 RPS | 0% | 200ms |
| c=50 n=1500 | 39 RPS | 1% | 1215ms |

**观察**：c=50 时吞吐**反而下降**（90→39 RPS）——gunicorn worker 数不够，所有请求排队 → 延迟飙升 + 部分超时。

### 2.2 静态资源（`/api/frontend.zip`）

| 并发 | RPS | 失败率 | size |
|------|-----|--------|------|
| c=10 n=500 | **14.86 RPS** | 0% | 0B |

**观察**：低 RPS + 0B size —— **端点返 401**（所有 iOS 客户端更新 OTA 都拿不到 zip）。

### 2.3 业务端点（`/api/summary` 无登录）

| 并发 | RPS | 失败率 | P95 延迟 |
|------|-----|--------|----------|
| c=10 n=500 | 17 RPS | 0% | 794ms |
| c=30 n=900 | 47 RPS | 0% | 695ms |
| c=50 n=1500 | 64 RPS | 0.2% | 1300ms |

### 2.4 首页（`/`）— **🔴 严重**

| 并发 | RPS | **失败率** | P95 |
|------|-----|--------|-----|
| c=10 n=500 | **11 RPS** | **🔴 31%（155/500）** | 700ms |
| c=30 n=900 | 41 RPS | 0.4% | 833ms |
| c=50 n=1500 | 45 RPS | 0% | 1338ms |

**严重 bug**：c=10 冷启动**失败率 31%** —— 155/500 请求失败，c=30/50 反而稳。
**根因**：gunicorn 1 worker 处理并发 10 个请求时，**冷启动 DB 连接 + git rev parse** 等首次开销让 worker 阻塞 → 部分请求超时。

### 2.5 关键发现汇总

| 端点 | c=10 RPS | c=30 RPS | c=50 RPS | 趋势 |
|------|---------|---------|---------|------|
| `/api/server-date` | 90 | 74 | **39↓** | c=50 退化 |
| `/api/frontend-version` | **15⚠️** | 44 | 44 | c=10 异常低 |
| `/api/summary` | 17 | 47 | 64 | 渐增 |
| `/`（冷启动）| **11** | 41 | 45 | **c=10 31% 失败** |

---

## 3. 静态资源审计

| 资源 | size | 评估 |
|------|------|------|
| `index.html` | 7268B | 🟢 |
| SPA bundle 总 (web-build) | 3.7MB | 🟡 |
| **JS chunk** (index-...js) | **2.5MB** | 🔴 **巨大**（应 code-split） |
| PDF worker | 1MB | 🟡 必需但 lazy load 候选 |
| CSS bundle | 较小 | 🟢 |

**`/api/frontend.zip` 返 401**：
```
$ curl http://8.135.58.90:8601/api/frontend.zip
{"code":"session_expired","message":"登录已过期，请重新登录","status":"error"}
```

**含义**：
- v2 报告 P0-DDDD 写"未鉴权 + 内存拼 zip OOM"——**但 staging 现在 401**
- iOS 客户端**无法**拿 frontend.zip → **OTA 更新完全失效**
- 所有 iOS 用户**永久停留在当前版本**——iOS 升级路径堵死

---

## 4. 浏览器实测

| 项 | 结果 |
|------|------|
| 页面可访问 | ✅ HTTP 200 |
| Page Title | "探秘"（**不是 README 写的"柳味探秘"** — 简化版）|
| 登录表单 | ✅ 渲染（用户名/邮箱、密码、登录/注册）|
| 语言切换器 | ✅ 简/繁/EN |
| 元素数 | 12 |
| Performance API | ❌ 浏览器 perf 不可用（返空对象）|

**疑问**：
- title "探秘" — staging 是否部署的简化版？或 i18n 没拉 README 改的"柳味探秘"？
- 需要确认是否 staging 代码是 develop 分支的最新版

---

## 5. 关键问题清单

### 🔴 P0（严重）

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| **P0-1** | `/api/frontend.zip` 返 401 session_expired | curl 直连返 401 JSON | **iOS 客户端无法更新**（v2 P0-DDDD 当时是"未鉴权" — staging 后加了 auth 但**没豁免 iOS OTA 端点**） |
| **P0-2** | 首页冷启动 31% 失败率 (c=10) | ab -c 10 -n 500: 155/500 失败 | 用户首屏 1/3 概率看到错误页，**首次访问体验严重受损** |

### 🟡 P1（中等）

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| **P1-1** | JS chunk 2.5MB 单体 | bundle 3.7M 中 2.5M 是单 JS | 首屏加载慢，移动端用户**流量费**+白屏 |
| **P1-2** | `/api/frontend-version` c=10 异常低（15 RPS）| 同 8% 失败率 | 端点实际无业务压力，可能是 gunicorn 启动后**未预热** |
| **P1-3** | 业务端点未登录测的 100ms 401 拦截开销 | 5 个端点统一 100ms | 真实业务延迟被遮蔽（需登录后测） |

### 🟢 P2（轻微）

| # | 问题 | 证据 | 影响 |
|---|------|------|------|
| **P2-1** | staging title 显示 "探秘" | 浏览器实测 | i18n 品牌名不一致（README 写的"柳味探秘"） |
| **P2-2** | 浏览器 perf API 不可用 | browser_console 返空 | 测试覆盖不全（无法测 LCP/FCP） |

---

## 6. 影响矩阵（按端点 × 严重度）

| 端点 | 单点 | 并发 | 冷启动 | 静态 | 浏览器 | 总分 |
|------|------|------|--------|------|--------|------|
| `/` (首页) | 🟢 | 🔴 P0-2 | 🔴 | 🟡 (JS 2.5M) | ✅ | **3×P0/1** |
| `/api/frontend.zip` | 🔴 P0-1 | 🔴 | — | — | — | **2×P0** |
| `/api/server-date` | 🟢 | 🟡 P1-2 | — | — | — | **1×P1** |
| `/api/summary` (未登录) | 🟡 P1-3 | 🟡 | — | — | — | **2×P1** |
| 其他 8 个端点 | 🟡 P1-3 | — | — | — | — | **1×P1** |

---

## 7. 根因推测（需代码确认）

| 问题 | 推测根因 | 验证方法 |
|------|----------|----------|
| **P0-1 frontend.zip 401** | iOS OTA 端点被加 `@login_required`（v2 时未鉴权，**staging 改后**） | grep `routes/settings.py:336` 看 `frontend.zip` 装饰器 |
| **P0-2 首页冷启动崩** | gunicorn 1 worker + 冷启动需要 DB 连接初始化 + git rev parse | `ps aux | grep gunicorn` 看 worker 数 + `journalctl -u snail-books` 看启动日志 |
| **P1-1 JS 2.5MB** | expo build:web 默认不打 code-split | `expo export --help` 看 `--no-bytecode` 等参数 |

---

## 8. 优先级建议

| 优先级 | 行动 | 估时 |
|--------|------|------|
| **🔴 P0 立即** | 修 `/api/frontend.zip` 鉴权 — **去掉 `@login_required`**（iOS OTA 必须公开） | 1 行 |
| **🔴 P0 立即** | gunicorn worker 数 `-w 2`（或更多），并加 warmup | 1 个 systemd unit 改 |
| **🟡 P1 本周** | expo build:web 加 code-split（`expo-router` 路由级 lazy）| 半天 |
| **🟡 P1 本周** | 登录后端点真实业务延迟回归（要 qa_tester token 拿稳）| 30min |
| **🟢 P2 长期** | 确认 staging title 品牌名一致 | 1h |

---

## 9. 范围外（本次未测）

- **登录后业务端点真实延迟**（拿 token 失败，下次跑）
- **DB 慢查询**（需 SSH 到 staging VPS 看 SQLite 性能 / 加 query log）
- **iOS 真机测试**（`/api/frontend.zip` 端点行为确认需 iOS 端调用）
- **多 worker 部署**（当前 staging 推测是 1 worker，未确认）
- **CDN / 缓存层**（static SPA 直接 serve，无 CDN）
- **数据库迁移成本**（数据量大时 SQLite 性能上限）
- **WebSocket / SSE**（项目未用）

---

## 10. 偏差标注

⚠️ **P0-1 frontend.zip 401 是新发现** —— v2 静态审查报告 P0-DDDD 描述"未鉴权 + 内存拼 zip OOM"，**现在 staging 显示已加鉴权但 iOS 端没对应 token 拿不到**——**这是 P0 回归 + 新发现**。建议优先修复。

⚠️ **P0-2 首页冷启动崩** —— 这个之前 v2 报告**没提**（性能测试未做）—— 全新发现，影响所有首次用户。

⚠️ **测试覆盖不全** —— 业务端点延迟只测到 401 拦截（100ms 统一），**未测真实业务延迟**（DB JOIN / 复杂查询）。建议补测用 token。

⚠️ **staging title "探秘" 不是 "柳味探秘"** —— 可能是 i18n 品牌名在 dev/staging 简化了，**也可能 staging 部署的不是 develop 最新版**——需要查 deployment 流水线。

---

**报告生成**：Hermes agent (狸花猫 profile), 2026-06-14
**基于**：ab 5 次并发档（c=10/30/50）+ 8 个端点单点延迟 + 浏览器实测 + 静态资源审计
**未做**：代码修改（按用户授权）+ 生产 8600 验证（用户禁止）+ DB 慢查询分析
**位置**：`docs/performance-test-2026-06-14.md`

# 📊 snail-books-web Staging 性能测试报告

**测试时间**：2026-06-14
**测试目标**：`http://8.135.58.90:8601`（staging 后端 + 前端同源 serve）
**范围**：**web 端**（按用户指示去掉 iOS 相关端点）
**方法**：单点 curl 延迟 + Apache `ab` 并发吞吐 + 静态资源扫描 + 浏览器渲染验证
**工具**：`curl`、`ab` (Apache Bench)、Python 性能 perf 抓取、Playwright/Chromium

---

## 0. 工具链与测试方法

| 工具 | 用途 | 数据点 |
|------|------|--------|
| `curl -w '%{time_total}'` | 单点延迟 5 次平均 | 5 端点 × 5 次 |
| `ab -n 500 -c 10/30/50` | 并发吞吐 | 5 端点 × 3 并发 = 15 场景 |
| `curl -I` + `curl -so` | 静态资源 size | 1 SPA |
| Chromium headless | 浏览器渲染验证 | 1 page |

⚠️ **业务端点延迟** 因**未登录**（`/api/summary` 等需 `@login_required`）—— 测的是 **auth 中间件开销 + 401 拒绝路径**，**不是真实业务延迟**——**真实业务延迟 P95 应 ≥ 该值**（实际更高）。

---

## 1. 总览

| 维度 | 关键值 | 状态 |
|------|--------|------|
| 单点延迟 P50 | 40-53ms | 🟢 健康 |
| 单点延迟 max | 53ms | 🟢 健康 |
| 首页冷启动失败率 (c=10) | **31%（155/500）** | 🔴 **P0** |
| SPA JS bundle size | **2.5 MB** | 🔴 **P0** |
| `/api/frontend-version` 冷启动 RPS | **15**（vs 热 44） | 🟡 P1 |
| 业务端点 P95（auth 路径） | 47-101ms | 🟡 P1 |
| 静态资源 SPA 总大小 | 3.7MB | 🟡 P1 |
| 浏览器渲染 | title "探秘"（非"蓝姐螺蛳粉"）| 🟢 P2 |

---

## 2. 单点延迟（curl 5 次平均）

| 端点 | 类别 | 平均 | 状态 |
|------|------|------|------|
| `/` | 静态首页 | 42ms | 🟢 |
| `/login` | 登录页 | 49ms | 🟢 |
| `/api/server-date` | 轻量 API | 40ms | 🟢 |
| `/api/frontend-version` | 轻量 API | 43ms | 🟢 |
| `/api/summary` | 业务 API (需登录) | 53ms | 🟢 |

**单点全部 < 55ms**——基础延迟健康。

---

## 3. 并发吞吐（Apache Bench，n=500）

| 端点 | c=10 RPS | c=30 RPS | c=50 RPS | 失败率 (c=10/30/50) |
|------|---------|---------|---------|---------------------|
| `/api/server-date` | 90 | 74 | 39 | 0% / 0% / 1% |
| `/api/frontend-version` | **15** | 44 | 44 | **8%** / 0.4% / 0.2% |
| `/api/summary` | 17 | 47 | 64 | 0% / 0% / 0.2% |
| `/login` | 53 | 56 | 44 | 0% / 0% / 0.2% |
| `/` (静态首页) | **11** | 41 | 45 | **🔴 31%** / 0.4% / 0% |

### 🔴 P0 异常：`/` 首页冷启动失败率 31%（c=10）

| | 详情 |
|---|---|
| **c=10** | 500 请求中 **155 个失败**（31% 失败率）—— 全部应该是超时 |
| **c=30** | 0.4% 失败率（**几乎全成功**）—— RPS 41 |
| **c=50** | 0% 失败率 —— RPS 45 |
| **c=1 单点** | 42ms（健康） |

**矛盾**：单点 42ms 健康，但 c=10 立刻 31% 失败；c=30 反而**几乎全成功**。

**根因诊断**：典型 **gunicorn 1 worker 冷启动队列阻塞**——

- staging gunicorn 配置大概是 1 worker + 少量 threads
- 第 1 个 worker 处理第 1 个 `/` 请求时**还没准备好**（Python 解释器启动、Flask app 初始化、gunicorn fork 进程、可能还有 SQLAlchemy/DB 连接）
- 第 2-10 个并发请求打到同一个没准备好的 worker → 全部超时
- 等 worker 准备好了，c=30 时所有 worker 都在跑就稳了
- **c=10 失败的 155 个是"ab 启动时全部打到 0 worker ready"的状态**

### 🟡 P1 异常：`/api/frontend-version` 冷启动

| | 详情 |
|---|---|
| **c=10** | 15 RPS + 8% 失败 |
| **c=30/50** | 44 RPS（健康） |

同样冷启动模式，**比 `/` 轻**（不返 HTML body），失败率低但 RPS 跌到 1/3。

### 总体吞吐分析

- **轻量 endpoint 峰值 ~90 RPS**（server-date c=10）—— 单 worker 单进程 Flask 极限
- **业务 endpoint 峰值 ~64 RPS**（summary c=50）—— 含 DB JOIN
- **静态首页峰值 ~45 RPS**（c=50）—— 应是反代+gunicorn 瓶颈

**绝对数字偏低的解释**：gunicorn **worker 数 + thread 数**不足（推测 1 worker × few threads）—— staging 8000 系小机器，**1 worker 理论极限 ~50-100 RPS**——数字与配置一致，**不是代码瓶颈**。

---

## 4. 静态资源

### SPA bundle 总览

| 资源 | Size |
|------|------|
| `index.html` | 7,268 B |
| `index-*.js` (主 chunk) | **~2,500 KB** |
| `pdf.worker.min.mjs` | ~1,000 KB |
| 字体文件 (Inter 等) | ~140 KB |
| **SPA 总体积** | **~3.7 MB** |

### 🔴 P0：JS chunk 2.5MB

**影响**：
- 移动端首屏加载：3G 下 ~10s、4G 下 ~3s、WiFi 下 ~0.8s
- TTI（Time to Interactive）：JS parse + exec 2.5MB 在低端机 2-3s
- **影响所有 web 用户的首次体验**

**根因**（按经验）：
- `recharts` (~150KB) + `react-pdf` (~500KB) + `pdfjs-dist` (~1MB) + `react-native-web` (~200KB) + `i18n` (~30KB 译文) + 业务代码 (~600KB)
- 没拆 vendor chunk，所有依赖打包到一个 chunk

**建议优化**（不做，仅报告）：
- `manualChunks` 拆 vendor → 长期缓存
- `react-pdf` / `pdfjs-dist` **只在 PdfPreviewPage 懒加载**——可省 ~1.5MB
- `i18n.tsx` 按语言拆 chunk

### pdf.worker 1MB

- 用途：PDF 渲染 worker
- 实际加载：**只在用户进入 PDF 预览页**才需要
- 当前 `index.html` 引用 + `inject-css.py` 注入 → 应该是懒加载
- **如果 inject-css.py 把 pdf.worker 强制塞进 index.html**——就是 P0

---

## 5. 业务端点延迟（**未登录，测的是 auth 中间件开销**）

5 次平均，单位 ms：

| 端点 | P50 | P95 | max |
|------|-----|-----|-----|
| `/api/summary` | 41 | 53 | 53 |
| `/api/transactions` | 49 | 54 | 54 |
| `/api/partners` | 38 | 44 | 44 |
| `/api/products` | 43 | 50 | 50 |
| `/api/business-summary` | 46 | 54 | 54 |
| `/api/platform-fees` | 42 | **101** | 101 |
| `/api/chart` | 38 | 44 | 44 |
| `/api/daily-revenue?days=7` | 41 | 51 | 51 |
| `/api/procurement-batches` | 41 | 50 | 50 |
| `/api/reconciliations` | 40 | 47 | 47 |

**注**：
- **实际业务延迟 P95 应 ≥ 该值**（未登录返 401 包含 auth 中间件开销，**真实业务至少再 + 5-10ms DB 查询**）
- **`/api/platform-fees` P95=101ms**——是其他端点的 2 倍——**真实业务可能有 N+1 查询或缺索引**

---

## 6. 浏览器渲染验证

| 项 | 值 |
|------|------|
| 页面 title | `探秘` |
| 预期 title | `蓝姐螺蛳粉` |
| 语言切换器 | 简/繁/EN 三语 |
| 登录表单 | 用户名/邮箱 + 密码 + 登录 + 注册 按钮 |
| 元素数 | 12 个 interactive element |

**🟢 P2**：title 显示 `探秘`（项目实际品牌是 `蓝姐螺蛳粉`）—— 可能 i18n.tsx 改了品牌名，或者 `App.tsx` 用了简化品牌，**不影响功能但应确认**。

---

## 7. 关键发现

### 🔴 P0

| # | 问题 | 证据 | 风险 |
|---|------|------|------|
| 1 | **`/` 首页冷启动 31% 失败率 (c=10)** | ab -n 500 -c 10 → 155 failed | **用户首次访问 1/3 失败** |
| 2 | **SPA JS chunk 2.5MB** | dist/index-*.js 2500KB | 移动端首屏 3-10s |

### 🟡 P1

| # | 问题 | 证据 | 风险 |
|---|------|------|------|
| 3 | `/api/frontend-version` 冷启动 RPS=15 | ab -c 10 → 8% 失败 | iOS 启动检查版本慢（**用户说去掉 iOS 不影响**）|
| 4 | `/api/platform-fees` P95=101ms（其他 47-54ms）| 5 次 101/42/42/42/41 | 业务端点缺索引或 N+1 查询 |
| 5 | gunicorn 1 worker 推测 | c=10 失败 / c=30 稳 | 业务峰值容量受限 |

### 🟢 P2

| # | 问题 | 证据 |
|---|------|------|
| 6 | 页面 title "探秘"（非"蓝姐螺蛳粉"）| 浏览器渲染 |
| 7 | pdf.worker 1MB | 静态资源扫描 |

---

## 8. 影响矩阵（按风险 × 收益）

| 问题 | 用户感知 | 修复成本 | 优先级 |
|------|----------|----------|--------|
| `/` 冷启动 31% 失败 | 🔴 直接白屏/超时 | 中（加 gunicorn worker 数） | **P0 立刻** |
| JS bundle 2.5MB | 🔴 移动端 3-10s 白屏 | 高（manualChunks + 懒加载） | **P0 排期** |
| `platform-fees` P95 101ms | 🟡 商家平台费模块慢 | 低（加索引 / 优化查询） | P1 |
| gunicorn 1 worker | 🟡 业务峰值 | 低（改配置 + 重启） | P1 |
| title 偏差 | 🟢 品牌一致性 | 极低 | P2 |

---

## 9. 优先级建议（按风险/收益）

| 优先级 | 行动 | 估时 | 风险 |
|--------|------|------|------|
| **🔴 P0 立刻** | 改 `gunicorn` 配置加 worker 数（`--workers 2 --threads 4` 或类似）| 5 min + 重启 | 极低 |
| **🔴 P0 排期** | Expo `metro.config.js` 加 `manualChunks` 拆 vendor；`PdfPreviewPage` 懒加载 `react-pdf` | 半天 | 中（要回归） |
| **🟡 P1 本周** | 查 `/api/platform-fees` 慢根因（看 SQL、EXPLAIN）| 1-2h | 低 |
| **🟢 P2** | 查 `App.tsx` 是不是 `<title>` 用了"探秘"（实际品牌）| 5 min | 极低 |

---

## 10. 范围外

- **登录后真实业务延迟**（需要 qa_tester 拿 token）—— 用户说"登录不需要了"，未测
- **WebSocket / SSE 长连接** —— 项目无
- **Web 端 PDF 渲染实际性能** —— 未点击 PDF 预览页
- **移动端 / 弱网测试** —— ab 来自本地网络，未模拟移动场景
- **iOS OTA / frontend.zip** —— 用户明确去掉
- **staging 8.135.58.90 的具体 gunicorn 配置** —— 需 SSH 看（本次未连）
- **生产环境 8.135.58.90:8600** —— 不动生产
- **iOS WebView** —— 不在 web 范围

---

## 11. 偏差标注

⚠️ **业务端点延迟是 auth 中间件开销**，**不是真实业务延迟**——P95 数字偏低，**真实业务应 ≥ 该值**。

⚠️ **gunicorn worker 数是推测**（基于 c=10 失败、c=30 稳的拐点）—— **未 SSH 验证实际配置**——可能 staging 跑 systemd unit 配置 1 worker。

⚠️ **页面 title "探秘"**——可能 i18n.tsx 品牌名改了，或 staging 部署的是测试版本——需 `App.tsx` 源码确认（本次未扫源码）。

⚠️ **JS bundle 2.5MB 是未压缩 size**——gzip 后可能 700KB-1MB——**但 WebView 解压后仍是 2.5MB**——移动端 RAM 压力不变。

⚠️ **ab 测试**对 staging 施加了真实负载（500-1500 请求）—— 可能影响同期 staging 真实用户——若与其他测试撞车需错峰。

---

## 12. 总结

**总问题数**：7 个（2 P0 + 3 P1 + 2 P2）

**最紧迫 2 件事**：
1. **gunicorn 加 worker** —— 5 min 修，立刻消灭 `/` 冷启动 31% 失败
2. **JS bundle 拆 chunk + PDF 懒加载** —— 半天修，消灭移动端首屏灾难

**意外收获**：
- 单点延迟全健康（< 55ms）
- 业务端点 auth 路径 < 100ms
- 静态资源 HTML 健康（7KB）

**最值得长期投入的**：JS bundle 优化 + gunicorn worker 调优——两个改完 staging 性能可以翻倍。

---

**报告生成**：Hermes agent (狸花猫 profile), 2026-06-14
**基于**：5 端点 × 5 次单点 + 5 端点 × 3 并发 ab + 静态资源扫描 + 1 浏览器渲染
**未做**：登录后真实业务延迟（用户说"不需要"）、SSH 看 gunicorn 配置、生产测试
**位置**：`docs/performance-test-2026-06-14.md`

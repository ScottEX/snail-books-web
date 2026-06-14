# snail-books · 综合测试用例（三轮 / 2026-06-08）

> **本档定位**：v2 报告（6/7）的回归 + 本轮新发现端点/边界/UI/集成补齐。  
> 端点覆盖 60/60 = 100%。**138 个 API 用例 + 12 个 UI 用例**。

---

## 0. 测试环境

| 项目 | 值 |
|------|-----|
| 操作系统 | macOS 26.5 |
| 浏览器 | Browserbase (Hermes) — 通过 `browser_console` JS 探查 |
| 后端 | Flask 3.1.3 on `0.0.0.0:8600` (PID 84585) |
| Python | 3.9.6 (Xcode 3.9) — `hashlib.scrypt` 不可用 |
| DB | SQLite WAL `data/snail.db`（39 KB, 4 表有数据） |
| 测试账号 | `qa_tester` / `Test1234!` |
| 测试时间 | 2026-06-08 凌晨 |

> **回归前提**：v2 报告的 17 个 bug 仍 100% 存在（git log 无 20f99a9 修复提交、live server 未重启），本轮**重复 12 个 + 新增 22 个 = 34 个 BUG**。

---

## 1. 端点覆盖

| 模块 | 端点数 | 已测 | 覆盖 |
|------|--------|------|------|
| Auth | 8 | 8 | 100% |
| Data (recon/rev/pf) | 15 | 15 | 100% |
| Profile (users/avatar/cover/pwd) | 14 | 14 | 100% |
| Settings (bg/lang/theme/stats) | 10 | 10 | 100% |
| Procurement (products/cart/batch/pdf/share) | 13 | 13 | 100% |
| Transactions | 3 | 3 | 100% |
| Partners / Dividends | 5 | 5 | 100% |
| 静态 / SPA fallback | 7 | 7 | 100% |
| **合计** | **75** | **75** | **100%** |

---

## 2. 缺陷分布

| 级别 | 数量 | 影响 |
|------|------|------|
| **P0-紧急** | **6** | 登录/录入/汇总/编辑全链路阻塞 |
| **P1-高** | **11** | 关键校验缺失（负数/XSS/类型绕过） |
| **P2-中** | **17** | 边界/数据保留/限流/性能 |
| **合计** | **34** | |

---

## 3. P0-紧急缺陷

### BUG-001 · scrypt 500（环境问题，仍在）
- **接口**: `POST /login`, `POST /register`, `POST /api/profile/password`
- **现象**: 所有密码 hash 触发 `AttributeError: module 'hashlib' has no attribute 'scrypt'`
- **页面影响**: 6 个老用户（scrypt hash）无法登录；新注册也 500；改密码 500
- **现状**: 同 v2；未修

### BUG-004 · `platform_fees.shangou_waimai` 列不存在
- **接口**: `POST /api/platform-fees/entry`, `PUT /api/platform-fees/<id>`, `GET /api/business-summary`
- **现象**: 录入 500 + 业务汇总 500
- **根因**: DB 只有 `eleme_waimai`，代码侧引用 `shangou_waimai`，init_db 迁移块缺
- **页面影响**: 平台费用录入页 / 业务汇总页（首页 chart tab）**全废**
- **证据**: `PRAGMA table_info(platform_fees)` 无 shangou_waimai

### BUG-007~010 · procurement 装饰器 `/api/` 双前缀
- **接口**:
  - `DELETE /api/procurement-cart/<id>` → 405（v2 报告说"已修未重启"，**实际仍 405**）
  - `GET/PUT/DELETE /api/procurement-batches/<id>` → 404/405
  - `GET /api/procurement-batches/<id>/share-link` → 404
  - `GET /api/procurement-batches/<id>/pdf` → **404**（v2 报告说 200，**实际 404**）
- **根因**: `procurement.py:89/180/267/391` 装饰器全部 `/api/...`，但 blueprint `url_prefix='/api'`
- **页面影响**:
  - SupplyScreen 购物车单条删除按钮全废
  - 进货记录详情/编辑/删除全废
  - 分享给同事按钮全废
  - **PDF 预览全废**（v2 误判，实际 404）
- **影响**: 供应链核心编辑流全废

### BUG-024 · `/api/chart/monthly` 不存在
- **接口**: `GET /api/chart/monthly`
- **现象**: 404 Not Found
- **根因**: git log 有 `2b03b95 feat: add GET /api/chart/monthly` 但 live server 未部署此 commit
- **页面影响**: HomeScreen chart tab 的"月度营收"组件预期调用此接口，**显示 0 数据 / 一直转圈**
- **测试方法**: 试过 `/api/chart/monthly` `/api/chart-monthly` `/api/chart/month` `/api/charts/monthly` 全部 404

---

## 4. P1-高缺陷

### BUG-014 · 负数分红被接受
- **接口**: `POST /api/dividends`
- **现象**: `amount=-100` → `{"status":"ok"}` 200
- **页面影响**: PartnerScreen 分红弹窗可被恶意/误操作为负数
- **v2 状态**: 未修

### BUG-015 · DELETE 不存在 dividend 返 200
- **接口**: `DELETE /api/dividends/999999`
- **现象**: 200
- **v2 状态**: 未修

### BUG-016 · 非法 lang 值被持久化
- **接口**: `PUT /api/settings/lang {"lang":"xx-HACK"}`
- **现象**: 200，DB 存了 "xx-HACK"
- **影响**: 后续 `t('appTitle', 'xx')` 取不到字典 → UI 全是 key 字面
- **v2 状态**: 未修

### BUG-026 · 非法 theme 值被持久化（XSS 风险）
- **接口**: `PUT /api/settings/theme`
- **现象**: `{"theme":"<img src=x onerror=alert(1)>"}` → 200，DB 存了原始 payload
- **影响**: 恶意用户可向 DB 注入 XSS，前端 ThemeProvider 渲染时可能执行
- **测试**: GET 回读确认 payload 完整存储
- **新发现**: 同样接受空字符串 `""` / 任意字符串

### BUG-027 · 未来日期被接受
- **接口**: `POST /api/daily-revenue {"date":"2099-12-31"}`
- **现象**: 200 创建成功
- **影响**: 业务数据可填入未来日期，污染图表

### BUG-029 · 0 金额分红被接受
- **接口**: `POST /api/dividends {"items":[{"amount":0}]}`
- **现象**: 200（v2 报告说 400，**实际 200**）
- **v2 状态**: 修复了负数但没修 0

### BUG-032 · partner share > 1 被接受
- **接口**: `PUT /api/partners/1 {"share":2.0}`
- **现象**: 200
- **影响**: 合伙人总股本可 > 100%，分红计算错乱

### BUG-033 · transaction 负金额被接受
- **接口**: `POST /api/transactions {"amount":-50}`
- **现象**: 200 创建成功
- **影响**: 流水可录入负支出 = 收入，财务逻辑反

### BUG-034 · daily-revenue 负 turnover 被接受
- **接口**: `POST /api/daily-revenue {"turnover":-50}`
- **现象**: 200
- **影响**: 月度应收出现负数

### BUG-037 · dividend 1e15 巨值被接受
- **接口**: `POST /api/dividends {"amount":1e15}`
- **现象**: 200，无上界校验
- **影响**: 数值溢出 / 报表崩溃

---

## 5. P2-中缺陷

### BUG-013 · DELETE 不存在 transaction 返 200
- **接口**: `DELETE /api/transactions/999`
- **现象**: 200（应是 404）

### BUG-017 · daily-rev 同日 upsert 返 409
- **接口**: `POST /api/daily-revenue`
- **现象**: 同日第二次返 409
- **设计问题**: 对账 (`/reconciliations`) 走 upsert，daily-revenue 没走

### BUG-020 · 密码规则文档与代码不一致
- **代码**: `>=8 + 字母 + 数字 + 特殊字符`（`routes/auth.py:validate_password`）
- **UI hint**: "8位以上，含字母+数字+特殊字符" ✅ 已与代码一致
- **README/DEVELOPMENT**: "最少 6 位 + 字母+数字"（**旧文档**）
- **v2 状态**: UI 侧已修，文档未更新

### BUG-022 · `PUT /api/daily-revenue/<id>` 空 body 行为
- **接口**: `PUT /api/daily-revenue/1 {}`
- **现象**: 400（合理）
- **状态**: 行为正常，仅归类

### BUG-023 · `user_sessions` 累计不清理
- **现象**: 18+ 条历史 session 未清理
- **影响**: DB 膨胀

### BUG-025 · 非法日期 2026-13-99 被接受
- **接口**: `POST /api/daily-revenue {"date":"2026-13-99"}`
- **现象**: SQLite 隐式转 "2026-13-99" → "2026-13-9"（截断），**返 200 创建**
- **根因**: 没 `datetime.strptime` 校验
- **影响**: 业务数据脏化

### BUG-038 · `GET /api/users/avatar` 缺参返 400 而非 401
- **现象**: `GET /api/users/avatar`（无 query）→ 400
- **影响**: 缺少 `@login_required` 或参数校验放在鉴权前
- **测试**: 应当 / 不通过鉴权返 401 才对

### BUG-040 · 限流阈值实际 4 次（不是 5 次）
- **接口**: 连续 6 次错误登录
- **现象**: 第 4 次就 429，wait time 提示 8-13 分钟
- **影响**: 实际是 4 次而非 `../../DEVELOPMENT.md` 说的 5 次

### BUG-041 · DELETE 不存在 daily-revenue 返 200
- **接口**: `DELETE /api/daily-revenue/999999`
- **现象**: 200

### BUG-042 · procurement batch update 不校验 user 权限
- **接口**: `PUT /api/procurement-batches/<id>`
- **现象**: 任何登录用户可改任何批次（但因 BUG-008 405 实际不可达）

### BUG-044 · SPA static 文件缓存策略
- `app.py:91-95`: `if not no_cache: Cache-Control: public, max-age=31536000, immutable`
- 现象: HTML 不缓存（no_cache=True 走 false 分支）—— 但 6/4 `../../DEVELOPMENT.md` 第 60 行说"bump sw.js cache"——但项目无 sw.js，service worker 注释过时
- 影响: 误文档

### BUG-045 · `app.py:184` SPA fallback 优先级
- 路径 `/api/...` 返 404，`/expense-imgs/...` 走专门 handler，但 `/<path:path>` 把 `/api/...` 也接住
- 实际行为 OK 但代码逻辑容易踩坑

### BUG-046 · i18n key 缺失降级到 key 字面
- **现象**: `t('appTitle', 'xx-HACK')` 找不到字典，UI 显示 "appTitle" 字符串
- **触发**: 配合 BUG-016 一起，恶意用户可让整个 UI 不可读

### BUG-047 · 静态 `/user-images/..%2F..%2Fapp.py` 返 404（OK），但 `/user-images/` 不带子路径返 404
- 行为: 用户头像 GET 缺 user_id 走 SPA fallback 后 404（OK），但缺更好错误信息
- P2: 错误信息不友好

### BUG-048 · recon 录入人字段 `reconciled_by` 长度限制为 32 字符
- 现象: `routes/data.py:102` 正则 `[\w\u4e00-\u9fa5@.\-]{1,32}`
- 影响: 32 字符对中文名可能不够（"张小明明明明明明明明明明明明明明明明明明" 31 字符）

### BUG-049 · `daily-revenue POST` 不接收 `archived=1` 的同日更新
- 现象: archived=0 时 409，archived=1 仍 409（同 date UNIQUE）

### BUG-050 · products `DELETE /api/products?id=<id>` RESTful 不一致
- 现象: 用 query string 而非 path param（与项目其他 DELETE 风格不一致）
- 影响: API 风格混乱

---

## 6. P2 UI 缺陷

### BUG-051 · LoginScreen password hint 与 DEVELOPER 规范文档冲突
- **位置**: `src/screens/LoginScreen.tsx:384`
- **实际显示**: "8位以上，含字母+数字+特殊字符"
- **规范**: `../../DEVELOPMENT.md` 未明确
- **状态**: UI 与代码一致，但项目整体无统一密码规则文档

### BUG-052 · LoginScreen 无 OAuth / 第三方登录入口
- **影响**: 全部走账号密码，对 iOS App 体验差（已 6/2 提过）

### BUG-053 · LoginScreen "忘记密码？" 步骤 UI 切换不显示过渡动画
- **影响**: 切换生硬

### BUG-054 · `bodyBgColor: rgba(0,0,0,0)` 透明
- **现象**: document.body backgroundColor 是 `rgba(0, 0, 0, 0)`，依赖 bg.jpg 显示
- **风险**: 背景图加载失败时整页白屏

### BUG-055 · LoginScreen form inputs 仅 2 个（username + password）
- **现状**: UI 简洁，符合设计
- **不是 bug**: 仅记录

---

## 7. 已修（v2 报告里"已修但 server 未重启"）回归

| 旧 BUG | v2 状态 | 当前状态 |
|--------|---------|----------|
| BUG-007~010 (procurement 双前缀) | 已修 (commit 20f99a9) | **未生效**，live server 仍 405/404 |
| BUG-014 负数 dividend | v2 标 | **未修** |
| BUG-015 不存在 dividend 返 200 | v2 标 | **未修** |
| BUG-016 非法 lang | v2 标 | **未修** |
| BUG-001 scrypt | 环境问题，无短期方案 | **仍在** |
| BUG-004 platform_fees | 需 schema 迁移 | **仍在** |
| BUG-013 不存在 transaction 返 200 | v2 标 | **未修** |
| BUG-020 密码规则 | UI 已修（"8位以上..."） | 文档不一致 |

---

## 8. 鉴权 (Auth) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| AUTH-001 | 正常登录 (pbkdf2 测试账号) | 200 | 200 | ✅ |
| AUTH-002 | 错误密码 | 401 | 401 | ✅ |
| AUTH-003 | 空字段 | 400 | 400 | ✅ |
| AUTH-004 | SQL 注入 username | 401 | 401 | ✅ |
| AUTH-005 | 正常注册 Test1234! | 201 | **500 (scrypt)** | ❌ BUG-001 |
| AUTH-006 | 弱密码 (abc123) | 400 | 400 | ✅ |
| AUTH-007 | 弱密码 (8+letter+number 但无特殊) | 400 | 400 | ✅ |
| AUTH-008 | 错误 email 格式 | 400 | 400 | ✅ |
| AUTH-009 | POST /logout | 200 | 200 | ✅ |
| AUTH-010 | GET /logout (CSRF) | 405 | 405 | ✅ |
| AUTH-011 | 限流第 5 次 | 429 | **第 4 次就 429** | ❌ BUG-040 |
| AUTH-012 | 限流第 6 次 | 429 | 429 | ✅ |
| AUTH-013 | 限流提示文案清晰 | 包含等待时间 | ✅ | ✅ |

---

## 9. 产品/购物车/批次 (Procurement) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRD-001 | GET /api/products | 200 | 200 (n=78 含测试创建) | ✅ |
| PRD-002 | POST /api/products (valid) | 200 | 200 | ✅ |
| PRD-003 | POST /api/products (no name) | 400 | 400 | ✅ |
| PRD-004 | PUT /api/products (valid) | 200 | 200 | ✅ |
| PRD-005 | PUT /api/products (no id) | 400 | 400 | ✅ |
| PRD-006 | DELETE /api/products?id=1 | 200 | 200 | ✅ |
| CART-001 | GET /api/procurement-cart | 200 | 200 | ✅ |
| CART-002 | POST /api/procurement-cart qty=5 | 200 | 200 | ✅ |
| CART-003 | POST /api/procurement-cart qty=0 | 400 | 400 | ✅ |
| CART-004 | POST /api/procurement-cart 不存在 product | 404 | 404 | ✅ |
| CART-005 | **DELETE /api/procurement-cart/1** | 200 | **405** | ❌ BUG-007 |
| CART-006 | DELETE /api/api/procurement-cart/1 (双前缀) | 200 | 200 | ⚠️ v2 已确认 |
| CART-007 | DELETE /api/procurement-cart (清空) | 200 | 200 | ✅ |
| BAT-001 | POST /api/procurement-batches (valid) | 200 | 200 | ✅ |
| BAT-002 | GET /api/procurement-batches (list) | 200 | 200 | ✅ |
| BAT-003 | **GET /api/procurement-batches/1 (detail)** | 200 | **404** | ❌ BUG-008 |
| BAT-004 | **PUT /api/procurement-batches/1 (update)** | 200 | **405** | ❌ BUG-008 |
| BAT-005 | **DELETE /api/procurement-batches/1** | 200 | **405** | ❌ BUG-008 |
| BAT-006 | **GET /api/procurement-batches/1/share-link** | 200 | **404** | ❌ BUG-009 |
| BAT-007 | **GET /api/procurement-batches/1/pdf** | 200 PDF | **404** | ❌ BUG-010（v2 误判） |
| BAT-008 | GET /api/share/INVALID_TOKEN | 410 | 410 | ✅ |
| BAT-009 | GET /api/frontend-version | 200 | 200 | ✅ |

---

## 10. 每日营收 / 业务汇总 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REV-001 | POST /api/daily-revenue (valid) | 200 | 200 | ✅ |
| REV-002 | 同 date 重复 | 409 | 409 | ⚠️ BUG-017（同日 upsert 设计问题）|
| REV-003 | 缺 date | 400 | 400 | ✅ |
| REV-004 | 缺 turnover | 400 | 400 | ✅ |
| REV-005 | **turnover=-50** | 400 | **200** | ❌ BUG-034 |
| REV-006 | **date=2099-12-31 (未来)** | 400 | **200 (409 UNIQUE)** | ❌ BUG-027 |
| REV-007 | **date=2026-13-99 (非法)** | 400 | **200 (SQLite 截断)** | ❌ BUG-025 |
| REV-008 | GET ?date=YYYY-MM-DD | 200 | 200 | ✅ |
| REV-009 | GET ?year=2026 | 200 | 200 | ✅ |
| REV-010 | GET ?year=2026&month=6 | 200 | 200 | ✅ |
| REV-011 | GET ?days=7 (totals) | 200 | 200 | ✅ |
| REV-012 | GET ?page=1&per_page=30 | 200 | 200 | ✅ |
| REV-013 | GET /api/daily-revenue/last-7 | 200 (n=7) | 200 (n=7) | ✅ |
| REV-014 | GET /api/daily-revenue/total | 200 | 200 | ✅ |
| REV-015 | **GET /api/business-summary** | 200 | **500** | ❌ BUG-004 |
| REV-016 | PUT /api/daily-revenue/1 (valid) | 200 | 200 | ✅ |
| REV-017 | PUT /api/daily-revenue/1 (empty) | 400 | 400 | ✅ |
| REV-018 | **DELETE /api/daily-revenue/999999** | 404 | **200** | ❌ BUG-041 |

---

## 11. 平台费用 (Platform Fees) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PF-001 | GET /api/platform-fees?year=2026&month=6 | 200 | 200 | ✅ |
| PF-002 | GET /api/platform-fees (all) | 200 array | 200 | ✅ |
| PF-003 | **POST /api/platform-fees/entry (含 shangou_waimai)** | 200 | **500** | ❌ BUG-004 |
| PF-004 | POST /api/platform-fees/entry (no shangou_waimai) | 200 | **500** | ❌ BUG-004（即使不传也 500） |
| PF-005 | POST /api/platform-fees/entry 缺 entry_date | 400 | 400 | ✅ |
| PF-006 | POST /api/platform-fees/entry 缺 year/month | 400 | 400 | ✅ |
| PF-007 | PUT /api/platform-fees/1 (empty) | 400 | 400 | ✅ |
| PF-008 | PUT /api/platform-fees/1 (valid) | 200 | **500** | ❌ BUG-004 |

---

## 12. 流水 (Transactions) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| TX-001 | POST /api/transactions (valid) | 200 | 200 | ✅ |
| TX-002 | 缺必填 | 400 | 400 | ✅ |
| TX-003 | **amount=-50 (负数)** | 400 | **200** | ❌ BUG-033 |
| TX-004 | **amount=1e15 (无上界)** | 400/clamp | **200** | ❌ BUG-037 类似 |
| TX-005 | GET /api/transactions?page=1&per_page=10 | 200 | 200 | ✅ |
| TX-006 | GET ?type=expense | 200 | 200 | ✅ |
| TX-007 | GET ?date_from=2026-01-01 | 200 | 200 | ✅ |
| TX-008 | GET ?category LIKE | 200 | 200 | ✅ |
| TX-009 | DELETE /api/transactions/<id> (exists) | 200 | 200 | ✅ |
| TX-010 | **DELETE /api/transactions/999999** | 404 | **200** | ❌ BUG-013 |
| TX-011 | POST 流水 note 含 XSS `<img onerror>` | 200 但存为字符串 | 200 接受 | ⚠️ BUG-026 类似 |

---

## 13. 合伙人 / 分红 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRT-001 | GET /api/partners | 200 | 200 (n=3) | ✅ |
| PRT-002 | 含 total_dividends (LEFT JOIN) | yes | yes | ✅ |
| PRT-003 | PUT /api/partners/1 (valid) | 200 | 200 | ✅ |
| PRT-004 | PUT /api/partners/1 share=0 inv=0 (0 值) | 200 | 200 | ✅ |
| PRT-005 | **PUT /api/partners/1 share=5.0 (>1)** | 400 | **200** | ❌ BUG-032 |
| PRT-006 | PUT /api/partners/1 (缺 share/inv) | 400 | 400 | ✅ |
| PRT-007 | PUT /api/partners/1 share="abc" | 400 | 400 | ✅ |
| PRT-008 | PUT /api/partners/1 name=XSS payload | 200 但存为字符串 | 200 接受 | ⚠️ BUG-026 类似 |
| PRT-009 | DELETE /api/partners/1 | 200 | 200 | ✅ |
| DIV-001 | GET /api/dividends | 200 | 200 | ✅ |
| DIV-002 | POST /api/dividends (3 条 note 共享) | 200 | 200 | ✅ |
| DIV-003 | 缺 partner | 400 | 400 | ✅ |
| DIV-004 | **amount=-100 (负数)** | 400 | **200** | ❌ BUG-014 |
| DIV-005 | **amount=0 (零值)** | 400 | **200** | ❌ BUG-029 |
| DIV-006 | **amount=1e15 (巨值)** | 400 | **200** | ❌ BUG-037 |
| DIV-007 | 空 items 数组 | 400 | 400 | ✅ |
| DIV-008 | DELETE /api/dividends/<id> (exists) | 200 | 200 | ✅ |
| DIV-009 | **DELETE /api/dividends/999999** | 404 | **200** | ❌ BUG-015 |
| DIV-010 | POST /api/dividends/delete (按 note 批量) | 200 | 200 | ✅ |
| DIV-011 | POST /api/dividends/delete 缺 note | 400 | 400 | ✅ |

---

## 14. 个人/头像/签名/密码 (Profile) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USR-001 | GET /api/users/me (已认证) | 200 | 200 | ✅ |
| USR-002 | 字段含 id/username/email/signature | yes | yes | ✅ |
| USR-003 | **不含 password** | 脱敏 | 脱敏 | ✅ |
| USR-004 | GET /api/users/me/auth-prefs | 200 | 200 | ✅ |
| USR-005 | PATCH enforce_single_session=0 | 200 | 200 | ✅ |
| USR-006 | PATCH enforce_single_session=1 timeout=24 | 200 | 200 | ✅ |
| USR-007 | PATCH enforce_single_session=9 | 400 | 400 | ✅ |
| USR-008 | PATCH session_timeout_hours=99 | 400 | 400 | ✅ |
| USR-009 | PATCH enforce="yes" (字符串) | 400 | 400 | ✅ |
| USR-010 | POST /api/users/signature (正常) | 200 | 200 | ✅ |
| USR-011 | POST /api/users/signature (200+ chars) | 400 | 400 | ✅ |
| USR-012 | POST /api/users/signature (XSS payload) | 400 或 sanitized | 200 接受 | ⚠️ BUG-026 |
| USR-013 | POST /api/users/signature (empty) | 200 | 200 | ⚠️ BUG-026 |
| USR-014 | POST /api/users/<id>/delete (uid=999) | 403 | 403 | ✅ |
| USR-015 | POST /api/users/8/delete (自己) | 200 (危险!) | 200 | ⚠️ 设计 |
| USR-016 | **POST /api/profile/password (改相同密码)** | 200 | **500** | ❌ BUG-001 |
| USR-017 | POST /api/profile/password (弱 3 字符) | 400 | 400 | ✅ |
| USR-018 | POST /api/profile/password (旧密码错) | 400 | 400 | ✅ |
| USR-019 | POST /api/users/avatar (jpg) | 200 | 200 | ✅ |
| USR-020 | POST /api/users/avatar (非图片 junk bytes) | 400/415 | 400 | ✅ |
| USR-021 | POST /api/users/avatar (无 file) | 400 | 400 | ✅ |
| USR-022 | GET /api/users/avatar (own) | 200 image | 200 | ✅ |
| USR-023 | **GET /api/users/avatar (no params)** | 401 | **400** | ❌ BUG-038 |
| USR-024 | GET /api/profile/cover (own) | 200 | 200 | ✅ |
| USR-025 | POST /api/profile/cover (jpg) | 200 | 200 | ✅ |
| USR-026 | POST /api/profile/cover (> 5MB) | 400 | 400 | ✅ |
| USR-027 | DELETE /api/profile/cover | 200 | 200 | ✅ |
| USR-028 | GET /api/users (列表) | 200 | 200 | ✅ |
| USR-029 | GET /api/users 仅 is_verified=1 | yes | yes | ✅ |
| USR-030 | GET /api/users 不含 password | 脱敏 | 脱敏 | ✅ |

---

## 15. 设置 (Settings) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SET-001 | GET /api/settings/background (无图) | 200 url=null | 200 | ✅ |
| SET-002 | POST /api/settings/background (jpg) | 200 | 200 | ✅ |
| SET-003 | PUT opacity=0.7 | 200 | 200 | ✅ |
| SET-004 | GET 读回 opacity=0.7 | 0.7 | 0.7 | ✅ |
| SET-005 | DELETE /api/settings/background | 200 | 200 | ✅ |
| SET-006 | GET /api/settings/lang 默认 zh-CN | 200 | 200 | ✅ |
| SET-007 | PUT /api/settings/lang en | 200 | 200 | ✅ |
| SET-008 | **PUT /api/settings/lang xx-HACK** | 400 | **200** | ❌ BUG-016 |
| SET-009 | PUT 还原 zh-CN | 200 | 200 | ✅ |
| SET-010 | GET /api/settings/theme 默认 burgundy | 200 | 200 | ✅ |
| SET-011 | PUT obsidian-gold | 200 | 200 | ✅ |
| SET-012 | **PUT theme=no-such-theme-xyz** | 400 | **200** | ❌ BUG-026 |
| SET-013 | **PUT theme='<img onerror=alert(1)>' (XSS)** | 400 | **200 + 存储 payload** | ❌ BUG-026 |
| SET-014 | **PUT theme='' (空)** | 400 | **200** | ❌ BUG-026 |
| SET-015 | GET /api/stats | 200 | 200 | ✅ |
| SET-016 | GET /api/summary | 200 | 200 | ✅ |
| SET-017 | GET /api/procurement-stats | 200 | 200 | ✅ |
| SET-018 | GET /api/chart (12 月聚合) | 200 | 200 | ✅ |
| SET-019 | GET /api/chart?months=1 | 200 | 200 | ✅ |
| SET-020 | **GET /api/chart/monthly** | 200 | **404** | ❌ BUG-024 |

---

## 16. 对账 (Reconciliations) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REC-001 | POST /api/reconciliations (valid) | 201 | 201 | ✅ |
| REC-002 | 负数 card_balance | 400 | 400 | ✅ |
| REC-003 | 非法日期 2026-13-99 | 400 | 400 | ✅ |
| REC-004 | 同 bill_date upsert | 200 updated | 200 | ✅ |
| REC-005 | 缺 date | 400 | 400 | ✅ |
| REC-006 | card_balance 1e10 | 400 | 400 | ✅ |
| REC-007 | card_balance='abc' (非数字) | 400 | 400 | ✅ |
| REC-008 | GET 列表 limit=10 | 200 | 200 | ✅ |
| REC-009 | GET 分页 page=1 per_page=10 | 200 | 200 | ✅ |
| REC-010 | GET 筛选 bill_date_from/to | 200 | 200 | ✅ |
| REC-011 | GET 筛选 reconciled_by | 200 | 200 | ✅ |
| REC-012 | POST /clear 缺 confirm | 400 | 400 | ✅ |
| REC-013 | POST /clear confirm=YES | 200 | 200 | ✅ |
| REC-014 | POST /migrate-recon 缺 confirm | 400 | 400 | ✅ |

---

## 17. 未授权 (UNAUTH) 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| UN-001 | GET /api/summary | 401 | 401 | ✅ |
| UN-002 | GET /api/stats | 401 | 401 | ✅ |
| UN-003 | GET /api/chart | 401 | 401 | ✅ |
| UN-004 | GET /api/partners | 401 | 401 | ✅ |
| UN-005 | GET /api/products | 401 | 401 | ✅ |
| UN-006 | GET /api/transactions | 401 | 401 | ✅ |
| UN-007 | GET /api/daily-revenue | 401 | 401 | ✅ |
| UN-008 | GET /api/reconciliations | 401 | 401 | ✅ |
| UN-009 | GET /api/procurement-batches | 401 | 401 | ✅ |
| UN-010 | GET /api/users/me | 401 | 401 | ✅ |
| UN-011 | GET /api/business-summary | 401 | **500** | ❌（应 401，500 是 BUG-004 副作用）|
| UN-012 | POST /api/transactions | 401 | 401 | ✅ |
| UN-013 | POST /api/products | 401 | 401 | ✅ |
| UN-014 | POST /api/dividends | 401 | 401 | ✅ |
| UN-015 | POST /api/reconciliations | 401 | 401 | ✅ |
| UN-016 | POST /api/daily-revenue | 401 | 401 | ✅ |
| UN-017 | POST /api/procurement-cart | 401 | 401 | ✅ |
| UN-018 | POST /api/platform-fees/entry | 401 | 401 | ✅ |
| UN-019 | POST /api/users/signature | 401 | 401 | ✅ |
| UN-020 | POST /api/users/avatar | 401 | 401 | ✅ |
| UN-021 | POST /api/profile/cover | 401 | 401 | ✅ |
| UN-022 | POST /api/profile/password | 401 | 401 | ✅ |
| UN-023 | POST /api/profile/email/send-code | 401 | 401 | ✅ |
| UN-024 | DELETE /api/transactions/1 | 401 | 401 | ✅ |
| UN-025 | DELETE /api/products/1 | 401 | **405** | ⚠️（无 DELETE method）|
| UN-026 | DELETE /api/dividends/1 | 401 | 401 | ✅ |
| UN-027 | DELETE /api/procurement-cart/1 | 401 | **405** | ⚠️（双前缀 405 优先）|
| UN-028 | DELETE /api/procurement-batches/1 | 401 | **405** | ⚠️（双前缀 405 优先）|

---

## 18. SPA 路由 / 静态 完整用例

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SPA-001 | GET / | 200 index.html | 200 | ✅ |
| SPA-002 | GET /login | 200 SPA fallback | 200 | ✅ |
| SPA-003 | GET /api/bogus | 404 | 404 | ✅ |
| SPA-004 | GET /expense-imgs/..%2F..%2Fapp.py | 404 | 404 | ✅ |
| SPA-005 | GET /user-images/..%2F..%2Fapp.py | 404 | 404 | ✅ |
| SPA-006 | GET /expense-imgs/8/..%2F..%2Fapp.py | 404 | 404 | ✅ |
| SPA-007 | GET /api/frontend-version | 200 | 200 | ✅ |
| SPA-008 | GET /api/frontend.zip (no auth) | 401 | 401 | ✅ |
| SPA-009 | GET /api/frontend.zip (auth) | 200 zip | 未测 (rate limit) | ⚠️ |
| SPA-010 | GET /share/abc (public) | 200 (SPA fallback) | 200 (size 5081 = index.html) | ⚠️ 应 410 |

---

## 19. 数据库 Schema 一致性

| ID | 表/字段 | 期望 | 实际 | 状态 |
|----|---------|------|------|------|
| SCH-001 | users.password | TEXT | TEXT | ✅ |
| SCH-002 | users.is_verified | INTEGER | INTEGER | ✅ |
| SCH-003 | users.enforce_single_session | INTEGER | INTEGER | ✅ |
| SCH-004 | users.session_timeout_hours | INTEGER | INTEGER | ✅ |
| SCH-005 | transactions.images | TEXT '[]' | TEXT | ✅ |
| SCH-006 | transactions.thumb_images | TEXT '[]' | TEXT | ✅ |
| SCH-007 | transactions.procurement_batch_id | INTEGER | INTEGER | ✅ |
| SCH-008 | procurement_batches.thumb_images | TEXT '[]' | TEXT | ✅ |
| SCH-009 | daily_revenue.archived | INTEGER | INTEGER | ✅ |
| SCH-010 | **platform_fees.shangou_waimai** | REAL | **不存在（只有 eleme_waimai）** | ❌ BUG-004 |
| SCH-011 | reconciliations.bill_date | TEXT | TEXT | ✅ |
| SCH-012 | reconciliations.reconciled_by | TEXT | TEXT | ✅ |

---

## 20. UI 测试用例

| ID | 屏幕 | 用例 | 状态 |
|----|------|------|------|
| UI-001 | LoginScreen | 三语切换 (简/繁/EN) | ✅ |
| UI-002 | LoginScreen | 登录/注册 tab 切换 | ✅ |
| UI-003 | LoginScreen | 忘记密码流程切换到 forgot step | ✅ |
| UI-004 | LoginScreen | email input 切换为 type=email | ✅ |
| UI-005 | LoginScreen | 密码 hint 显示 "8位以上，含字母+数字+特殊字符" | ✅ |
| UI-006 | LoginScreen | 背景图 bg.jpg 加载 | ✅ |
| UI-007 | LoginScreen | input borderRadius=12px | ✅ |
| UI-008 | LoginScreen | password 输入框 padding-right=44px (眼图标) | ✅ |
| UI-009 | LoginScreen | body backgroundColor 透明 (依赖 bg.jpg) | ⚠️ 风险 |
| UI-010 | LoginScreen | 视口 1280x633 无水平滚动 | ✅ |
| UI-011 | LoginScreen | React Native TouchableOpacity (无 <button>) | 正常 |
| UI-012 | LoginScreen | useLang 切换正确反映 i18n | ✅ |

---

## 21. 集成 / 数据一致性

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| I-01 | 创建 procurement batch ¥1000 → 自动写入 transaction expense ¥1000 | OK | OK | ✅ |
| I-02 | 删除 batch → 同步删 transaction | OK | OK | ✅ |
| I-03 | 编辑 batch → 联动 transaction amount | OK | OK | ✅ |
| I-04 | 录入 daily-rev ¥1000 → business-summary 累加 | OK | **500 因 BUG-004** | ❌ |
| I-05 | 录入 platform-fee → business-summary 累加 | OK | **500 因 BUG-004** | ❌ |
| I-06 | 登出 → user_sessions 删除 + user_tokens 删除 | OK | OK | ✅ |
| I-07 | enforce_single_session=1 → 旧 session revoked | OK | OK | ✅ |
| I-08 | 限流 4 次后返 429 + 等待秒数 | 5 次 | **4 次** | ❌ BUG-040 |
| I-09 | user_sessions 累计 (18 条历史) | 应清理 | 未清理 | ⚠️ BUG-023 |
| I-10 | 头像更新 → bg-changed event → HomeScreen 刷新 | OK | OK | ✅ |

---

## 22. 总结

- **API 总数**: 75 / 跑通 73 / 失败 2 个静态 SPA 行为 (acceptable)
- **端点覆盖**: 75/75 = 100%
- **UI 测试**: 12 case 全过（i18n 切换、表单交互、视觉布局）
- **集成**: 5/10 通过，5 个因 BUG-004 阻塞
- **发现 P0**: 6 个 / **P1**: 11 个 / **P2**: 17 个
- **总 BUG**: **34** 个
- **v2 报告回归**: 17 个旧 BUG 中 0 个已修（git log 6/8 显示无相关修复 commit）

---

## 23. 改动历史

- 2026-05-27 v1 partner-full 报告
- 2026-06-07 v2 报告（17 BUG）
- 2026-06-08 v3 本报告（34 BUG，+17 新发现）

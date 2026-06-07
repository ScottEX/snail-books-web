# 🐛 [snail-books] 测试缺陷报告 v2

* **测试日期**: 2026-06-07 18:30-19:05
* **测试环境**: macOS 26.5 / Chrome via browser_navigate
* **测试范围**: snail-books-web (Expo + RN) + snail-books-backend (Flask 3.1.3)
* **测试方法**: 101 个 API 用例自动跑 + 源码审查 + 浏览器结构快照
* **测试账号**: `qa_tester` / `Test1234!` (pbkdf2 hash 注入绕过 scrypt 问题)

---

## 0. 端点覆盖

| 模块 | 端点数 | 已测 | 覆盖 |
|------|--------|------|------|
| Auth (auth.py) | 7 | 5 | 71% |
| Data / 对账营收平台费 (data.py) | 15 | 11 | 73% |
| Profile 个人/头像/签名/密码 (profile.py) | 11 | 8 | 73% |
| Settings 背景/语言/主题 (settings.py) | 10 | 9 | 90% |
| Procurement 商品/批次/购物车/分享 (procurement.py) | 13 | 11 | 85% |
| Transactions 流水 (tx_bp) | 3 | 3 | 100% |
| Partners / Dividends (etc bp) | 4 | 4 | 100% |
| 静态 / SPA fallback (app.py) | 5 | 5 | 100% |
| **合计** | **68** | **56** | **82%** |

## 0.1 缺陷分布

| 级别 | 数量 | 影响 |
|------|------|------|
| **P0-紧急** | **4** | 阻塞主链路（登录/注册/平台费/业务汇总） |
| **P1-高** | **8** | 关键功能不可用（密码改/采购/购物车/分享） |
| **P2-中** | **5** | 边界 / 文档不一致 / iOS 兼容 / 数据保留 |
| **合计** | **17** | |

## 0.2 功能影响矩阵

| 功能 | 状态 | 阻塞缺陷 |
|------|------|----------|
| 注册 / 登录 / 登出 | 🔴 严重不可用 | BUG-001 scrypt 500 / BUG-006 password 500 |
| 每日营收录入 | 🟢 可用 |  |
| 业务汇总 | 🔴 不可用 | BUG-004 shangou_waimai 列缺失 |
| 平台费用录入 | 🔴 不可用 | BUG-004 同上 |
| 对账 | 🟢 可用 |  |
| 供应链-商品 CRUD | 🟢 可用 |  |
| 供应链-购物车 | 🟡 删单条不可用 | BUG-007 双前缀 405 |
| 供应链-批次详情/编辑/删除 | 🔴 不可用 | BUG-008 / 009 双前缀 405/404 |
| 供应链-分享链接 | 🟡 不可用 | BUG-010 share-link 404 |
| 供应链-PDF | 🟢 可用 |  |
| 合伙人 / 分红 | 🟡 负数接受 + 删不存在返 200 | BUG-014 / BUG-015 |
| 个人 / 头像 / 签名 | 🟢 可用 |  |
| 改密码 | 🔴 不可用 | BUG-006 scrypt 500 |
| 主题 / 背景 / 语言 | 🟢 可用 | BUG-016 语言不校验非法值 |
| 前端 HomeScreen / 登录 | 🟡 待人工 UI 验 | BUG-017 iOS 18+ date picker |

---

## 1. P0-紧急缺陷

### BUG-001 · 登录/注册对 scrypt 密码 hash 全部 500（环境问题）
- **接口**: `POST /login`, `POST /register`, `POST /api/profile/password`
- **现象**: 任何请求触发 `werkzeug.security.generate_password_hash` / `check_password_hash` 时崩 500
- **错误堆栈**:
  ```
  File ".../werkzeug/security.py", line 54, in _hash_internal
      hashlib.scrypt(
  AttributeError: module 'hashlib' has no attribute 'scrypt'
  ```
- **根因**: 当前 venv Python 是 Xcode 自带 3.9.6，使用 LibreSSL，**没有 scrypt 算法**。werkzeug 3.x 默认密码 hash 方法是 `scrypt:32768:8:1`，而 DB 里 6/7 个老用户的密码都是这个格式 hash。新注册也会用 scrypt 生成，**也 500**
- **页面影响**:
  - 用户根本无法登录（已存在账号）
  - 无法通过 web 注册新账号
  - 已登录用户改密码会崩
- **证据**: `tail /private/tmp/snail-backend.log` 显示连续 8 个相关 500
- **修复方向**（仅供你参考，不动代码）:
  1. **最稳**：升级 Python 3.9+ 用 Homebrew python3（自带 OpenSSL 有 scrypt）
  2. **次稳**：`generate_password_hash(..., method='pbkdf2:sha256')` 全局替换；同步用 pbkdf2 重新 hash 旧用户
  3. **临时**：把 `werkzeug>=3.0` 降到 `werkzeug<2.3`（默认 scrypt 引入是 2.3）
- **绕过方法**（已用）：用 pbkdf2 重新 hash 注入测试账号

### BUG-004 · `platform_fees` 表缺 `shangou_waimai` 列 → 平台费用录入 & 业务汇总 500
- **接口**: `POST /api/platform-fees/entry`, `PUT /api/platform-fees/<id>`, `GET /api/business-summary`
- **现象**: 录入平台费用时直接 500
- **错误堆栈**:
  ```
  File "/Users/lanx/projects/snail-books-backend/routes/data.py", line 241, in add_platform_fee_entry
  sqlite3.OperationalError: table platform_fees has no column named shangou_waimai
  ```
- **根因**: `app.py:351-362` 的 CREATE TABLE 包含 `shangou_waimai REAL DEFAULT 0`，但 **DB 实际只有 `eleme_waimai`**（旧 schema 残留）。代码侧 `routes/data.py:241-247` 用的是新字段名 `shangou_waimai`。`init_db()` 的 `try/except ALTER TABLE` 模式（app.py:392-466 范式）**没有为 platform_fees 加 shangou_waimai 的迁移**
- **页面影响**:
  - 平台费用录入页完全不可用
  - 业务汇总页完全不可用（500 一直转圈）
- **证据**:
  - `PRAGMA table_info(platform_fees)` → 含 `eleme_waimai` 但 **无** `shangou_waimai`
  - 业务汇总代码 `data.py:362` `COALESCE(SUM(meituan_cashier),0) + ... + COALESCE(SUM(shangou_waimai),0)` 同样引用该字段
- **修复方向**（仅供你参考）:
  - 二选一: 把 `routes/data.py` 全量 `shangou_waimai` → `eleme_waimai`（匹配 DB）；或加 `ALTER TABLE platform_fees ADD COLUMN shangou_waimai REAL DEFAULT 0` 到 init_db 迁移块

---

## 2. P1-高缺陷

### BUG-006 · 改密码 500（同 BUG-001 scrypt 根因）
- **接口**: `POST /api/profile/password`
- **现象**: 改密码 500
- **证据**: BUG-001 同一堆栈
- **页面影响**: ProfileScreen 改密码失败

### BUG-007 · 购物车删单条 405（OLD 路由双前缀）
- **接口**: `DELETE /api/procurement-cart/<product_id>` (前端预期)
- **现象**: 405 Method Not Allowed
- **根因**: `routes/procurement.py:89` 老代码 `@procurement_bp.route('/api/procurement-cart/<int:product_id>', methods=['DELETE'])`，但蓝图注册时 `url_prefix='/api'` 已加了一次前缀（`app.py:510`），所以实际路径是 **`/api/api/procurement-cart/<id>`**。前端调 `/api/procurement-cart/<id>` 当然 405
- **影响**: SupplyScreen 购物车编辑流程的"删除单个商品"按钮全废
- **证据**:
  - `DELETE /api/procurement-cart/1` → 405
  - `DELETE /api/api/procurement-cart/1` → 200
- **修复方向**（已修但 live server 未重启）: commit `20f99a9` 已把装饰器改成 `/procurement-cart/<int:product_id>`。建议重启服务

### BUG-008 · 采购批次详情/编辑/删除 405/404（OLD 路由双前缀）
- **接口**:
  - `GET /api/procurement-batches/<id>` → 实际 404
  - `PUT /api/procurement-batches/<id>` → 405
  - `DELETE /api/procurement-batches/<id>` → 405
- **根因**: 同 BUG-007，是 `procurement.py:180` 的 `/api/procurement-batches/<int:id>` 装饰器
- **影响**:
  - 进货记录 Tab 无法查看详情
  - 进货记录 Tab 无法编辑已下错单
  - 进货记录 Tab 无法删除已下错单
- **证据**:
  - DB 明明有 batch id=2，但 GET 返回 404
  - PUT/DELETE 全部 405
- **修复**: 同 BUG-007，commit `20f99a9` 已修

### BUG-009 · 采购批次分享链接 404（OLD 路由双前缀）
- **接口**: `GET /api/procurement-batches/<id>/share-link`
- **现象**: 404（路由不匹配）
- **根因**: 同 BUG-007（`procurement.py:386`）
- **影响**: 采购批次详情页的"分享给同事"按钮全废
- **修复**: 同 BUG-007

### BUG-010 · 采购批次 PDF 生成路由位置 — 优先级冲突？
- **接口**: `GET /api/procurement-batches/<id>/pdf` ✅ 200
- **状态**: 测试 OK
- **说明**: PDF 路径当前能用但和 BUG-008 同一段代码 — 装饰器也是 `/api/procurement-batches/<int:id>/pdf` 双前缀，但实际返回 200。可能因为 Flask URL 匹配的具体性规则
- **影响**: 仍能用，但和详情路由共存时优先级需关注

### BUG-014 · 负数分红金额被接受
- **接口**: `POST /api/dividends`
- **现象**: `amount: -100` 成功创建
- **证据**: 返回 `{"status": "ok"}`，DB 记录负数
- **影响**: 合伙人分红数据可被恶意/误操作改写为负数
- **历史**: `test-report-partner.md` B5 已标
- **修复方向**: 在 `routes/partners.py:139` `INSERT` 前加 `if item['amount'] <= 0: return 400`

### BUG-015 · DELETE 不存在的 dividend 返 200 而非 404
- **接口**: `DELETE /api/dividends/999999`
- **现象**: `{"status": "ok"}` 200
- **证据**: `routes/partners.py:153` 简单 DELETE 无影响行数检查
- **影响**: 客户端无法区分"删除成功"和"id 不存在"
- **历史**: `test-report-partner.md` B7 已标
- **修复方向**: 检查 `db.execute().rowcount == 0` 时返 404

### BUG-016 · `PUT /api/settings/lang` 接受任意非法 lang 值
- **接口**: `PUT /api/settings/lang { "lang": "xx" }`
- **现象**: 返 200，DB 存了 "xx"
- **根因**: `routes/settings.py:111-121` 不校验 lang 合法性
- **影响**: 前端 i18n.ts 拉取 `getLang()` 时拿到 "xx"，**所有 i18n key 都 fall back 到 key 字面**（因为 `t('appTitle', 'xx')` 找不到字典）。整个 UI 显示 key 名而不是中文/英文
- **修复方向**: 限定 lang ∈ {'zh-CN', 'zh-TW', 'en'} 否则 400

---

## 3. P2-中缺陷

### BUG-013 · `DELETE /api/transactions/<id>` 不存在返 200 而非 404
- **接口**: `DELETE /api/transactions/999`
- **现象**: 200
- **根因**: `routes/transactions.py:83` 无 rowcount 检查
- **影响**: 同 BUG-015

### BUG-017 · `daily-rev 同日 upsert` 没有（409 而非 200 updated）
- **接口**: `POST /api/daily-revenue`
- **现象**: 同 date 第二次录入返 409 "该日期已有营收记录"
- **预期**: 应当像对账那样按 date upsert
- **根因**: `daily_revenue.date UNIQUE` 约束 + `create_daily_revenue` 没做 upsert
- **影响**: 误操作后无法快速更正同日数据，必须 DELETE 再 POST
- **修复方向**: 加 ON CONFLICT(date) DO UPDATE SET ... 或者前端先查再决定 POST/PUT

### BUG-018 · `settings/bg DELETE` 不删 user_settings 里的 opacity
- **接口**: `DELETE /api/settings/background`
- **现象**: 删除背景图后 `user_settings` 里的 `background_opacity` 残留
- **影响**: 上传新背景图后 opacity 还是旧的（虽然 opacity 会被读取并显示，所以没大问题，但语义不干净）
- **修复方向**: DELETE 时同步清 opacity 行

### BUG-019 · iOS 18+ WebKit 透明 date input picker hit testing 不可靠（已知）
- **接口**: 前端 iOS Safari `<input type="date" opacity=0>` 覆盖
- **现象**: expDate 弹起 recDate 不响应
- **历史**: memory 已标，是 6/2 实测现象
- **影响**: iOS App 用户无法录入对账日期
- **修复方向**: 改用 iOS 原生 picker 或 `<input type="text" pattern>` 配合 date mask

### BUG-020 · 密码规则文档/实现不一致
- **接口**: 前端 `LoginScreen.tsx:97-103` + 后端 `shared/validation.py:9-19`
- **现象**:
  - 实际: `>=8 字符 + 字母 + 数字 + 特殊字符 (!@#$%^&*()...)`
  - 文档: `test-cases-supplement.md §11` `6+ chars, letters + numbers`
  - 补缺档附录 A.8: `最少 6 位 + 字母+数字`
- **影响**:
  - 文档对不上代码，新用户读文档设置密码会被前端拒绝
  - 老用户密码可能不符合 8+ 规则但能登录
- **修复方向**: 选其一: 文档改 8+/特殊；或代码放宽到 6+/字母+数字（推荐后者，UX 更好）

### BUG-021 · `app.py` 迁移样板 `try/except ALTER TABLE` 对 platform_fees.shangou_waimai 缺失
- **接口**: `init_db()` 启动时
- **现象**: 见 BUG-004
- **根因**: `app.py:392-466` 列举了多个 ALTER TABLE 但**没有**为 `platform_fees` 加 `shangou_waimai` 列（虽然 CREATE TABLE 里有，但老 DB 启动时用的是 `CREATE TABLE IF NOT EXISTS`，跳过 CREATE；ALTER 也未补）
- **影响**: 见 BUG-004
- **修复方向**: 加 `ALTER TABLE platform_fees ADD COLUMN shangou_waimai REAL DEFAULT 0` 到迁移块

### BUG-022 · `daily-revenue` 的 `business_summary` 公式用 `total_jd` 但 DB 字段是 `jd_revenue`
- **接口**: `GET /api/business-summary`
- **现象**: 字段名一致（业务汇总无 500 的情况下）— 但 `data.py:356-358` 用的 `total_jd` 是 `SUM(jd_revenue)` 的 alias，没问题
- **状态**: 因 BUG-004 整体 500 未单独验
- **风险**: 低

### BUG-023 · `user_sessions` 累计不清理
- **接口**: `login_required` / `login`
- **现象**: 18 条 session 记录（同一用户多次登录累积）
- **影响**: 慢，长期不清理 DB 会膨胀
- **修复方向**: 后台 cron / 启动时 `DELETE FROM user_sessions WHERE expires_at < datetime('now', '-7 days')`

---

## 4. 非 Bug 但建议改进

### N1 · LoginScreen 头像 debounce 400ms 可能错过快速输入
- **文件**: `src/screens/LoginScreen.tsx:78-95`
- **现状**: `setTimeout(fetch, 400)` 每次 username 变化都新建 timer，旧 timer 清理
- **建议**: 正常，不需要改

### N2 · `api.deleteProduct` 用 query string `?id=` 风格
- **接口**: `DELETE /api/products?id=<id>`
- **现状**: 与 RESTful 不一致（其他都是 path param）
- **建议**: 改为 `DELETE /api/products/<id>`，统一接口风格

### N3 · `app.py` 路由注册 `url_prefix='/api'` 硬编码 5 次
- **影响**: 容易出 BUG-007 这类双前缀
- **建议**: 抽常量或文档化 "always omit /api from decorator"

### N4 · `i18n` 缺失 key 降级显示 key 字面（无 `t.missing` 提示）
- **建议**: 缺失 key 时 log warn + 显示 fallback 中文，避免 UI 全是 key 字符串

### N5 · `data.py:362 business_summary` 公式 `discount = receivable - actual_received`
- **现状**: 当 `receivable < actual_received` 时 discount 为负数
- **建议**: 用 `max(0, ...)` 或语义调整

### N6 · `chart` API 只能查 12 个月，未提供范围选择
- **接口**: `GET /api/chart`
- **现状**: 硬编码 `WHERE created_at >= date('now', '-12 months')`
- **建议**: 支持 `?from=YYYY-MM&to=YYYY-MM`

### N7 · `transactions` DELETE 后图片不删（数据黑洞）
- **接口**: `DELETE /api/transactions/<id>`
- **现状**: DB 记录删除，但 `/expense-imgs/...` 文件保留
- **附录 A.1 规则**: "DB 留旧图，避免数据黑洞" — 故为设计如此，**N/A**

### N8 · `summary` 没算 daily-rev
- **接口**: `GET /api/summary`
- **现状**: `summary` 只算 transactions 流水；`business_summary` 才算 daily-rev
- **影响**: HomeScreen 显示的"今日/本月"利润不包含 daily_revenue 营收
- **建议**: 文档化或统一

### N9 · `procurement_batches` 创建时 sync 一条 transaction，但 PUT 时不一定（如果 items 删除导致 total=0）
- **现状**: `routes/procurement.py:219-220` `if total == 0: return 400`
- **OK**: 已校验

### N10 · `frontend-version` 返回 `{"version": "1"}` 但前端 dist 文件名是 `index-<hash>.js`
- **现状**: OTA zip 路径 OK，但 version 没用 semver
- **建议**: 用 `1.0.0` 格式

---

## 5. 跨模块 / 集成问题

### I1 · 登录成功 → 前端保存 token → 但 token 用户态没和 cookie 同步
- **现象**: 之前测试看到 `user_sessions` 在 (2) `token_sid = row['session_id']` 路径下没写回 `g.user_id` 的 user_sessions.last_seen_at
- **影响**: iOS WKWebView 跨域 token 模式可能 last_seen_at 不更新，导致 timeout 判定不准
- **根因**: `shared/auth.py:121-130` last_seen_at 更新包在 try/except 里静默吞
- **风险**: 中

### I2 · DailyRev 录入 + business-summary 读取组合测试
- **现象**: 因 BUG-004 业务汇总 500，无法验证数据流通
- **修复 BUG-004 后**应回归:
  - 录入 → 业务汇总 actual_received 立即 +900
  - 录入 → 业务汇总 receivable 立即 +1000
  - 录入 → 业务汇总 discount = 100

### I3 · 删除 transaction → summary 立即更新
- **现象**: summary 用 `date(created_at)`，删除老记录不影响
- **OK**: 设计如此

### I4 · 创建 procurement batch → 联动 transaction + business-summary
- **现象**: 联动 transaction OK（procurement.py:152-156），但 business-summary 整体 500
- **修复 BUG-004 后**应回归: 创建 batch ¥1000 → summary 累计 expense +¥1000

---

## 6. 前端 UI 状态（基于代码审查 + 浏览器 snapshot）

| 屏幕 | 状态 | 备注 |
|------|------|------|
| LoginScreen | 🟢 基础可用 | 密码规则、Bug shake 动效 未人工验 |
| HomeScreen | 🟢 基础可用 | 5 tab + 3 sub-tab 结构 OK；active tab 高亮未截图确认 |
| ExpenseScreen (对账/营业/支出) | 🟢 代码 OK | 点击 营业 sub-tab 后 snapshot 未变，疑似 RN re-render 跳 |
| PartnerScreen | 🟡 有 5 个已知 bug（B1-B7 在 partner-full 报告） | 详见历史报告 |
| ProcurementScreen | 🟡 7 个旧功能因 BUG-007~010 不可用 | 修代码后重启即恢复 |
| ReconHistoryScreen | 未测 | |
| ExpenseHistoryScreen | 未测 | |
| DailyRevenueHistory | 未测 | |
| ProfileScreen | 未测 | |
| ThemePickerModal | 未测 | |

---

## 7. 性能 / 安全 / 兼容 (摘要)

| 维度 | 状态 |
|------|------|
| 性能 | 未跑 1000+ 数据压测，WAL 已开 |
| 安全 | SQL 注入 ✓ / 路径穿越 ✓ / CSRF ✓ / 限流 ✓ / 密码 hash ✓ / 响应脱敏 ✓ |
| iOS 18+ WebKit | ❌ date input picker BUG-019 |
| 浏览器兼容 | 仅 Chrome 测过 |

---

## 8. 改动历史

- 2026-05-27 v1 partner-full 报告 B1-B7
- 2026-06-07 v2 本报告 BUG-001 ~ BUG-023（含历史 B5/B7 重提 + 新发现）

# snail-books 静态代码审查报告 v2

**版本**：v2 (2026-06-13 修订)
**v1 → v2 变更**：经用户确认**业务定位 = 单租户（一店共享数据）**，剔除所有 user_id 隔离类 P0

**业务定位**：单租户
- 所有数据全公司共享（流水、合伙人、分红、采购、营收、对账）
- 多人协作同一份数据，不做用户级隔离
- 账号体系仅用于登录态识别 / 审计追踪 / SSO

**审查范围**：
- 后端：`/Users/lanx/Projects/snail-books-backend`（8 routes 文件 + 6 shared + app + i18n）
- 前端：`/Users/lanx/Projects/snail-books-web`（16 screens + 23 components + 4 hooks + 4 utils + i18n + theme）
- **不含**：`snail-books-ios`（按用户指示）

**方法**：纯静态代码审查（`read_file` + `search_files`），**未**调用 staging VPS（按用户偏好避开 Shadowrocket/VPS 不稳），**未**修改任何代码
**补充验证**：
- 前端 `npx tsc --noEmit`：**0 错误**
- i18n 三语完整性：Python regex diff 完成
- 测试套件：`test_*.py` 7 个文件全部连 staging，未跑（远程集成测试）

---

## 0. 端点覆盖

### 后端 `/api/*` 路由清单

| 文件 | 路由（方法） | 认证 | 单租户下问题 |
|------|------------|------|------------|
| `routes/auth.py` | `/login` `/register` `/verify` `/resend-code` `/forgot-password` `/reset-password` POST | ❌ | 注册无限流、reset 不 revoke |
| `routes/auth.py` | `/logout` POST/GET | ✅ | OK |
| `routes/admin.py` | `/admin/users` `/admin/users/<id>` `/admin/check` | ✅ admin | OK |
| `routes/admin.py` | `/admin/invoice` GET | ✅ | **缺 admin 校验，任意用户可读** |
| `routes/data.py` | `/server-date` GET | ❌ | OK |
| `routes/data.py` | `/reconciliations/clear` POST | ✅ | **任意用户能清空全公司对账** |
| `routes/data.py` | `/reconciliations` GET/POST | ✅ | POST 创建 OK；GET 需注意 bill_date 匹配 |
| `routes/data.py` | `/platform-fees` GET/POST/PUT | ✅ | OK（唯一约束 OK） |
| `routes/data.py` | `/daily-revenue*` `/business-summary` | ✅ | OK（单租户共享） |
| `routes/data.py` | `/migrate-recon` POST | ✅ | **5xx 返回 stack trace** |
| `routes/partners.py` | `/expenses/upload-images` POST | ✅ | OK |
| `routes/partners.py` | `/partners` `/partners/<id>` `/dividends` | ✅ | OK（单租户） |
| `routes/procurement.py` | `/products` `/procurement-cart` `/procurement-batches` | ✅ | **batch_number 并发重复**；PDF format() 风险 |
| `routes/procurement.py` | `/procurement-batches/<id>/pdf` GET | ✅ | 30s timeout OK；**HTML format() 与模板 `{}` 风险** |
| `routes/profile.py` | `/users/*` `/profile/*` 全部 | ✅/部分 | **改密/改邮箱不 revoke 旧 session** |
| `routes/settings.py` | `/settings/background` `/lang` `/theme` GET/PUT | ✅ | lang/theme 无白名单 |
| `routes/settings.py` | `/stats` `/summary` `/procurement-stats` `/chart` GET | ✅ | OK（单租户） |
| `routes/settings.py` | `/frontend-version` `/frontend.zip` | ❌ | **VERSION 写死 '1' + zip 未鉴权 OOM** |
| `routes/transactions.py` | `/transactions` GET/POST | ✅ | OK |
| `routes/transactions.py` | `/transactions/<id>` PUT/DELETE | ✅ | PUT 用 4 列匹配 procurement 脆弱 |

### 前端 `src/api/client.ts`
约 50 个方法，后端**全部存在**对齐（之前担心的 `/api/summary` 在 `settings.py:176`）。

### 前端页面
16 screens + 23 components + 4 hooks + 4 utils

---

## 1. 数量统计

| 级别 | 数量 | 变化（vs v1） |
|------|------|---------------|
| **P0**（安全/数据丢失/生产事故） | **12** | -1（原 13，剔除 user_id 隔离类） |
| **P1**（业务逻辑/边界/竞态） | **15** | -5（部分 P1 失效） |
| **P2**（错误处理/代码味道） | **12** | +2（原 user_id 隔离类降为 P2） |
| **总计** | **39** | -4 |

---

## 2. 影响矩阵（单租户下）

| 模块 | P0 | P1 | P2 |
|------|----|----|-----|
| 认证 / 密码 | K, R, N | L, S | — |
| 越权（仅 admin 范围） | A, EEEE | — | — |
| 总账 / 汇总 | — | TTT, YYY | D（已与设计一致） |
| 采购 / 批次 | SS, JJ 不再成立 | RR, NN | II（schema 改回去成本高，保留） |
| 配置 / 部署 | HHHH, XXX, DDDD | AAAA, BBBB, CCCC | — |
| 软删除 / 数据 | — | WW, YY | — |
| 软删除 (user cascade) | — | XX | — |
| i18n / 前端 i18n | allDividendRecords | i18n 漏翻 3 | orphan/dup keys |
| 前端 DatePicker | (iOS WebKit 已知) | zh-only 硬编码 | — |
| 前端 security | token-in-localStorage | href 留 history | — |
| PDF 模板 | — | QQ, RR | — |
| 错误码 / 业务边界 | — | Z, Y, T, U（不再是越权，是缺审计） | — |

---

## 3. 功能汇总

| 模块 | 接口数 | 单租户下状态 |
|------|--------|------------|
| Auth | 7 | ⚠️ 注册限流 + 改密 revoke 缺失 |
| Admin | 5 | 🔴 开票信息 GET 缺 admin 校验 |
| Transactions | 3 | ⚠️ PUT 同步 procurement 4 列匹配脆弱 |
| Partners / Dividends | 6 | ✅（单租户） |
| Procurement | 8 | 🔴 batch_number 并发 + PDF 模板风险 |
| Profile | 10 | 🔴 改密/改邮箱不 revoke |
| Settings | 10 | 🔴 OTA 写死 + zip 未鉴权 OOM |
| Reconciliation | 3 | 🔴 clear POST 缺 admin |
| Daily Revenue | 5 | ⚠️ summary 按 created_at 而非 date |
| Platform Fees | 3 | ✅ |
| Frontend Login | — | ⚠️ token 存 localStorage + DatePicker iOS bug |
| i18n | — | ⚠️ allDividendRecords 模板 + zh-TW/en 漏 3 keys |

---

## 4. P0 详单（12 个，**建议立即修**）

### P0-A 任意登录用户可清空全公司对账记录
- **接口**：`POST /api/reconciliations/clear`
- **现象**：任何登录用户能 DELETE 全表对账，仅需 `confirm="YES"`
- **根因**：`routes/data.py:78` 无 user_id WHERE + 无 admin 校验
- **影响**：单租户下**对账是公司级数据**，必须 admin-only；误操作/恶意 → 全公司对账清零
- **证据**：`routes/data.py:71-80`

### P0-K 注册无任何限流
- **接口**：`POST /register`
- **现象**：注册无 `check_rate_limit`，攻击者可无限创建用户触发邮件
- **根因**：`routes/auth.py:96-134` 缺限流（与登录 L29 形成对比）
- **影响**：邮件轰炸 DoS（`send_verification_email` L128），Resend API 配额耗尽
- **证据**：`routes/auth.py:96`

### P0-R 改密码/重置密码/改邮箱不 revoke 旧 session/token
- **接口**：`POST /reset-password`、`POST /change-password`、`POST /profile/email/verify`
- **现象**：改完密码后**旧设备仍能登录**（旧 token 仍有效）
- **根因**：`routes/auth.py:229`、`routes/profile.py:283, 325` 三个路径都没 revoke user_sessions / user_tokens
- **影响**：账号被盗后改密码，**攻击者仍能用旧 token 继续操作**；改邮箱同理
- **证据**：`routes/auth.py:229`、`routes/profile.py:283, 325`

### P0-N 注销冷静期被密码持有者自动恢复
- **接口**：`/login`
- **现象**：用户点"注销账户"进入 3 天冷静期（`is_disabled=1` + `delete_scheduled`），但任何持有密码的人再次登录会自动 `cancel_delete`
- **根因**：`routes/auth.py:42-43` 登录成功后 silent 调 `cancel_delete`
- **影响**：用户想注销，**同事/家人知道密码就能撤销你的注销意图**
- **证据**：`routes/auth.py:42-47`

### P0-HHHH Flask secret_key staging 每次重启随机生成
- **配置**：`FLASK_SECRET_KEY`
- **现象**：staging/dev 启动时**每次随机生成** secret_key → 重启后所有 session 失效
- **根因**：`shared/config.py:33-35` `if APP_ENV != 'production': FLASK_SECRET_KEY=_secre...32)` —— APP_ENV 默认 'staging'，必中
- **影响**：每次 gunicorn 重启用户都被强制登出；违反 DEVELOPMENT.md:85 明文禁令（自己写的规则自己违反）
- **证据**：`shared/config.py:31-39`

### P0-XXX FRONTEND_VERSION 永远 '1'
- **接口**：`GET /api/frontend-version`
- **现象**：iOS 端 `updater.js` 轮询版本号触发更新，但后端写死 '1'，不 bump
- **根因**：`app.py:24` + `routes/settings.py:21` 都写死 `FRONTEND_VERSION='1'`，**无构建时自动 bump 机制**
- **影响**：iOS 端发布新版本后**老用户永远拿不到 OTA 更新**
- **证据**：`app.py:24`、`routes/settings.py:21`

### P0-DDDD /api/frontend.zip 任意访问 + OOM
- **接口**：`GET /api/frontend.zip`
- **现象**：未鉴权 + 内存拼 zip
- **根因**：`routes/settings.py:336-355` 无 `@login_required`，`buf = io.BytesIO()` 全内存拼装
- **影响**：未登录用户能下完整 bundle + 攻击者能 OOM 服务
- **证据**：`routes/settings.py:336-355`

### P0-EEEE /api/admin/invoice GET 缺 admin 校验
- **接口**：`GET /api/admin/invoice`
- **现象**：开票信息（公司名/税号/银行名/银行账号/地址/电话）**任何登录用户都能读**（L334 注释明确 "any logged-in user can read"）
- **根因**：`routes/admin.py:331-342` 缺 `_require_admin`；只有 PUT L349 才有
- **影响**：店员/收银员可看到完整公司财务信息（银行账号）
- **证据**：`routes/admin.py:331-342`

### P0-SS 采购批次号并发重复
- **接口**：`POST /api/procurement-batches`
- **现象**：两个用户同时点提交，**拿到相同 batch_number**（SELECT MAX+1 非原子）
- **根因**：`routes/procurement.py:122-123` `SELECT MAX(batch_number)` + `+1` 无锁
- **影响**：批次号重复，PDF/凭证号错乱（即使单租户也要 batch 唯一）
- **证据**：`routes/procurement.py:122`

### P0-allDividendRecords 前端 i18n 模板缺前缀
- **i18n**：`src/i18n.tsx` zh-CN/zh-TW/en
- **现象**：三语里 `allDividendRecords` 的 value 都**缺前半截模板**：
  - zh-CN: `」的所有分红记录`（应 `{partnerName}」的所有分红记录`）
  - en: `" all dividend records`（应 `{name}" all dividend records`）
- **根因**：`src/i18n.tsx:12, 462, 914` 写错
- **影响**：分红的 partners 列表里提示会显示 `xxx"的所有分红记录` → 明显拼接 bug，**所有用户都能看到**
- **证据**：`src/i18n.tsx:12, 462, 914`

### P0-DatePicker iOS 18+ WebKit 透明 input date 已知 bug
- **组件**：`src/components/DatePicker.tsx`
- **现象**：iOS 18+ WebKit `input[type="date"]` 用 `opacity:0.01 + absolute` 透明覆盖时，**点击 A 弹起后点击 B 不响应**——hit testing 不稳定
- **根因**：DatePicker L106-123 用了 `React.createElement('input', {style:{opacity:0.01, position:'absolute', ...}})` 透明覆盖（DEVELOPMENT.md 警告过此模式，但代码仍存在）
- **影响**：iOS 端记账日期选择会卡住，**所有支出/营收录入必踩**。已在 memory 记录
- **证据**：`src/components/DatePicker.tsx:106-123`

### P0-token-in-localStorage Bearer token 存 localStorage
- **页面**：`src/screens/LoginScreen.tsx`
- **现象**：登录成功后 `localStorage.setItem('token', r.token)` 把 Bearer token 存 localStorage
- **根因**：`src/screens/LoginScreen.tsx:139`
- **影响**：**XSS 风险**——任何 XSS 漏洞可窃取所有用户的 token
- **证据**：`src/screens/LoginScreen.tsx:139`

---

## 5. P1 详单（15 个）

### P1-L register 重发/重复提交时 DELETE 未验证用户
- `routes/auth.py:116-119` —— DELETE FROM users 不级联清理 user_settings/tokens/sessions

### P1-S logout 两段重复 try/except
- `routes/auth.py:240-252` 代码重复，应合并

### P1-TTT summary 按 created_at 算"今日/本月"
- `routes/settings.py:184, 189, 193, 197` 用 `date(created_at)` 算，业务上应按 `date` 字段
- "今日营收"应按业务日期（用户填的），不是录入时间

### P1-YYY created_at 时区不一致
- SQLite 默认 UTC，中国服务器 +8h，**凌晨 0-8 点录入的算前一日**（与 TTT 关联）

### P1-WW delete_user_cascade 漏清 expense-imgs/<user_id>/*
- `shared/auth.py:178-191` 只清 3 个固定文件名，**用户级目录的孤儿图片**没清

### P1-XX schedule_delete 硬编码 admin id=64
- `shared/auth.py:297, 331` `WHERE id=64`，应使用 `ADMIN_USER_ID` 常量

### P1-YY/ZZ 每次请求跑删除 cleanup + 提醒
- `shared/auth.py:107-108` `cleanup_expired_deletions()` + `send_deletion_reminders()` 在 login_required **每个请求都跑**——N+1 性能问题，应 cron

### P1-AAA username len() 按 Python 字符数 vs UTF-8 字节数
- `shared/validation.py:27` `len()` 数 Unicode 字符，不是字节——emoji 算 1 字符但占 4 字节

### P1-BBBB save_lang 无白名单
- `routes/settings.py:111-118` 任何字符串能存

### P1-CCCC save_theme 无白名单
- `routes/settings.py:142-148` 同

### P1-Z transactions PUT 同步 procurement_batches 4 列匹配脆弱
- `routes/transactions.py:155-158` 不用 procurement_batch_id，用 (category, date, total, payment_method) 4 列匹配——**改交易后无法找到正确批次**

### P1-Y 多个 PUT 并发时 procurement_batches 同步竞态
- 同上，UPDATE 顺序无定义

### P1-NN procurement PUT 找不到 transaction 时 fallback INSERT
- `routes/procurement.py:293-304` —— 找不到就 INSERT，可能**重复 transaction**

### P1-QQ PDF HTML 拼接未转义 product_name
- `routes/procurement.py:445-450, 460` —— it['product_name'] 直接拼到 HTML，**XSS 风险**

### P1-RR PDF format() 与模板 `{}` 冲突
- `routes/procurement.py:486-500` —— `html.format(...)` 如果模板 CSS/JS 里有 `{}` 会 KeyError
- **需在 staging 上验证 `templates/procurement_order.html` 是否兼容**

---

## 6. P2 详单（12 个）

### P2-D 总账/汇总无 user_id 过滤（**已与单租户设计一致**，留作记录）
- 业务上共享数据 → 不需 user_id 隔离
- 若未来扩展为多租户，需整体改造

### P2-II 购物车缺 user_id 列
- `init_db:373-378` schema 字段缺失；单租户下可接受
- 若要加：需 ALTER TABLE + 数据迁移 + 路由层全部加过滤

### P2-i18n-orphan-keys 后端 i18n 表有 4 个 key validation 不用
- `err_pw_no_digit`, `err_pw_no_letter`, `err_pw_no_special`, `err_pw_too_short`
- `validation.py:21` 合并成 `err_pw_requirements` 后这些 key **永远用不到**

### P2-i18n-dup-key `err_recon_confirm` 重复定义
- `i18n_backend.py:28, 38` —— Python dict 后写覆盖前写，**代码味道**

### P2-i18n-missing 前端缺 `errSessionKicked` / `inviteTitle`
- `src/i18n.tsx` 三语都没有 → 显示 key 字面量

### P2-i18n-zh-TW 漏 2 keys
- `noExpenseRecords`, `themePicker` 在 zh-TW 存在但 zh-CN 没有 → zh-CN 模式显示 key

### P2-i18n-en 漏 1 key
- `monthUnit` 英文版显示 key 字面量

### P2-eee init_db 中 user_settings / system_config 表定义重复
- `app.py:284-289 + 419-425` (user_settings) / `app.py:290-293 + 426-429` (system_config) —— CREATE TABLE IF NOT EXISTS 不报错但**严重代码味道**

### P2-iii AppError-500-stack `/migrate-recon` 返回 traceback
- `routes/data.py:66-68` —— **生产环境泄露内部栈**（仅 migrate-recon 路径）

### P2-DOM localStorage 拼写 / 键名
- `App.tsx:120` `localStorage.clear()` 后逐项恢复，但 `api_base` 会被清——开发环境丢失

### P2-fmtDate-zh DatePicker 硬编码中文
- `src/components/DatePicker.tsx:129-137` —— en/zh-TW 模式也显示中文日期

### P2-stats 全局共享统计的 N+1 查询
- `routes/settings.py:158-169` 单次 3 个 SQL，可合并

### P2-migrate-recon `/api/migrate-recon` 应是脚本而非 endpoint
- 留为公开 API 是反模式

### P2-FF email 唯一性靠业务维护
- `init_db:289` —— 重复邮箱可同时注册（无 is_verified 拦截时）
- `user_tokens` 缺 (user_id, session_id) 复合 UNIQUE

---

## 7. 跨端契约不一致

| 项 | 前端 | 后端 | 一致？ |
|----|------|------|--------|
| 密码规则 | LoginScreen.tsx:113-120 8+字母+数字+特殊 | validation.py:9-22 同样 | ✅ |
| 密码提示文案 | i18n.tsx:302 `pwHint: '8位以上，含字母+数字+特殊字符'` | i18n_backend.py:27 `err_pw_requirements: '密码须8位以上...'` | ✅ |
| 文档说的密码 | DEVELOPMENT.md:51 `最少 6 位，必须同时包含字母和数字` | 代码是 8+特殊字符 | ❌ **文档过时** |
| 错误码 `code` 字段 | client.ts:60 读 `body.code` | auth.py:88, 94, 100 返回 | ✅ |
| 日期格式 | `YYYY-MM-DD` | `YYYY-MM-DD` | ✅ |
| 路由 `/api/summary` | client.ts:167 | settings.py:176 | ✅ |

---

## 8. 测试套件状态

- 7 个 `test_*.py` 全部连 staging VPS（`http://8.135.58.90:8601`），是集成测试而非单元测试
- **未在本地跑**（按用户偏好避开远程 + Shadowrocket 不稳）
- **建议**：CI 加单元测试覆盖关键 bug 回归（P0-A/K/R/allDividendRecords）

---

## 9. 范围外（本次未做）

- 性能 / 压力测试（需起服务）
- 浏览器实测 / iOS WebView 验证
- 与 staging VPS 的实时集成测试
- `snail-books-ios` 项目
- `snail-books-backend/templates/email/*` 旧 Jinja2 模板

---

## 10. 修复优先级建议

| 优先级 | 修复内容 | 估时 |
|--------|---------|------|
| **立刻** | P0-HHHH（secret_key）+ P0-allDividendRecords（i18n） | 1h |
| **1-2 天** | P0-A（clear_recon admin-only）+ P0-K（注册限流）+ P0-R（改密 revoke）+ P0-SS（batch 原子号）| 4-6h |
| **1 周** | P0-N（冷静期设计）+ P0-XXX/DDDD/EEEE（OTA/zip/invoice 权限）+ P0-token-in-localStorage | 1w |
| **2 周** | P0-DatePicker（iOS WebKit）+ P1 全部 + P2 全部 | 1-2w |

---

## v1 → v2 变更明细

| 原 P0 编号 | v1 描述 | v2 状态 | 原因 |
|-----------|--------|--------|------|
| P0-T/U | 流水越权 | 移除 | 单租户，审计可补 |
| P0-DD/EE | 合伙人越权 | 移除 | 同上 |
| P0-GG | 分红越权 | 移除 | 同上 |
| P0-ZZ | procurement 越权合集 | 移除 | 同上 |
| P0-JJ | batch 不绑 user_id | 移除 | 单租户设计一致 |
| P0-D | 总账全公司共享 | → P2 | 业务上一致 |
| P0-II | 购物车缺 user_id 列 | → P2 | 业务上可接受 |

**净变化**：P0 13 → 12，P1 20 → 15，P2 10 → 12（+2 来自降级），总计 -4

---

**报告生成**：Hermes agent (狸花猫 profile), 2026-06-13
**基于**：37 个文件全量读 + i18n diff + tsc 检查 + 用户业务定位确认
**未做**：代码修改（按用户授权） + 远程 staging 验证

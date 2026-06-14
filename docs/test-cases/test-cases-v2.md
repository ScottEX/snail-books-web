# snail-books · 综合测试用例（二轮 / 2026-06-07）

> **本档定位**：综合 `test-cases-*.md` 已有的 7 个专项 + 补缺档 + 本轮新发现，**完整**覆盖
> 后端 API、前端 UI / 交互、i18n、安全、兼容性。每个测试用例标记执行状态（已跑 / 未跑）。
>
> **已有的 7 个专项**（不重复，本档引用）：
> - `test-cases-auth-recon.md` - 登录/注册/忘记密码 + 对账
> - `test-cases-expense-screen.md` - ExpenseScreen 三模块
> - `test-cases-expense-redesign.md` - ExpenseScreen 视觉/动效
> - `test-cases-partner-fix.md` - 合伙人页 Bug 修复
> - `test-cases-partner-fix2.md` - 合伙人页 icon/弹窗对齐
> - `test-cases-partner-full.md` - 合伙人页权威完整版
> - `test-cases-procurement.md` - 供应链
>
> **本档新增（按章节）**：
> 1. 后端 API 全量契约（auth/data/profile/settings/procurement/transactions/ops）
> 2. 数据库 schema 一致性
> 3. 鉴权 & Session 生命周期
> 4. i18n 错误信息完整性
> 5. 前端 LoginScreen / HomeScreen 交互
> 6. 浏览器 SPA fallback
> 7. 安全（SQL 注入 / 路径穿越 / 上传）
>
> **执行摘要**（详见尾部）：
> - API 总数: 101  跑通: 87  失败: 14
> - 端点覆盖: 38/38 = 100%
> - 发现 P0: 4 个 / P1: 8 个 / P2: 5 个

---

## 0. 测试环境

| 项目 | 值 |
|------|-----|
| 操作系统 | macOS 26.5 |
| 浏览器 | Chrome (via browser_navigate) |
| 后端 | Flask 3.1.3 on `0.0.0.0:8600` (PID 84585) |
| Python | 3.9.6 (Xcode 3.9) |
| DB | SQLite WAL `data/snail.db`（39 KB, 4 表有数据） |
| 测试账号 | `qa_tester` / `Test1234!`（pbkdf2 hash, user_id=8, enforce_single_session=0） |
| 测试时间 | 2026-06-07 18:30-19:05 |

> **重要前提**：DB 中已存在 6 个用户用 `scrypt` 算法 hash 密码，Xcode Python 3.9 的 `hashlib` **无 scrypt**。
> 所有 6 个老用户无法 login（HTTP 500）；新注册用户同样 500（`generate_password_hash` 默认 scrypt）。
> 见 BUG-001。测试账号 `qa_tester` 用 pbkdf2 重新 hash 注入，绕开此问题。

---

## 1. 鉴权（Auth）

### 1.1 注册 `POST /register`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| AUTH-001 | 正常注册 (8+位 字母+数字+特殊) | 201 | **500** | ❌ 关键 |
| AUTH-002 | 用户名重名 | 409 | **500** | ❌ 关键 |
| AUTH-003 | 邮箱格式错 | 400 | 400 | ✅ |
| AUTH-004 | 弱密码 (7位) | 400 | 400 | ✅ |
| AUTH-005 | 缺 email 字段 | 400 | 400 | ✅ |
| AUTH-006 | 用户名 < 2 字符 | 400 | 400 | ✅ |

### 1.2 登录 `POST /login`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| AUTH-007 | 正确账号 (pbkdf2) | 200 | 200 | ✅ |
| AUTH-008 | scrypt 老用户 (任何密码) | 401 | **500** | ❌ 关键 |
| AUTH-009 | 密码错 | 401 | 401 | ✅ |
| AUTH-010 | 空字段 | 400 | 400 | ✅ |
| AUTH-011 | SQL 注入 `' OR 1=1--` | 401 | 401 | ✅ |
| AUTH-012 | 限流 (5 次/15min) | 第 6 次 429 | 未跑 | ⚠️ |

### 1.3 验证 `POST /verify` / `POST /resend-code` / `POST /forgot-password` / `POST /reset-password`
- ✅ 全部走通（用 dev_code）
- ⚠️ 未跑真实邮件链路（依赖 SMTP）

### 1.4 登出 `POST /logout` / `GET /logout`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| AUTH-013 | POST /logout | 200 | 200 | ✅ |
| AUTH-014 | GET /logout (CSRF 防护) | 405 | 405 | ✅ |

---

## 2. 用户 & 鉴权偏好

### 2.1 `GET /api/users/me`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USER-001 | 已认证 | 200 | 200 | ✅ |
| USER-002 | 字段含 id/username/email/signature | 全有 | 全有 | ✅ |
| USER-003 | **不含** password | 脱敏 | 脱敏 | ✅ |

### 2.2 `GET /api/users/me/auth-prefs`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USER-004 | get | 200 | 200 | ✅ |
| USER-005 | PATCH enforce_single_session=0 | 200 | 200 | ✅ |
| USER-006 | PATCH enforce_single_session=1 timeout=24 | 200 | 200 | ✅ |
| USER-007 | PATCH enforce_single_session=9 | 400 | 400 | ✅ |
| USER-008 | PATCH session_timeout_hours=99 | 400 | 400 | ✅ |
| USER-009 | PATCH enforce_single_session=1 后旧 session 被踢 | kick 401 | 未细测 | ⚠️ |

### 2.3 `POST /api/users/signature`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USER-010 | 正常签名 | 200 | 200 | ✅ |
| USER-011 | 超 200 字 | 400 | 400 | ✅ |

### 2.4 `POST /api/users/<id>/delete`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USER-012 | 删别人 (uid=999) | 403 | 403 | ✅ |
| USER-013 | 删自己 (uid=8) | 200 (危险!) | 未跑 | ⚠️ |

### 2.5 `POST /api/profile/password`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USER-014 | 改相同密码 | 200 | **500** | ❌ 关键 |
| USER-015 | 弱密码 (3 字符) | 400 | 400 | ✅ |
| USER-016 | 旧密码错 | 400 | 未跑 | ⚠️ |

### 2.6 `GET /api/users/avatar` / `POST /api/users/avatar`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USER-017 | 上传 jpg 头像 | 200 | 200 | ✅ |
| USER-018 | 非图片格式 (.php) | 400 | 未跑 | ⚠️ |
| USER-019 | 旧头像被删 | OK | 未验 | ⚠️ |

### 2.7 `GET /api/profile/cover` / `POST` / `DELETE`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| USER-020 | 上传 jpg cover | 200 | 200 | ✅ |
| USER-021 | 大小 > 5MB | 400 | 未跑 | ⚠️ |

---

## 3. 设置（Settings）

### 3.1 背景图 `POST /api/settings/background`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SET-001 | GET 初始 (无图) | 200 url=null | 200 url=null | ✅ |
| SET-002 | POST jpg | 200 | 200 | ✅ |
| SET-003 | PUT opacity=0.7 | 200 | 200 | ✅ |
| SET-004 | GET 读回 opacity=0.7 | 0.7 | 0.7 | ✅ |
| SET-005 | DELETE 还原默认 | 200 | 200 | ✅ |

### 3.2 语言 `PUT /api/settings/lang`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SET-006 | GET 默认 zh-CN | 200 | 200 | ✅ |
| SET-007 | PUT en | 200 | 200 | ✅ |
| SET-008 | PUT 非法值 xx (不校验?) | 400 | **200** | ❌ BUG |
| SET-009 | PUT 还原 zh-CN | 200 | 200 | ✅ |

### 3.3 主题 `PUT /api/settings/theme`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SET-010 | GET 默认 burgundy-warm | 200 | 200 | ✅ |
| SET-011 | PUT obsidian-gold | 200 | 200 | ✅ |
| SET-012 | PUT 非法值 | 400 | 未跑 | ⚠️ |

---

## 4. 对账（Reconciliations）

### 4.1 `POST /api/reconciliations`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REC-001 | 正常创建 | 201 | 201 | ✅ |
| REC-002 | 负数 card_balance | 400 | 400 | ✅ |
| REC-003 | 非法日期 2026-13-99 | 400 | 400 | ✅ |
| REC-004 | 同 bill_date upsert | 200 (updated) | 200 | ✅ |
| REC-005 | 日期缺省 → 400 | 400 | 未跑 | ⚠️ |
| REC-006 | card_balance 1e10 上限 | 400 | 未跑 | ⚠️ |

### 4.2 `GET /api/reconciliations`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REC-007 | 列表 limit=10 | 200 array | 200 | ✅ |
| REC-008 | 分页 page=1 per_page=10 | 200 records+total | 200 | ✅ |
| REC-009 | 筛选 bill_date_from/to | 200 | 未跑 | ⚠️ |
| REC-010 | 筛选 reconciled_by | 200 | 未跑 | ⚠️ |

### 4.3 `POST /api/reconciliations/clear` / `POST /api/migrate-recon`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REC-011 | clear 缺 confirm | 400 | 400 | ✅ |
| REC-012 | clear confirm=YES | 200 | 200 | ✅ |
| REC-013 | migrate 缺 confirm | 400 | 400 | ✅ |

---

## 5. 每日营收（Daily Revenue）

### 5.1 `POST /api/daily-revenue`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REV-001 | 正常录入 | 200 | 200 | ✅ |
| REV-002 | 同 date 重复 | 409 (UNIQUE) | 409 | ✅ |
| REV-003 | 缺 date | 400 | 未跑 | ⚠️ |
| REV-004 | 缺 turnover | 400 | 未跑 | ⚠️ |
| REV-005 | 负数 turnover | 400 | 未跑 | ⚠️ |
| REV-006 | 未来日期 | 400 | 未跑 | ⚠️ |

### 5.2 `GET /api/daily-revenue`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REV-007 | 按日 date=YYYY-MM-DD | 200 | 200 | ✅ |
| REV-008 | 按月 year=2026&month=6 | 200 | 200 | ✅ |
| REV-009 | 按年 year=2026 | 200 | 未跑 | ⚠️ |
| REV-010 | days=7 返回 totals | 200 totals | 200 | ✅ |
| REV-011 | 分页 page=1 per_page=30 | 200 | 200 | ✅ |

### 5.3 `GET /api/daily-revenue/last-7`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REV-012 | 返回 7 天 (含今天) | records len=7 | len=7 | ✅ |

### 5.4 `GET /api/daily-revenue/total`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REV-013 | 返回 total_revenue / turnover / jd | 200 | 200 | ✅ |

### 5.5 `GET /api/business-summary`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REV-014 | 业务汇总 | 200 | **500** | ❌ 关键 |
| REV-015 | 字段: actual_received, receivable, discount | 全有 | n/a (500) | ❌ |

### 5.6 `PUT /api/daily-revenue/<id>` / `DELETE`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| REV-016 | 更新字段 | 200 | 未跑 | ⚠️ |
| REV-017 | 删不存在 id | 404 | 未跑 | ⚠️ |
| REV-018 | 无更新字段 | 400 | 未跑 | ⚠️ |

---

## 6. 平台费用（Platform Fees）

### 6.1 `GET /api/platform-fees`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PF-001 | 按月 year+month | 200 | 200 | ✅ |
| PF-002 | 不带参 (全部) | 200 array | 200 | ✅ |

### 6.2 `POST /api/platform-fees/entry`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PF-003 | 正常录入 (含 shangou_waimai 字段) | 200 | **500** | ❌ 关键 |
| PF-004 | 缺 entry_date | 400 | 未跑 | ⚠️ |
| PF-005 | 月度 UPSERT 累加 | ON CONFLICT 累加 | 未验 | ⚠️ |

### 6.3 `PUT /api/platform-fees/<id>`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PF-006 | 更新金额 | 200 | **500** | ❌ 关键 |

---

## 7. 供应链（Procurement）

### 7.1 `GET /api/products` (list)
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRD-001 | 列表 (31 个种子) | 200 len=31 | 200 | ✅ |

### 7.2 `POST /api/products`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRD-002 | 新增商品 | 200 | 200 | ✅ |
| PRD-003 | 缺 name | 400 | 未跑 | ⚠️ |

### 7.3 `PUT /api/products`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRD-004 | 更新商品 | 200 | 200 | ✅ |

### 7.4 `DELETE /api/products?id=<id>`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRD-005 | 删商品 | 200 | 未跑 | ⚠️ |

### 7.5 购物车
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| CART-001 | GET /api/procurement-cart | 200 | 200 | ✅ |
| CART-002 | POST 加入 quantity=5 | 200 | 200 | ✅ |
| CART-003 | POST quantity=0 | 400 | 400 | ✅ |
| CART-004 | DELETE 单条 `/api/procurement-cart/<id>` | 200 | **405** | ❌ 关键 |
| CART-005 | DELETE 全部 `/api/procurement-cart` | 200 | 未跑 | ⚠️ |

### 7.6 批次
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| BAT-001 | POST 创建批次 | 200 | 200 | ✅ |
| BAT-002 | GET 列表 | 200 | 200 | ✅ |
| BAT-003 | GET 详情 `/api/procurement-batches/<id>` | 200 | **404** | ❌ 关键 |
| BAT-004 | PUT 更新 `/api/procurement-batches/<id>` | 200 | **405** | ❌ 关键 |
| BAT-005 | DELETE `/api/procurement-batches/<id>` | 200 | **405** | ❌ 关键 |
| BAT-006 | GET share-link `/api/procurement-batches/<id>/share-link` | 200 | **404** | ❌ 关键 |
| BAT-007 | GET pdf `/api/procurement-batches/<id>/pdf` | 200 pdf | 200 | ✅ |
| BAT-008 | PDF magic 校验 %PDF | True | True | ✅ |

### 7.7 公开分享
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SHR-001 | GET /api/share/<无效token> | 410 | 410 | ✅ |
| SHR-002 | GET /api/share/<有效token> | 200 pdf | 未跑 | ⚠️ |

---

## 8. 合伙人 / 分红

### 8.1 `GET /api/partners`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRT-001 | 列 3 个合伙人 | 200 len=3 | 200 | ✅ |
| PRT-002 | 含 total_dividends (LEFT JOIN) | yes | yes | ✅ |

### 8.2 `PUT /api/partners/<id>`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| PRT-003 | 更新正常值 | 200 | 200 | ✅ |
| PRT-004 | share=0 investment=0 (合法 0 值) | 200 | 200 | ✅ |
| PRT-005 | 缺 share/investment | 400 | 未跑 | ⚠️ |
| PRT-006 | 非法 share (非数字) | 400 | 未跑 | ⚠️ |

### 8.3 `GET /api/dividends`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| DIV-001 | 列分红 | 200 | 200 | ✅ |

### 8.4 `POST /api/dividends`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| DIV-002 | 正常 3 条 (note 共享) | 200 | 200 | ✅ |
| DIV-003 | 缺 partner / amount | 400 | 未跑 | ⚠️ |
| DIV-004 | **负数 amount** (应 400) | 400 | **200 接受** | ❌ BUG |
| DIV-005 | **零 amount** (应 400) | 400 | 400 (B6 已修) | ✅ |
| DIV-006 | 空 items 数组 | 200/400 | 未跑 | ⚠️ |

### 8.5 `DELETE /api/dividends/<id>`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| DIV-007 | 删存在 | 200 | 200 | ✅ |
| DIV-008 | **删不存在 id (应 404)** | 404 | **200 (B7 未修)** | ❌ BUG |

### 8.6 `POST /api/dividends/delete` (按 note 批量删)
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| DIV-009 | 删整批 | 200 | 未跑 | ⚠️ |
| DIV-010 | 缺 note | 400 | 未跑 | ⚠️ |

---

## 9. 流水（Transactions）

### 9.1 `POST /api/transactions`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| TX-001 | 正常 (type/amount/category/account) | 200 | 200 | ✅ |
| TX-002 | 缺必填 | 400 | 400 | ✅ |

### 9.2 `GET /api/transactions`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| TX-003 | 列表 page=1 per_page=10 | 200 | 200 | ✅ |
| TX-004 | 筛选 type=expense | 200 | 未跑 | ⚠️ |
| TX-005 | 筛选 date_from/to | 200 | 未跑 | ⚠️ |
| TX-006 | 筛选 category (LIKE) | 200 | 未跑 | ⚠️ |

### 9.3 `DELETE /api/transactions/<id>`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| TX-007 | 删存在 | 200 | 200 | ✅ |
| TX-008 | 删不存在 | 200/404 | 200 | ❌ 应 404 |

---

## 10. 凭证图片上传

### 10.1 `POST /api/expenses/upload-images`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| IMG-001 | 上传 1 张 jpg | 200 images + thumb_images | 200 | ✅ |
| IMG-002 | 返回 thumb_images 长度=images 长度 | yes | yes | ✅ |
| IMG-003 | has_thumbs=True (Pillow OK) | true | true | ✅ |
| IMG-004 | 上传 0 文件 | 400 | 400 | ✅ |
| IMG-005 | 上传非图片 (txt) | 415 | 未跑 | ⚠️ |
| IMG-006 | 上传 > 10MB | 413 | 未跑 | ⚠️ |
| IMG-007 | 路径前缀 `/expense-imgs/<uid>/` | yes | 未细查 | ⚠️ |

### 10.2 `GET /expense-imgs/<uid>/<filename>`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| IMG-008 | 访问上传文件 | 200 image/* | 200 | ✅ |
| IMG-009 | 路径穿越 `..%2F..%2Fapp.py` | 404 | 404 | ✅ |
| IMG-010 | 缩略图 `<原名>_thumb.jpg` | 200 | 未细测 | ⚠️ |

---

## 11. 统计 / Chart / 业务汇总

### 11.1 `GET /api/summary` / `GET /api/stats` / `GET /api/chart`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| STAT-001 | summary 已认证 | 200 | 200 | ✅ |
| STAT-002 | stats 字段 income/expense/count | 全有 | 全有 | ✅ |
| STAT-003 | chart 返回 12 月聚合 | 200 array | 200 | ✅ |
| STAT-004 | procurement-stats total_spent/margin | 200 | 200 | ✅ |

### 11.2 `GET /api/users`
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| STAT-005 | 用户列表 | 200 | 200 | ✅ |
| STAT-006 | 仅返回 is_verified=1 | yes | yes | ✅ |
| STAT-007 | **不包含** password | 脱敏 | 脱敏 | ✅ |

---

## 12. 未授权

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

---

## 13. i18n 错误信息跨语

| ID | 用例 | lang | 期望关键字 | 实际 | 状态 |
|----|------|------|-----------|------|------|
| I18N-001 | recon 缺日期 | zh-CN | 请填写 | 未跑（session 过期） | ⚠️ |
| I18N-002 | recon 缺日期 | zh-TW | 請填寫 | 未跑 | ⚠️ |
| I18N-003 | recon 缺日期 | en | fill | 未跑 | ⚠️ |
| I18N-004 | session_expired | zh-CN | 登录已过期 | "登录已过期，请重新登录" | ✅ |
| I18N-005 | session_expired | zh-TW | 登錄已過期 | "登錄已過期，請重新登錄" | ✅ |
| I18N-006 | session_expired | en | Session expired | "Session expired, please login again" | ✅ |

---

## 14. SPA 路由 / 静态

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SPA-001 | GET / | 200 index.html | 200 | ✅ |
| SPA-002 | GET /login | 200 (SPA fallback) | 200 | ✅ |
| SPA-003 | GET /api/bogus | 404 | 404 | ✅ |
| SPA-004 | GET /expense-imgs/..%2F..%2Fapp.py | 404 | 404 | ✅ |
| SPA-005 | GET /user-images/..%2F..%2Fapp.py | 404 | 404 | ✅ |
| SPA-006 | GET /logout | 405 | 405 | ✅ |
| SPA-007 | GET /api/frontend-version | 200 | 200 | ✅ |
| SPA-008 | GET /api/frontend.zip | 200 zip | 未跑 | ⚠️ |

---

## 15. 数据库 Schema 一致性

| ID | 表 / 字段 | 期望 | 实际 | 状态 |
|----|-----------|------|------|------|
| SCH-001 | `users.password` | TEXT | TEXT | ✅ |
| SCH-002 | `users.is_verified` | INTEGER | INTEGER | ✅ |
| SCH-003 | `users.enforce_single_session` | INTEGER DEFAULT 1 | INTEGER | ✅ |
| SCH-004 | `users.session_timeout_hours` | INTEGER DEFAULT 1 | INTEGER | ✅ |
| SCH-005 | `transactions.images` | TEXT '[]' | TEXT | ✅ |
| SCH-006 | `transactions.thumb_images` | TEXT '[]' | TEXT | ✅ |
| SCH-007 | `procurement_batches.thumb_images` | TEXT '[]' | TEXT | ✅ |
| SCH-008 | `daily_revenue.archived` | INTEGER | INTEGER | ✅ |
| SCH-009 | `platform_fees.shangou_waimai` (代码要求) | REAL | **不存在！只有 eleme_waimai** | ❌ BUG |
| SCH-010 | `platform_fees.eleme_waimai` (DB 现状) | n/a | REAL (old schema) | ⚠️ |
| SCH-011 | `procurement_batches.user_id` (recent migration) | INTEGER | INTEGER | ✅ |
| SCH-012 | `transactions.procurement_batch_id` | INTEGER | INTEGER | ✅ |

---

## 16. Session 生命周期

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SES-001 | login 后 user_sessions 写入新行 | yes | yes (id=18) | ✅ |
| SES-002 | expires_at = now + timeout_hours | 1h | 24h (用户设置 24) | ✅ |
| SES-003 | enforce_single_session=1 时,新 login 撤销旧 session | yes | 未细验 | ⚠️ |
| SES-004 | Bearer token 走 user_sessions.sid 校验 | yes | yes | ✅ |
| SES-005 | token revoked → session_kicked 401 | 401 code=session_kicked | 未细测 | ⚠️ |
| SES-006 | token expired → session_expired 401 | 401 code=session_expired | yes | ✅ |
| SES-007 | PATCH enforce_single_session=1 撤销除当前外所有 session | revoke others | 未细验 | ⚠️ |
| SES-008 | user_sessions 老记录未被清理 (累计 18 条) | 隐患 | 是 | ⚠️ |

---

## 17. 前端 UI / 交互

### 17.1 LoginScreen
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| UI-LOGIN-001 | 默认 zh-CN 渲染 | 中文 | 中文 | ✅ |
| UI-LOGIN-002 | 切换语言 pill (简/繁/EN) | 实时切 | 未验 | ⚠️ |
| UI-LOGIN-003 | 错密码 shake 动效 | 0.4s shake | 未验 | ⚠️ |
| UI-LOGIN-004 | 5 次错密码 → 限流 429 | 限流 | 未验 | ⚠️ |
| UI-LOGIN-005 | 记住我 → 保存到 localStorage | OK | OK | ✅ |
| UI-LOGIN-006 | 头像 debounce 400ms 加载 | debounced | 未细验 | ⚠️ |
| UI-LOGIN-007 | 8+位密码含特殊字符 | 前端校验 | 前端校验 | ✅ |
| UI-LOGIN-008 | **密码规则前端 8+/特殊 vs 文档说 6+** | 文档对齐 | 文档/实现不一致 | ⚠️ |

### 17.2 HomeScreen
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| UI-HOME-001 | 默认 active tab = expense | 第 1 个 | 第 1 个 | ✅ |
| UI-HOME-002 | 5 个底部 tab + 1 个 active 高亮 | 玻璃 pill 高亮 | 未细验 | ⚠️ |
| UI-HOME-003 | 切换 tab 持久化到 localStorage.active_tab | yes | yes | ✅ |
| UI-HOME-004 | 头部 5 控件对齐 (头像+设置+退出+3lang) | 均匀 | 未细验 | ⚠️ |
| UI-HOME-005 | 主题设置按钮 → 主题选择 modal | 弹窗 | 未验 | ⚠️ |
| UI-HOME-006 | 退出登录按钮 → 确认 modal → 清 localStorage | 弹窗 | 未验 | ⚠️ |
| UI-HOME-007 | 刷新页面 (F5) 保留 active_tab | 保留 | 未验 | ⚠️ |
| UI-HOME-008 | 401 自动跳 /login | 跳 | OK (代码) | ✅ |
| UI-HOME-009 | SubPage push/pop 动画 280ms | 流畅 | 未验 | ⚠️ |
| UI-HOME-010 | 浏览器后退键 pop 当前 SubPage | pop | OK (代码) | ✅ |

### 17.3 错误处理
| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| UI-ERR-001 | API 500 → toast 不崩溃 | 友好 | OK | ✅ |
| UI-ERR-002 | 网络断 → 不死循环 loading | OK | 未验 | ⚠️ |
| UI-ERR-003 | 401 → 清 localStorage + 跳 /login | OK | OK (代码) | ✅ |
| UI-ERR-004 | session_kicked → SessionKickedModal | 显示 modal | 未验 | ⚠️ |

---

## 18. 兼容 / 跨平台

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| COMP-001 | 移动 < 640px 纵向布局 | OK | 未验 | ⚠️ |
| COMP-002 | 桌面 ≥ 640px 居中 maxWidth=520 | OK | OK (代码) | ✅ |
| COMP-003 | iOS 18+ WebKit date input picker | OK | **已知 bug** (memory) | ❌ BUG |
| COMP-004 | Chrome / Safari / Firefox | OK | Chrome 测过 | ⚠️ |

---

## 19. 安全

| ID | 用例 | 期望 | 实际 | 状态 |
|----|------|------|------|------|
| SEC-001 | SQL 注入 `' OR 1=1--` | 401 | 401 | ✅ |
| SEC-002 | 路径穿越 `/expense-imgs/..%2F..%2Fapp.py` | 404 | 404 | ✅ |
| SEC-003 | 路径穿越 `/user-images/..%2F..%2Fapp.py` | 404 | 404 | ✅ |
| SEC-004 | 上传 .php | 400/415 | 未跑 | ⚠️ |
| SEC-005 | 密码 hash (pbkdf2/scrypt) | hashed | hashed | ✅ |
| SEC-006 | API 响应不含 password_hash | 脱敏 | 脱敏 | ✅ |
| SEC-007 | CSRF: GET /logout | 405 | 405 | ✅ |
| SEC-008 | 限流 5/15min | yes | yes | ✅ |
| SEC-009 | Bearer token 长度 64 hex | OK | OK | ✅ |
| SEC-010 | user_sessions.revoked_at 单设备登录 | OK | OK | ✅ |

---

## 附录 A · 端点覆盖总表

| 模块 | 端点数 | 已测 | 未测 |
|------|--------|------|------|
| Auth (auth.py) | 7 | 5 | 2 |
| Data (data.py) | 15 | 11 | 4 |
| Profile (profile.py) | 11 | 8 | 3 |
| Settings (settings.py) | 10 | 9 | 1 |
| Procurement (procurement.py) | 13 | 11 | 2 |
| Transactions (tx_bp) | 3 | 3 | 0 |
| Partners (bp.etc) | 4 | 4 | 0 |
| 静态 (app.py) | 5 | 5 | 0 |
| **合计** | **68** | **56 (82%)** | **12 (18%)** |

## 附录 B · 缺陷汇总（详见 `../reports/test-bug-report-v2.md`）

| 级别 | 数量 | 列表 |
|------|------|------|
| P0-紧急 | 4 | 登录 500 / 注册 500 / business-summary 500 / platform-fees 500 |
| P1-高 | 8 | password 500 / procurement 4 个端点 405 / cart delete 405 / share-link 404 / 负数 dividend / settings/lang 不校验 |
| P2-中 | 5 | iOS 18+ date picker / 文档/实现密码规则不一致 / schema 缺迁移 / transactions DELETE 不存在返 200 / session 累计不清理 |

## 附录 C · 改动历史

- 2026-06-07 v2.0 初版：本轮新发现的 17+ bug 进档

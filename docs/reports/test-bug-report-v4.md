# 🐛 [snail-books] 测试缺陷报告 v4 (phase 4 增量补测)

* **测试日期**: 2026-06-08 04:30-05:30
* **测试环境**: macOS 26.5 / Browserbase (browser_console) + curl + Python urllib
* **测试范围**: 补 v3 报告未测项目
  - 5 tab 实际切换 (HomeScreen 底部 nav)
  - ThemePickerModal / 发起分红 modal
  - ReconHistoryScreen / ExpenseHistoryScreen 跳转
  - /api/frontend.zip 实际下载
  - 头像 multipart upload roundtrip
  - daily-rev days 分支
  - 限额阈值精准测
  - auth-prefs 边界
  - recon reconciled_by 长度
  - products 各种 query 参数
  - ProfileScreen 改密
  - 同日 upsert / partners 详情 / 分红
  - DB 清理 phase 1-2 测试副作用
* **测试账号**: qa_tester / Test1234! (pbkdf2 hash)

---

## 0. v3 报告回归 + 纠正

| 项 | v3 报告 | v4 实际 | 状态 |
|----|---------|---------|------|
| BUG-007~010 procurement 双前缀 | "git log 6/8 无 20f99a9" | 确认：commit 仍不存在，405/404 持续 | 维持 |
| BUG-040 限流 4 次 | 报告"4 次" | fresh_cj 10 次测：5 次 401, 第 6 次 429 | **撤回 v3** |
| BUG-001 scrypt 500 | v3 报 | 密码改相同/不同都 500 | 维持 |
| BUG-004 platform_fees shangou_waimai | v3 报 | DB `eleme_waimai` 仍唯一 | 维持 |

**核心结论**：v3 报告 17 个旧 BUG 中 0 个被实际修复（git log 6/8 0 修复 commit + live API 复测）。

---

## 1. v4 新增 BUG 分布

| 级别 | 数量 | 影响 |
|------|------|------|
| **P0-紧急** | **0** | (v3 已有 6 个 P0) |
| **P1-高** | **3** | BUG-056/057/058 (关键功能) |
| **P2-中** | **5** | BUG-059/060/063/064 |
| **P2-已撤回** | **4** | BUG-061/062/065/066 |
| **v4 新增合计** | **8** | |

**v3 + v4 累计**: P0 × 6 / P1 × 14 / P2 × 18 / UI × 5 = **38 个 BUG**

---

## 2. v4 P1 新增 (3)

### BUG-056 · `/api/dividends/delete` by note 路由不存在
- **接口**: `POST /api/dividends/delete {"note":"..."}`
- **现象**: 405 Not Allowed
- **v2 报告误判**: v2 测试报告"DIV-009 删整批 → 200"，v4 验证该 endpoint 实际 405
- **根因**: `routes/partners.py:149` 只有 `@bp.route('/dividends/<int:id>', methods=['DELETE'])` 单条 DELETE，**没有** batch delete by note 端点
- **页面影响**: PartnerScreen 流水表里 phase4-batch/测试残留无法批量清理
- **证据**: POST /api/dividends/delete → 405；DELETE 同；POST /api/dividends/clear → 405；POST /api/dividends → 401（session 过期）
- **修复**: partners.py 加 `@bp.route('/dividends/delete', methods=['POST'])`

### BUG-057 · `/api/products` 搜索/分页参数全被忽略
- **接口**: `GET /api/products?search=米粉` / `?q=米粉` / `?supplier=蓝姐` / `?limit=5`
- **现象**: 全部返 33 条（全集）
- **根因**: `routes/procurement.py:54-57` GET 分支只 `SELECT * FROM products ORDER BY name`，无 `request.args` 解析
- **页面影响**: 供应链 tab 商品搜索/分页 UI 行为是"看上去有但实际无效"
- **证据**: 4 个不同 query 全部返相同 33 条
- **修复**: api_products GET 分支加 search/q/supplier/limit 解析 + SQL WHERE

### BUG-058 · `/api/daily-revenue?days=N` 永远返空 records 列表
- **接口**: `GET /api/daily-revenue?days={7,30,90,365,1}`
- **现象**: 全部返 `{"records": [], "totals": {"revenue":..., "turnover":..., "jd_revenue":...}}`
- **根因**: `routes/data.py:286-293` days 分支只计算 `totals` 并返空 `records`
- **页面影响**: HomeScreen 7 日营收卡片组件无 records 数据源
- **证据**: days=7 返 records=0; days=30 返 records=0; days=365 返 records=0; DB 实际有 5 条 daily_revenue
- **修复**: days 分支也返 `rows` 数组

---

## 3. v4 P2 新增 (5)

### BUG-059 · 平台手续费 UI 只显示 4 个 sub-category
- **位置**: `HomeScreen.tsx` 平台手续费 section
- **现象**: 只有「美团收银/美团外卖/闪购外卖/美团团购」4 个，少 shangou_waimai
- **根因**: BUG-004 副作用（DB 无 shangou_waimai 列，UI 自动 fallback 不显示）
- **页面影响**: 用户以为只有 4 类平台费
- **修复**: BUG-004 修后自动恢复 5 个

### BUG-060 · 底部 5 tab 只有图标无文字标签
- **位置**: `HomeScreen.tsx:941-942`
- **现象**: 5 个 tab (expense/list/supply/chart/partner) 渲染 SVG icons 但 **无文字标签**
- **影响**: 用户无法识别每个 tab 的含义（"不知道哪个是 supply"）
- **根因**: `<Animated.View style={{ transform: [{ scale: ... }] }}><Icon ... /></Animated.View>` — 只有 Icon 无 `<Text>`
- **修复**: 加文字标签或 tooltip 提示

### BUG-063 · PartnerScreen 不在分红操作后自动刷新
- **位置**: `usePartnerData.ts:54`
- **现象**: 发起分红后 view 不自动更新到新数据，需切走再切回（remount）才刷新
- **根因**: `useEffect(() => { loadData(); }, [])` 依赖 `[]`，PartnerScreen mount 后不会重新 fetch
- **页面影响**: 用户发完分红看不到新数据
- **修复**: 加 polling / refetch on focus / 手动 reload 按钮

### BUG-064 · 透明度 slider 默认 70% vs DEFAULTS 0.5
- **位置**: `HomeScreen.tsx:229-235`
- **现象**: ThemePickerModal slider 显示 70%，但 `parseFloat(saved) || 0.5` 默认 0.5
- **根因**: 之前 phase 1 测试 PUT 改了 `user_settings.background_opacity` 到 0.7，DB 持久化
- **状态**: 测试副作用，非 bug

### BUG-067 (新, v4 phase 4 末发现) · recon reconciled_by 临界值
- **位置**: `routes/data.py:102` 正则 `[\w\u4e00-\u9fa5@.\-]{1,32}`
- **现象**: 1-32 字符通过（含 32），33+ 字符 400
- **特殊字符**: `<script>` / `a;b` / `a b` / `a'b"` 全部 400（正确阻挡 XSS）
- **页面影响**: 中文姓名 32 字符边界紧（"张明明明明明明明明明明明明明明明明明明明" 31 字符 OK，再加 1 字就 400）
- **修复**: 改为 64 字符上限

### BUG-068 (新) · auth-prefs session_timeout_hours 枚举 {1,2,6,24}
- **位置**: `routes/profile.py:55-119` (auth-prefs 端点)
- **现象**: 168h / 8760h 都 400，提示 "must be one of 1, 2, 6, 24"
- **影响**: 用户无法设置 12h / 72h 等常见值
- **修复**: 放宽到 1-720h 范围或明确文档化

---

## 4. v4 已撤回的"误判" (5)

| BUG | v3 报告 | v4 实际 | 撤回原因 |
|-----|---------|---------|----------|
| BUG-040 限流 4 次 | "第 4 次 429" | fresh 10 次测：5 次 401, 第 6 次 429 | 之前 phase IP 累计 |
| BUG-061 5 tab 不切换 | "点击 list 仍显示对账" | 实际 list/expense 都有 sub-tab "对账"，时序问题 | React 异步渲染 |
| BUG-062 认缴错位 | "¥1,000 / -¥43,200" | DB 数据污染（被 phase 1 PUT 改成 1000） | SQL UPDATE 改回 54455.08 即正确 |
| BUG-065 3 sub-tab | "对账/营业/支出" | ExpenseScreen 实际只有 2 个 card (对账/支出) | 看代码 line 384-386 tabCards 数组 |
| BUG-066 0/1 矛盾 | "暂无记录 vs 1 条" | ReconHistoryScreen 默认 30 天过滤是设计行为 | `appliedFrom=30天前, appliedTo=今天` |

---

## 5. v4 UI 测试覆盖 (25 case)

| 屏幕 / 组件 | 状态 | 备注 |
|-------------|------|------|
| LoginScreen | 🟢 12 case 全过 | v3 已测 |
| 登录态注入 token | 🟢 | JS fetch + localStorage + `app:user-change` 事件 |
| 底部 5 tab 切换 | 🟢 | 5 tab 点击均切换内容 (expense/list/supply/chart/partner) |
| 顶部 qa_tester / 主题 / 退出 | 🟢 | 3 按钮可点击 |
| 主题 modal | 🟢 | 3 主题方案 + 70% slider + 选择图片/恢复默认按钮 |
| 分红 modal | 🟢 | 拟向红利池注入 + 轮次备注 + 穿透股权 + 关闭按钮 |
| PartnerScreen 详情 | 🟢 | 3 stat cards + 3 合伙人卡片 + 流水表（4 sub-filter） |
| ExpenseScreen 对账 card | 🟢 | 账面差额/余额/结余 + 平台手续费 4 sub |
| ExpenseScreen 支出 card | 🟢 | 5 stat (日常/采购/房租/薪资) + 添加表单 |
| ReconHistoryScreen 入口 | 🟢 | 0/1 计数 + 过滤 panel (24月上限 + 日期范围校验) |
| ThemePickerModal | 🟢 | 3 主题 + 透明度 slider + 选择图片 |
| snap-scroll 横滑 | 🟡 | tab 切换有点不稳（snap-scroll 150ms 防抖），不影响功能 |
| 后端清理脏数据 | 🟢 | SQL DELETE 1e15/负数/0/测试 batch/phase 残留 |

---

## 6. 业务流（I-04 完整链路）

✅ **创建 procurement batch 触发自动 transaction**：
- POST /api/procurement-batches ¥1490 → 返回 `batch_id=3`
- 同步 INSERT transactions id=13, amount=1490, date=2026-05-15, batch_id=3, category='goods', account='payWechat'
- DB 验证: `SELECT id, type, amount, category, account, date, procurement_batch_id FROM transactions WHERE id=13` → `13|expense|1490.0|goods|payWechat|2026-05-15|3|`

❌ **DELETE batch 触发级联删 transaction**：
- DELETE /api/procurement-batches/3 → **405** (BUG-008 双前缀)
- 业务流断点：batch 可创建但不能删，transaction 留 DB 污染

---

## 7. /api/frontend.zip 实际下载

- **请求**: `GET /api/frontend.zip` (auth)
- **响应**: 200, `Content-Type: application/zip`, size=573088 bytes
- **内容**: 合法 ZIP (PK magic), 7 个文件：
  - favicon.ico (14510)
  - .DS_Store (6148)
  - metadata.json (49)
  - `_expo/static/js/web/index-9067119d0faf33df307854977d828883.js` (657418) — main bundle
  - `_expo/static/js/web/index-d7c54c48b5985257d2c84b93a6761589.js` (658683) — 旧 bundle
  - static/logo.jpg (166713)
  - static/bg.jpg (45589)
- **状态**: ✅ 完整，可被 iOS App 拉取更新

---

## 8. 头像 multipart upload roundtrip

✅ **完整流程**：
- POST /api/users/avatar (multipart, 1x1 PNG) → 200 `{"url":"/user-images/avatars/8.png?t=1780865164"}`
- GET /api/users/avatar?user_id=8 → 200 (size=69, PNG bytes `\x89PNG\r\n\x1a\n...`)
- 头像写入 `user-images/avatars/8.png`，路径 `avatars/8.png?t=...`（cache buster）

✅ **Cover roundtrip**：
- POST /api/profile/cover → 200
- GET /api/profile/cover → 200
- DELETE /api/profile/cover → 200
- GET 再次 → 404（删成功）

---

## 9. 集成链路（v4 更新）

| ID | 链路 | 状态 |
|----|------|------|
| I-01 | 创建 procurement batch → 自动写 transaction expense | ✅ |
| I-02 | 删除 batch → 同步删 transaction | ❌ BUG-008 405 |
| I-03 | 编辑 batch → 联动 transaction amount | ✅ (PUT 工作) |
| I-04 | 录入 daily-rev → business-summary 累加 | ❌ BUG-004 500 |
| I-05 | 录入 platform-fee → business-summary 累加 | ❌ BUG-004 500 |
| I-06 | 登出 → user_sessions + user_tokens 清理 | ✅ |
| I-07 | enforce_single_session=1 → 旧 session revoked | ✅ |
| I-08 | 限流 5 次后返 429 + 等待秒数 | ✅ (v3 撤回) |
| I-09 | user_sessions 累计清理 | ⚠️ DB 18+ 条历史未自动清 |
| I-10 | 头像更新 → bg-changed event → HomeScreen 刷新 | ✅ |
| I-11 | login 成功 → app:user-change 事件 → ThemeProvider 重新拉 lang/theme | ✅ |
| I-12 | pageStack 持久化到 history.state | ✅ |
| I-13 | 三语切换 → 后端 PUT /api/settings/lang | ✅ |
| I-14 | 头像 crop → upload → display roundtrip | ✅ |
| I-15 | PartnerScreen mount 时 fetch data | ✅ |
| I-16 | PartnerScreen 不在分红操作后自动刷新 | ❌ BUG-063 |
| I-17 | ThemePickerModal 透明度 slider ↔ server opacity | ✅ |

---

## 10. v4 修复优先级建议（按用户感知）

1. **BUG-056**（dividends 批量删路由）— partners.py 加 5 行
2. **BUG-057**（products search）— api_products GET 加 8 行 query 解析
3. **BUG-058**（daily-rev days records）— data.py:286 加 1 行
4. **BUG-059**（平台手续费 4 sub）— 修 BUG-004 自动恢复
5. **BUG-060**（5 tab 无文字）— HomeScreen.tsx 加文字
6. **BUG-063**（PartnerScreen 不刷新）— usePartnerData 加 refetch
7. **BUG-067/068**（recon 32 字符 / auth-prefs 枚举）— 1-2 行放宽

---

## 11. 累计统计（含 v1-v4）

| 报告 | 日期 | 端点 | UI | BUG | P0 | P1 | P2 |
|------|------|------|----|----|----|----|----|
| v1 partner-full | 2026-05-27 | - | - | 7 | - | - | - |
| v2 报告 | 2026-06-07 | 68/68 (82%) | - | 17 | 4 | 8 | 5 |
| v3 报告 | 2026-06-08 | 75/75 (100%) | 12 | 34 | 6 | 11 | 17 |
| **v4 报告（本）** | 2026-06-08 | 75/75 (100%) | 25 | **+8** | 0 | 3 | 5 |
| **v3+v4 累计** | 2026-06-08 | 100% | 25 | **38** | 6 | 14 | 18 |

## 12. 改动历史

- 2026-05-27 v1 partner-full 报告
- 2026-06-07 v2 报告（17 BUG）
- 2026-06-08 03:00 v3 报告（34 BUG）
- 2026-06-08 04:30 v4 报告（本，+8 BUG, -5 撤回）

# 蓝姐螺蛳粉 · 测试用例补缺（Test Cases Supplement）

> **本档定位**：补 7 个专项测试**未覆盖**的接口、屏幕、横切关注点。
>
> **已有的 7 个专项（不重复，本档不写）**：
> | 文件 | 范围 |
> |---|---|
> | test-cases-auth-recon.md | 登录/注册/忘记密码 + 对账 (ExpenseScreen Tab 0) + 对账记录 (ReconHistoryScreen) |
> | test-cases-expense-screen.md | ExpenseScreen 三模块（对账/营业/支出） |
> | test-cases-expense-redesign.md | ExpenseScreen 视觉/动效细节（FadeIn/NumberTicker/聚焦动效） |
> | test-cases-partner-fix.md | 合伙人页 Bug 修复第一轮 |
> | test-cases-partner-fix2.md | 合伙人页 icon/弹窗对齐 8600 |
> | test-cases-partner-full.md | **合伙人页权威完整版**（覆盖 fix / fix2） |
> | test-cases-procurement.md | 供应链 (ProcurementScreen) |
>
> **本档覆盖（按章节）**：
> 1. 账单/流水 transactions API（凭证上传/缩略图）
> 2. 每日营收 daily_revenue API + DailyRevenueHistory 屏幕
> 3. 平台费用 platform_fees API
> 4. 设置 settings API（lang/theme/background）
> 5. 用户管理（admin）
> 6. 静态资源 + SPA fallback
> 7. 统计接口（stats/summary/chart/procurement-stats）
> 8. 运维接口（frontend-version/zip、migrate、clear）
> 9. HomeScreen UI
> 10. ExpenseHistoryScreen UI
> 11. i18n 字段综合对照表
> 12. 性能
> 13. 安全
> 14. 兼容性 / 平台
> 15. 集成 E2E（跨模块）
> 16. 回归 / 烟雾
> 附录 A · 项目硬规则
> 附录 B · 不在范围

---

## 0. 前置条件与约定

### 0.1 测试数据准备
- [ ] 0.1.1 预置 7 天 daily_revenue 记录（连续 7 天营业额）
- [ ] 0.1.2 预置 1 张支出凭证图（jpg, <500KB）和 1 张大图（>500KB 触发压缩）
- [ ] 0.1.3 预置 2 个平台费用记录（meituan + jingdong，各 1 条）
- [ ] 0.1.4 预置 2 个 user：一个 admin，一个普通 user
- [ ] 0.1.5 预置 1 张背景图（用户上传）
- [ ] 0.1.6 至少 30 条 income/expense transactions（覆盖 ExpenseHistoryScreen 滚动）

### 0.2 调用约定
- 所有 `/api/*` 返回 `{status: "ok"|"error", ...}`
- i18n 通过 `X-Lang: zh-CN | zh-TW | en` header 切换
- session lifetime 24h；闲置 2h 前端自动跳登录

---

## 1. 账单 / 流水（Transactions）

> 已有的 expense-screen.md / auth-recon.md 覆盖 ExpenseScreen UI 录入；本节专注**后端 API 完整契约**与**图片上传管道**。

### 1.1 创建 transaction
- [ ] 1.1.1 POST `/api/transactions` 必填：`type, amount, category, date`
- [ ] 1.1.2 type ∈ `income | expense`
- [ ] 1.1.3 amount 为正整数（单位：分）
- [ ] 1.1.4 date 格式 `YYYY-MM-DD` 严格校验
- [ ] 1.1.5 选填：`note, images[], thumb_images[], has_thumbs`
- [ ] 1.1.6 缺 `type` 或 `amount` → 400 + i18n 错误消息
- [ ] 1.1.7 amount=0 → 接受（占位条目）
- [ ] 1.1.8 amount 负数 → 400
- [ ] 1.1.9 images 数组最多 9 张（前端 UI 限制）
- [ ] 1.1.10 images 与 thumb_images 长度必须一致（has_thumbs=true 时）
- [ ] 1.1.11 has_thumbs=false 时 thumb_images 应为空
- [ ] 1.1.12 创建后返回新 id，前端列表插入顶部（按 created_at DESC）

### 1.2 列表 / 分页 / 筛选
- [ ] 1.2.1 GET `/api/transactions?page=1&per_page=10` 默认分页
- [ ] 1.2.2 返回 `{items, page, pages, total}`
- [ ] 1.2.3 筛选 `type=income` 仅返回收入
- [ ] 1.2.4 筛选 `type=expense` 仅返回支出
- [ ] 1.2.5 筛选 `date_from` / `date_to` 按 date 字段
- [ ] 1.2.6 筛选 `category` 模糊匹配（LIKE %category%）
- [ ] 1.2.7 `page=999` 超出 → items=[]，total 仍正确
- [ ] 1.2.8 `per_page=0` → 400
- [ ] 1.2.9 `per_page=1000` → 接受但设上限 100
- [ ] 1.2.10 默认排序 `created_at DESC`
- [ ] 1.2.11 items 字段：`id, type, amount, category, date, note, images[], thumb_images[], has_thumbs, created_at`

### 1.3 删除
- [ ] 1.3.1 DELETE `/api/transactions/<id>` 仅本人记录可删
- [ ] 1.3.2 跨用户 id 删除 → 403
- [ ] 1.3.3 不存在的 id → 404
- [ ] 1.3.4 删除后关联图片**不**从磁盘删除（DB 留旧图，避免数据黑洞）
- [ ] 1.3.5 删除后再次 GET → 该 id 消失

### 1.4 凭证图片上传管道
- [ ] 1.4.1 POST `/api/expenses/upload-images` multipart/form-data
- [ ] 1.4.2 字段名 `files`（可多文件）
- [ ] 1.4.3 单文件 ≤ 10MB；超出 → 413
- [ ] 1.4.4 文件类型仅 jpg/jpeg/png/webp/heic，其他 → 415
- [ ] 1.4.5 返回 `{status, images[](原图URL), thumb_images[](缩略图URL), has_thumbs: bool}`
- [ ] 1.4.6 同时存原图和 400x400 缩略图（无缩略图不返回路径）
- [ ] 1.4.7 上传路径前缀 `/expense-imgs/4/`
- [ ] 1.4.8 缩略图命名 `<原名>_thumb.<ext>`
- [ ] 1.4.9 上传 0 个文件 → 400
- [ ] 1.4.10 上传相同文件（同名同大小）两次 → 第二次也成功（不查重）
- [ ] 1.4.11 图片损坏（Magic bytes 错） → 415

### 1.5 数据契约：缩略图
- [ ] 1.5.1 has_thumbs=true 时，thumb_images 与 images 长度一致
- [ ] 1.5.2 前端用 `images[i]` 显示大图，`thumb_images[i]` 显示列表缩略图
- [ ] 1.5.3 has_thumbs=false 时，前端降级用 images 显示缩略图（前端逻辑，不写兼容回退到后端）
- [ ] 1.5.4 旧数据无 thumb_images 字段 → 前端按 has_thumbs=false 处理

---

## 2. 每日营收（Daily Revenue）

### 2.1 后端 API
- [ ] 2.1.1 POST `/api/daily-revenue` 必填：`date, total_revenue, actual_revenue, jingdong_revenue`
- [ ] 2.1.2 date 唯一约束：同 date 重复 → upsert（覆盖）
- [ ] 2.1.3 GET `/api/daily-revenue?page=1&per_page=30` 分页
- [ ] 2.1.4 GET `/api/daily-revenue?year=2026&month=5` 按月筛选
- [ ] 2.1.5 GET `/api/daily-revenue?date=2026-05-27` 单日
- [ ] 2.1.6 GET `/api/daily-revenue?days=7` 最近 7 天
- [ ] 2.1.7 GET `/api/daily-revenue/last-7` 便捷接口
- [ ] 2.1.8 PUT `/api/daily-revenue/<id>` 改
- [ ] 2.1.9 DELETE `/api/daily-revenue/<id>` 删
- [ ] 2.1.10 字段：`id, date, total_revenue, actual_revenue, jingdong_revenue, notes, created_at, updated_at`

### 2.2 数据校验
- [ ] 2.2.1 total_revenue ≥ actual_revenue（应收 ≥ 实收）
- [ ] 2.2.2 actual_revenue ≥ jingdong_revenue
- [ ] 2.2.3 三个字段均 ≥ 0
- [ ] 2.2.4 date 范围：不能是未来日期（> today → 400）
- [ ] 2.2.5 跨月查询时数据完整（不漏边界日）
- [ ] 2.2.6 last-7 包含今天（不滚到昨天）

### 2.3 DailyRevenueHistory 屏幕（前端）
- [ ] 2.3.1 按月分组显示（每月一段，月合计 + 月均）
- [ ] 2.3.2 月均 = 月合计 / 该月有记录的天数
- [ ] 2.3.3 单日卡片：日期 + 营业额 + 实际 + 京东 + 备注
- [ ] 2.3.4 默认倒序（最新在顶）
- [ ] 2.3.5 「+ 录入」按钮 → 弹窗含 4 字段（日期、total、actual、jingdong、备注）
- [ ] 2.3.6 录入弹窗 actual ≤ total 校验（前端拦截）
- [ ] 2.3.7 录入弹窗 jingdong ≤ actual 校验
- [ ] 2.3.8 录入成功后弹窗关闭，列表刷新，新记录置顶
- [ ] 2.3.9 长按单日卡片 → 编辑 / 删除（带二次确认）
- [ ] 2.3.10 空状态：「暂无营收记录」

---

## 3. 平台费用（Platform Fees）

### 3.1 后端 API
- [ ] 3.1.1 GET `/api/platform-fees?year=2026&month=5` 按月筛选
- [ ] 3.1.2 字段：`id, date, platform, fee_amount, fee_type, notes`
- [ ] 3.1.3 platform ∈ `meituan | eleme | jingdong | douyin | other`
- [ ] 3.1.4 fee_type ∈ `service | commission | ads | other`
- [ ] 3.1.5 POST `/api/platform-fees/entry` 单条录入
- [ ] 3.1.6 PUT `/api/platform-fees/<id>` 改
- [ ] 3.1.7 fee_amount 单位：元（非分）
- [ ] 3.1.8 同一日同一平台可有多个 fee_type 条目
- [ ] 3.1.9 排序：date DESC, created_at DESC
- [ ] 3.1.10 月度合计：GET 返回时附带 `monthly_total`

### 3.2 校验
- [ ] 3.2.1 fee_amount > 0
- [ ] 3.2.2 date 不能为未来
- [ ] 3.2.3 platform 非法值 → 400
- [ ] 3.2.4 fee_type 非法值 → 400

---

## 4. 设置（Settings）

### 4.1 背景图（Background）
- [ ] 4.1.1 GET `/api/settings/background` → `{url: string | null, opacity: number, blur: number}`
- [ ] 4.1.2 POST 上传（multipart `file`）→ 返回新 url
- [ ] 4.1.3 PUT `/api/settings/background {opacity, blur, position}` 调整
- [ ] 4.1.4 DELETE `/api/settings/background` → 重置为默认
- [ ] 4.1.5 文件类型 jpg/png/webp
- [ ] 4.1.6 文件大小 ≤ 5MB
- [ ] 4.1.7 路径：`/user-images/<filename>`
- [ ] 4.1.8 随机文件名（避免覆盖 + 路径注入）
- [ ] 4.1.9 Magic bytes 校验（不仅扩展名）
- [ ] 4.1.10 path traversal：`/user-images/..%2F..%2Fapp.py` → 404

### 4.2 语言偏好（Lang）
- [ ] 4.2.1 GET `/api/settings/lang` → `{lang: 'zh-CN' | 'zh-TW' | 'en'}`
- [ ] 4.2.2 PUT `/api/settings/lang {lang}` 持久化到 `user_settings`
- [ ] 4.2.3 非法 lang 值 → 400
- [ ] 4.2.4 新用户首次访问 → 走 `X-Lang` header，缺省 `zh-CN`
- [ ] 4.2.5 前端 i18n 切换实时生效（不刷新）
- [ ] 4.2.6 后端响应 message 跟随用户 lang 设置

### 4.3 主题（Theme）
- [ ] 4.3.1 GET `/api/settings/theme` → `{theme: 'light' | 'dark'}`
- [ ] 4.3.2 PUT `/api/settings/theme {theme}` 切换
- [ ] 4.3.3 非法 theme → 400
- [ ] 4.3.4 切换后所有 colors 调色板联动
- [ ] 4.3.5 暗色模式背景 #1A1A1A，文字 #E5E5E5

---

## 5. 用户管理（Admin Only）

### 5.1 列表
- [ ] 5.1.1 GET `/api/users` 仅 admin 可访问
- [ ] 5.1.2 非 admin → 403
- [ ] 5.1.3 返回字段：`id, username, email, is_verified, is_admin, created_at`
- [ ] 5.1.4 **必须不包含** `password_hash`（响应体脱敏）
- [ ] 5.1.5 空 users 表 → `[]`
- [ ] 5.1.6 排序：created_at ASC

### 5.2 用户操作（占位）
- [ ] 5.2.1 POST `/api/users`（注册）已在 §1.1 覆盖
- [ ] 5.2.2 修改用户角色 / 禁用账号：**当前未实现**，需评估是否添加

---

## 6. 静态资源 + SPA Fallback

### 6.1 SPA 路由 fallback
- [ ] 6.1.1 GET `/` → 返回 `dist/index.html` 200
- [ ] 6.1.2 GET `/login` → 返回 `dist/index.html` 200（**不** 404）
- [ ] 6.1.3 GET `/partner` → 返回 `dist/index.html` 200
- [ ] 6.1.4 GET `/recon-history` → 返回 `dist/index.html` 200
- [ ] 6.1.5 GET `/api/...` → 走 API 路由，**不**被 SPA fallback 拦截
- [ ] 6.1.6 GET `/expense-imgs/...` → 走静态路由
- [ ] 6.1.7 GET `/user-images/...` → 走静态路由
- [ ] 6.1.8 GET `/logout` → 302 重定向到 `/login`（不返 index.html）

### 6.2 静态文件服务
- [ ] 6.2.1 `/expense-imgs/<path>` → 200 + `image/*`
- [ ] 6.2.2 `/user-images/<path>` → 200 + `image/*`
- [ ] 6.2.3 不存在路径 → 404
- [ ] 6.2.4 目录列表禁止
- [ ] 6.2.5 path traversal：`/expense-imgs/../../../etc/passwd` → 404
- [ ] 6.2.6 URL encode bypass：`/expense-imgs/..%2F..%2Fapp.py` → 404
- [ ] 6.2.7 静态文件用 `safe_join` 或类似保护

---

## 7. 统计接口

### 7.1 GET /api/summary
- [ ] 7.1.1 返回 `{total_income, total_expense, profit, total_dividends, partner_capital}`
- [ ] 7.1.2 时间范围默认本月
- [ ] 7.1.3 选填 `from` / `to` query 自定义范围
- [ ] 7.1.4 缺数据时返回 0（**非** null）
- [ ] 7.1.5 profit = total_income - total_expense
- [ ] 7.1.6 数字精度：分 → 元（÷100），保留 2 位
- [ ] 7.1.7 total_dividends 来自 dividends 表求和

### 7.2 GET /api/stats
- [ ] 7.2.1 按 category 聚合的统计
- [ ] 7.2.2 按 platform 聚合的平台费用
- [ ] 7.2.3 时间范围同 summary

### 7.3 GET /api/procurement-stats
- [ ] 7.3.1 返回 `{batch_count, total_amount, gross_margin}`
- [ ] 7.3.2 gross_margin = 1 - (procurement_total / revenue_total)
- [ ] 7.3.3 revenue_total=0 → gross_margin=0（不报除零）

### 7.4 GET /api/chart
- [ ] 7.4.1 返回最近 30 天 daily_revenue 折线数据
- [ ] 7.4.2 数组元素 `{date, total, actual}`
- [ ] 7.4.3 数据缺失日 → `{date, total: 0, actual: 0}` 补 0
- [ ] 7.4.4 按 date ASC 升序

---

## 8. 运维接口

### 8.1 /api/frontend-version
- [ ] 8.1.1 GET 返回 `{version: '1.0.0', build: 'YYYY-MM-DD'}`
- [ ] 8.1.2 iOS 端用此判断是否需要更新

### 8.2 /api/frontend.zip
- [ ] 8.2.1 GET 返回最新前端 zip 包（application/zip）
- [ ] 8.2.2 文件名 `snail-books-frontend-1.0.0.zip`
- [ ] 8.2.3 iOS 端下载后解压覆盖 `web/` 目录
- [ ] 8.2.4 旧版 zip 应保留（不删除，供降级用）

### 8.3 /api/migrate-recon
- [ ] 8.3.1 POST 仅 admin
- [ ] 8.3.2 数据迁移到新 schema
- [ ] 8.3.3 事务保护：任一步失败回滚
- [ ] 8.3.4 迁移前后比对记录数

### 8.4 /api/reconciliations/clear
- [ ] 8.4.1 POST 清空所有对账记录
- [ ] 8.4.2 **不可恢复**操作
- [ ] 8.4.3 前端需要二次确认 + 验证密码
- [ ] 8.4.4 操作日志：写入 audit log

---

## 9. 前端 UI · HomeScreen

> 已有的 partner-full.md 覆盖 PartnerScreen；本节专注 HomeScreen 顶部导航 + 4 tab 切换 + 数据加载。

### 9.1 顶部导航
- [ ] 9.1.1 4 个 tab 横排：账单 / 记账 / 供应链 / 趋势
- [ ] 9.1.2 当前 tab 下划线高亮（中国红 #8B1E22）
- [ ] 9.1.3 切换 tab 触发对应 API 加载
- [ ] 9.1.4 当前 tab 持久化到 `localStorage.active_tab`
- [ ] 9.1.5 刷新页面后恢复上次 tab
- [ ] 9.1.6 「合伙人」入口在右上角 → 跳转 PartnerScreen
- [ ] 9.1.7 退出登录按钮（齿轮/头像）

### 9.2 各 tab 数据加载
- [ ] 9.2.1 「账单」→ `getTransactions(1, 10)` + 列表展示
- [ ] 9.2.2 「记账」→ 跳 ExpenseScreen
- [ ] 9.2.3 「供应链」→ `getProducts()` + `getProcurements()` + `getProcurementStats()`
- [ ] 9.2.4 「趋势」→ `getChart()` + `getSummary()` + 折线图
- [ ] 9.2.5 任一 API 失败 → toast「数据加载失败」+ 不崩溃
- [ ] 9.2.6 加载中显示 skeleton / spinner
- [ ] 9.2.7 切换 tab 间隔 < 100ms 不重复请求（防抖）

### 9.3 下拉刷新
- [ ] 9.3.1 当前 tab 支持下拉刷新
- [ ] 9.3.2 刷新期间显示 loading indicator
- [ ] 9.3.3 刷新成功 → 数据更新 + 指示器消失
- [ ] 9.3.4 刷新失败 → toast 错误 + 保留旧数据

---

## 10. 前端 UI · ExpenseHistoryScreen

> 已有的 partner-full.md / procurement.md 不涉及此屏；本节专门覆盖。

### 10.1 列表
- [ ] 10.1.1 流水卡片：日期 / 分类 / 金额 / 备注
- [ ] 10.1.2 缩略图网格（最多 9 张，超出显示「+N」）
- [ ] 10.1.3 缩略图用 `thumb_images[i]`，点击 → 全屏预览用 `images[i]`
- [ ] 10.1.4 缩略图懒加载（滚动到视口再加载）
- [ ] 10.1.5 长按卡片 → 弹出操作菜单（编辑 / 删除 / 复制）
- [ ] 10.1.6 左滑卡片 → 删除按钮（带二次确认）
- [ ] 10.1.7 列表倒序（最新在顶）
- [ ] 10.1.8 无数据 → 「暂无数据」

### 10.2 全屏图片预览
- [ ] 10.2.1 点击缩略图 → 全屏 modal
- [ ] 10.2.2 左右滑动切换同 transaction 的图
- [ ] 10.2.3 双指缩放
- [ ] 10.2.4 点击空白处 / 下滑关闭
- [ ] 10.2.5 显示页码 (1/3)

### 10.3 筛选
- [ ] 10.3.1 日期范围 from / to
- [ ] 10.3.2 type 切换（全部 / 收入 / 支出）
- [ ] 10.3.3 类别筛选
- [ ] 10.3.4 重置 / 应用

### 10.4 滑动手势返回
- [ ] 10.4.1 左边缘 36px 区域右滑 > 80px → 返回 HomeScreen
- [ ] 10.4.2 垂直滚动 > 水平时不触发

---

## 11. i18n 字段综合对照表

> partner-full.md §10 覆盖合伙人页；本表覆盖全局关键字段（其他屏幕）。

| Key | zh-CN | zh-TW | en | 出现的屏幕 |
|-----|-------|-------|-----|-----------|
| appTitle | 蓝姐螺蛳粉 | 藍姐螺螄粉 | Lan's Luosifen | 全局 |
| login | 登 录 | 登 錄 | Log In | LoginScreen |
| register | 注 册 | 注 冊 | Sign Up | LoginScreen |
| logout | 退出登录 | 退出登錄 | Logout | HomeScreen |
| logoutConfirm | 确定要退出登录吗？ | 確定要退出登錄嗎？ | Confirm logout? | HomeScreen |
| username | 账号 | 帳號 | Username | LoginScreen |
| password | 密码 | 密碼 | Password | LoginScreen |
| email | 邮箱 | 郵箱 | Email | LoginScreen |
| loginPlaceholder | 用户名 / 邮箱 | 用戶名 / 郵箱 | Username / Email | LoginScreen |
| rememberMe | 记住我 | 記住我 | Remember Me | LoginScreen |
| forgotPassword | 忘记密码？ | 忘記密碼？ | Forgot password? | LoginScreen |
| subtitle | 生活不简单，尽量简单过 | 生活不簡單，盡量簡單過 | Life isn't simple, keep it simple | LoginScreen |
| errEmptyFields | 请填写所有字段 | 請填寫所有欄位 | Please fill in all fields | LoginScreen |
| errNetworkError | 网络错误，请检查网络后重试 | 網路錯誤，請檢查網路後重試 | Network error, please retry | 全局 |
| errWrongCredentials | 账号或密码错误 | 帳號或密碼錯誤 | Wrong username or password | LoginScreen |
| errEmailInvalid | 邮箱格式不正确 | 郵箱格式不正確 | Invalid email format | LoginScreen |
| errSessionExpired | 登录已过期，请重新登录 | 登錄已過期，請重新登錄 | Session expired, please log in again | 全局 |
| tabBill | 账单 | 帳單 | Bills | HomeScreen |
| tabRecord | 记账 | 記帳 | Record | HomeScreen |
| tabSupply | 供应链 | 供應鏈 | Supply | HomeScreen |
| tabTrends | 趋势 | 趨勢 | Trends | HomeScreen |
| navPartner | 合伙人 | 合夥人 | Partners | HomeScreen |
| income | 收入 | 收入 | Income | 全局 |
| expense | 支出 | 支出 | Expense | 全局 |
| profit | 利润 | 利潤 | Profit | HomeScreen |
| procurement | 进货 | 進貨 | Procurement | HomeScreen |
| today | 今日 | 今日 | Today | 全局 |
| month | 本月 | 本月 | This Month | 全局 |
| noData | 暂无数据 | 暫無數據 | No data | 全局 |
| verifyEmail | 验证邮箱 | 驗證郵箱 | Verify Email | LoginScreen |
| verifyCode | 验证码 | 驗證碼 | Verification Code | LoginScreen |
| resendCode | 重新发送 | 重新發送 | Resend | LoginScreen |
| forgotStep1 | 请输入注册邮箱 | 請輸入註冊郵箱 | Enter your registered email | LoginScreen |
| resetPassword | 重置密码 | 重設密碼 | Reset Password | LoginScreen |
| newPassword | 新密码 | 新密碼 | New Password | LoginScreen |
| confirmPassword | 确认密码 | 確認密碼 | Confirm Password | LoginScreen |
| pwHint | 6位以上，含字母+数字 | 6位以上，含字母+數字 | 6+ chars, letters + numbers | LoginScreen |
| errPwMismatch | 两次密码不一致 | 兩次密碼不一致 | Passwords do not match | LoginScreen |
| errPwTooShort | 密码至少 6 位 | 密碼至少 6 位 | Password must be 6+ chars | LoginScreen |
| errPwNeedLetter | 密码必须包含字母 | 密碼必須包含字母 | Password must contain a letter | LoginScreen |
| errPwNeedNumber | 密码必须包含数字 | 密碼必須包含數字 | Password must contain a number | LoginScreen |

### 11.1 切换测试
- [ ] 11.1.1 简 → 繁 → 英 → 简 循环 3 轮，UI 全部正确
- [ ] 11.1.2 切换不刷新页面（前端 i18n 实时）
- [ ] 11.1.3 切换后 `X-Lang` header 同步更新
- [ ] 11.1.4 后端返回的 error 消息也跟随语言
- [ ] 11.1.5 日期格式：中文 `2026/5/27`，英文 `May 27, 2026`
- [ ] 11.1.6 数字格式：中文 `1,234.56`，英文 `1,234.56`（一致），繁中同简
- [ ] 11.1.7 货币符号：均用 `¥` 符号（前缀）

### 11.2 缺失 key 防御
- [ ] 11.2.1 故意删除某 zh-CN key → 降级显示 key 字面（不崩）
- [ ] 11.2.2 新增字段必须同时三处加（CI 检查）
- [ ] 11.2.3 后端 i18n_backend.py 与前端 i18n.ts key 应保持一致

---

## 12. 性能

### 12.1 渲染
- [ ] 12.1.1 ExpenseHistoryScreen 100 条记录 < 500ms 渲染
- [ ] 12.1.2 ReconHistoryScreen 1000 条滚动保持 60fps
- [ ] 12.1.3 PartnerScreen 3 个股东 + 50 条流水 < 300ms 渲染
- [ ] 12.1.4 缩略图懒加载（IntersectionObserver / FlatList windowSize=5）
- [ ] 12.1.5 DailyRevenueHistory 365 天月度数据 < 200ms

### 12.2 网络
- [ ] 12.2.1 首屏加载（包含 login + summary）< 1.5s（本地）
- [ ] 12.2.2 API 平均响应 < 200ms（本地）
- [ ] 12.2.3 图片压缩后 < 500KB（>500KB 触发）
- [ ] 12.2.4 并发 10 个 API 调用不阻塞 UI
- [ ] 12.2.5 缩略图 < 50KB（400x400 JPEG quality 80）
- [ ] 12.2.6 SPA bundle gzip < 500KB

### 12.3 DB
- [ ] 12.3.1 10000 条 transactions 查询 < 100ms（带索引）
- [ ] 12.3.2 LEFT JOIN partners + dividends < 50ms
- [ ] 12.3.3 WAL 模式开启（snail.db-wal 文件存在）
- [ ] 12.3.4 10000 条 daily_revenue 月度聚合 < 50ms

---

## 13. 安全

### 13.1 SQL 注入
- [ ] 13.1.1 登录 username = `' OR 1=1--` → 401（不绕过）
- [ ] 13.1.2 全部使用参数化查询（cursor.execute + 占位符）
- [ ] 13.1.3 LIKE 查询 escape `%` / `_`

### 13.2 XSS
- [ ] 13.2.1 transaction.note = `<script>alert(1)</script>` → 显示原文不执行
- [ ] 13.2.2 partner name = `"><img src=x onerror=alert(1)>` → 转义
- [ ] 13.2.3 React Native 默认 escape 验证
- [ ] 13.2.4 platform_fees.notes 同上

### 13.3 CSRF
- [ ] 13.3.1 POST 表单需要 CSRF token
- [ ] 13.3.2 Bearer Token 不受 CSRF 影响
- [ ] 13.3.3 跨域请求需带 `Origin` 头校验

### 13.4 路径穿越
- [ ] 13.4.1 `/expense-imgs/../../../etc/passwd` → 404
- [ ] 13.4.2 `/user-images/..%2F..%2Fapp.py` → 404
- [ ] 13.4.3 静态 send_file 用 `safe_join` 或 `flask.send_from_directory`

### 13.5 文件上传
- [ ] 13.5.1 上传 .php / .exe / .sh → 415
- [ ] 13.5.2 Magic bytes 校验（不仅扩展名）
- [ ] 13.5.3 随机文件名（uuid4 / secrets.token_hex）
- [ ] 13.5.4 上传时 virus scan（占位，待评估）

### 13.6 密码
- [ ] 13.6.1 DB 存 hash（bcrypt / argon2 / werkzeug.security.generate_password_hash）
- [ ] 13.6.2 API 响应从不包含 password_hash
- [ ] 13.6.3 密码传输 HTTPS（生产）
- [ ] 13.6.4 密码重置后旧 hash 失效

### 13.7 Session
- [ ] 13.7.1 session cookie HttpOnly + SameSite=Lax
- [ ] 13.7.2 secret_key 来自 env var，不硬编码
- [ ] 13.7.3 session 固定攻击防护（login 后 rotate session id）
- [ ] 13.7.4 session lifetime 24h 后过期

### 13.8 Bearer Token（iOS）
- [ ] 13.8.1 token 存 iOS Keychain（不存 UserDefaults）
- [ ] 13.8.2 token 长度 ≥ 32 字符（secrets.token_urlsafe(32)）
- [ ] 13.8.3 token 泄露：用户在 web 修改密码 → iOS token 失效

### 13.9 限流
- [ ] 13.9.1 登录失败：同 IP 1 分钟 5 次 → 第 6 次 429
- [ ] 13.9.2 限流计数器基于 IP（X-Forwarded-For 优先）
- [ ] 13.9.3 重置密码请求：同 IP 1 小时 3 次 → 第 4 次 429

---

## 14. 兼容性 / 平台

### 14.1 屏幕尺寸
- [ ] 14.1.1 移动端 < 640px 纵向布局
- [ ] 14.1.2 桌面端 ≥ 640px 横向分栏
- [ ] 14.1.3 超宽屏 ≥ 1920px 内容居中，最大宽度 1200px
- [ ] 14.1.4 横屏 / 竖屏切换不崩溃

### 14.2 浏览器
- [ ] 14.2.1 Chrome 100+ ✓
- [ ] 14.2.2 Safari 15+ ✓
- [ ] 14.2.3 Firefox 100+ ✓
- [ ] 14.2.4 Edge 100+ ✓
- [ ] 14.2.5 iOS Safari 14+（WKWebView）
- [ ] 14.2.6 Android Chrome 90+
- [ ] 14.2.7 IE 11 不支持（项目不承诺）

### 14.3 Expo
- [ ] 14.3.1 Expo Go iOS 启动成功
- [ ] 14.3.2 Expo Go Android 启动成功
- [ ] 14.3.3 `expo export --platform web` 构建成功
- [ ] 14.3.4 注入 CSS（inject-css.py）正确合并
- [ ] 14.3.5 iOS EAS Build 成功

### 14.4 iOS
- [ ] 14.4.1 iOS 15+（最低支持版本）
- [ ] 14.4.2 iPhone SE（小屏）布局正常
- [ ] 14.4.3 iPad（横屏）布局正常
- [ ] 14.4.4 横屏 / 竖屏切换不丢失状态
- [ ] 14.4.5 SafeArea 处理（刘海/灵动岛）

---

## 15. 集成 E2E（跨模块）

### 15.1 完整记账流程
- [ ] 15.1.1 登录 → 进 ExpenseScreen → 选对账 tab → 填卡余额/现金/5 渠道 → 提交 → 跳 ReconHistoryScreen 看到新记录
- [ ] 15.1.2 上传 1 张凭证图 → 创建 transaction 带图 → 进 ExpenseHistoryScreen 看到缩略图 → 点击看大图
- [ ] 15.1.3 复制 / 移动 / 删除（涉及 transactions API + UI 联动）

### 15.2 完整分红流程
- [ ] 15.2.1 进 PartnerScreen → 点「发起分红」→ 输入总额 10000 → 确认 → 后端按 share_pct 拆 3 条记录
- [ ] 15.2.2 顶部「已派发分红池」+10000
- [ ] 15.2.3 进详情弹窗，看到每位股东的分红金额
- [ ] 15.2.4 误发起 → 点删除 → 整批删除（按 note）
- [ ] 15.2.5 验证 partner-full.md §11.1 边界用例

### 15.3 完整供应链流程
- [ ] 15.3.1 商品管理 → 新增「米粉/袋/蓝姐螺蛳粉/15.5」→ 列表看到
- [ ] 15.3.2 新进货 → 选 5 个商品各 + 数量 → 下单 → 选微信 + 上传凭证 → 提交
- [ ] 15.3.3 进货记录 Tab 看到新批次
- [ ] 15.3.4 统计卡片 +1 批次 / +金额
- [ ] 15.3.5 验证 procurement.md §25 边界用例

### 15.4 跨模块数据一致性
- [ ] 15.4.1 summary 接口应同时反映 transactions / dividends / procurements 的变化
- [ ] 15.4.2 删除 transaction → summary 立即更新
- [ ] 15.4.3 发起分红 → summary.total_dividends 立即增加
- [ ] 15.4.4 chart 数据：daily_revenue 录入 → chart 立即反映

### 15.5 多设备同步
- [ ] 15.5.1 Web 创建一条 transaction → 刷新 iOS → 看到
- [ ] 15.5.2 iOS 修改 language → Web 重新登录 → 应用新语言
- [ ] 15.5.3 Bearer Token 在 iOS 持久化（Keychain），web session 在 cookie
- [ ] 15.5.4 Web 退出 → iOS 仍可用（独立 token），web 重新登录不影响 iOS

### 15.6 设置同步
- [ ] 15.6.1 Web 修改主题为 dark → iOS 重新登录 → 应用 dark
- [ ] 15.6.2 上传背景图 → 退出 → 重新登录 → 背景图仍生效
- [ ] 15.6.3 修改语言 → 重新登录 → 语言设置保留

---

## 16. 回归 / 烟雾

### 16.1 启动烟雾
- [ ] 16.1.1 `flask run` 启动无报错
- [ ] 16.1.2 访问 `/` 200
- [ ] 16.1.3 登录 → 各 tab 切换无白屏
- [ ] 16.1.4 `/api/summary` 返回 200
- [ ] 16.1.5 `/api/chart` 返回 200
- [ ] 16.1.6 前端 `npm run start` Expo 启动无报错

### 16.2 关键路径
- [ ] 16.2.1 登录 → 看 summary → 看 1 条 transaction → 删除 → 看到 toast
- [ ] 16.2.2 进对账 → 填值 → 提交 → 跳历史 → 看到记录
- [ ] 16.2.3 进合伙人 → 发 1 次分红 → 看到汇总增加
- [ ] 16.2.4 进供应链 → 新增商品 → 新进货 → 看统计更新
- [ ] 16.2.5 上传凭证图 → 创建 transaction → 列表看到缩略图

### 16.3 错误恢复
- [ ] 16.3.1 网络中断 → API 报错 → toast → 不崩溃
- [ ] 16.3.2 401 → 自动跳登录 → 重登 → 回到原页面（带 redirect param）
- [ ] 16.3.3 DB 锁 → API 返回 500 → 前端显示「服务异常」
- [ ] 16.3.4 缩略图加载失败 → 占位图 + 重试按钮

### 16.4 部署回归
- [ ] 16.4.1 部署到 VPS 后 `/api/frontend-version` 返回新版本
- [ ] 16.4.2 iOS 拉取新 zip → 覆盖成功 → 启动新版本
- [ ] 16.4.3 DB 迁移（`/api/migrate-recon`）前后数据一致
- [ ] 16.4.4 静态资源（dist/）部署后立即可用

---

## 附录 A · 项目硬规则

> 这些是**部署/数据/代码**的硬约束，新功能开发必须遵守。

### A.1 数据生命期
- **不**为旧数据写兼容回退（`thumb_images?.[i] || images[i]` 这种降级写法**禁止**）
- 直接用新字段，旧数据视为测试数据（如有需要另行处理）
- DB schema 变更必须用 Python `try/except` 逐列添加（**禁止** `executescript` 里 `ALTER TABLE`）

### A.2 i18n
- 新增字段必须**同时**在 zh-CN / zh-TW / en 三处加
- CI 检查 i18n key 完整性（如有）
- 缺失 key 降级显示 key 字面（不崩）

### A.3 JOIN
- `/api/partners` **必须** LEFT JOIN dividends 算 `total_dividends`
- 不做 JOIN 时前端 `reduce` 会得到 `NaN`（已发生过的 bug）

### A.4 构建
- 前端构建后必须 `python3 inject-css.py`，否则样式丢失
- 构建产物 `dist/` 不入 git

### A.5 部署（禁止改动相关配置除非明确授权）
- `.github/workflows/*.yml`
- GitHub Secrets / Environments
- ECS 服务单元
- nginx 反代
- CI 触发脚本
- 影响"代码 push → 自动部署"链路的任何配置

### A.6 iOS 自动更新
- `/api/frontend.zip` 必须保持最新
- 否则 iOS 端会拿到旧版

### A.7 鉴权双通道
- Session Cookie（网页同源）
- Bearer Token（iOS WKWebView 跨域）
- `login_required` 装饰器同时支持两种

### A.8 密码规则
- 最少 6 位
- 必须同时包含字母和数字
- 前端 + 后端双重校验

---

## 附录 B · 不在范围

- **iOS native 代码**（snail-books-ios 仓库）独立测试，由 ios-test 套件覆盖
- **邮件发送链路**（依赖外部 SMTP，需 mock 测试）
- **压测**（Locust / k6，需另开测试计划）
- **CI/CD 流水线**（GitHub Actions 配置）
- **第三方服务依赖**（支付/短信/对象存储）

---

## 附录 C · 改动历史

- **2026-06-02 v1.0 初版**：补缺 7 个专项未覆盖部分（transactions/daily-revenue/platform-fees/settings/users/SPA/stats/ops/HomeScreen/ExpenseHistoryScreen/i18n 字段表/perf/security/compat/E2E/烟雾/项目硬规则）

# 登录/注册/忘记密码 · 对账 · 对账记录 — 测试报告

**测试日期**: 2026-05-27  
**测试方法**: API 测试 (13 轮) + 源码审查 + 构建产物分析  
**测试范围**: `LoginScreen.tsx` / `ExpenseScreen.tsx` / `ReconHistoryScreen.tsx` / 后端 API

---

## Bug 清单

### B1 - 重置密码缺少确认密码字段 [高]

**文件**: `src/screens/LoginScreen.tsx:325-366`  
**描述**: 重置密码步骤（step='reset'）只要求输入验证码和新密码，没有确认密码（password2）字段。如果用户打错新密码，将无法用新密码登录。而注册步骤（step='register'）有 password2 确认。  
**建议**: 在 reset 步骤增加确认密码输入框和匹配校验。

---

### B2 - 对账提交后 Toast 无法显示 [中]

**文件**: `src/screens/ExpenseScreen.tsx:231-232`  
**描述**: `submitRecon` 成功后会依次调用 `setToast(t('reconComplete'))` 和 `onReconHistory?.()`。但 `onReconHistory` 触发父组件将当前页面替换为 `ReconHistoryScreen`，`ExpenseScreen` 被卸载，Toast 组件随之消失，用户看不到"对账完成"的成功提示。  
**建议**: 把 Toast 移到父组件 `HomeScreen` 中，或让 `onReconHistory` 延迟执行。

---

### B3 - 后端接受负数的对账金额 [中]

**文件**: `snail-books-backend/app.py:780-810`  
**描述**: `api_create_reconciliation` 对 `card_balance` 等金额字段不做范围校验，可以创建如 `card_balance: -100` 的非法记录。  
**建议**: 增加金额 ≥ 0 校验。

---

### B4 - 后端对账仅校验 `date`，其余字段缺失静默补 0 [中]

**文件**: `snail-books-backend/app.py:777`  
**描述**: 提交对账时只校验 `date` 必填，`card_balance`、`cash_balance` 等字段缺失时默认补 0。如果前端 bug 导致这些字段未传，会静默创建一条全 0 的对账记录（实际测试已触发此问题）。  
**建议**: 至少校验核心金额字段存在，或在前端做预校验。

---

### B5 - `validate_required` 将 `0` 当作缺失 [中]

**文件**: `snail-books-backend/app.py:325`  
**描述**: 与之前合作人页面报告相同的问题。`not data.get(f)` 导致所有合法 0 值被当作"缺失必填字段"拒绝。影响 register 的 email 字段（如果 email key 存在但值为空字符串也会被拦截，但这里空字符串其实也应拦截），更关键的是对账接口中 `card_balance=0` 的场景。当前对账没受影响（因为对账没调用 validate_required 对所有字段校验），但 `reset-password` 的 code=0 的情况理论上不应发生（验证码从不会是 0），所以实际影响有限。  
**建议**: 改为 `data.get(f) is None`。

---

### B6 - `handleResend` 不检查 email 是否为空 [低]

**文件**: `src/screens/LoginScreen.tsx:109-116`  
**描述**: 重发验证码时直接调用 `api.resendCode(email)`，如果 email 状态为空字符串（比如从注册步骤异常跳转过来），会向后端发送空邮箱请求。  
**建议**: 添加 `if (!email) return;` 守卫。

---

### B7 - `handleVerify` 不检查 email 是否为空 [低]

**文件**: `src/screens/LoginScreen.tsx:86-91`  
**描述**: 验证邮箱时不检查 email 是否有值，与 B6 类似。  
**建议**: 同上。

---

### B8 - 注册 Tab 切换时清空用户名设计不一致 [低]

**文件**: `src/screens/LoginScreen.tsx:41-44`  
**描述**: 点击注册 Tab 时清空 `username`（避免带入已保存的登录用户名），但从验证/忘记密码步骤回到登录时又恢复已保存的用户名。这种不一致可能导致用户在注册时手动输入用户名后切 Tab 再切回来，之前输入的用户名丢失。  
**建议**: 注册 Tab 不清空用户名，或仅在首次进入时清空。

---

### B9 - 对账：同一日期自动 upsert，静默覆盖 [低]

**文件**: `snail-books-backend/app.py:795-809`  
**描述**: 对同一天（相同 user_id + bill_date）重复对账会静默覆盖原记录，无任何提示或确认。用户可能无意间覆盖正确的历史对账数据。  
**建议**: API 返回 `updated` vs `created` 标记，前端显示不同提示。

---

### B10 - `fmtDate` 无繁体中文日期格式 [低]

**文件**: `src/screens/ReconHistoryScreen.tsx:77-82`、`ExpenseScreen.tsx:362-371`  
**描述**: 日期格式化只有英文分支，中文简繁共用同一格式。繁体中文用户看到的是简体风格日期。  
**建议**: 增加 `zh-TW` 格式分支。

---

### B11 - 对账页面营业额数据不刷新 [低]

**文件**: `src/screens/ExpenseScreen.tsx:244-252`  
**描述**: `loadRevenue` 仅在组件挂载时调用一次。切换到其他 Tab 再切回来，或新增收入交易后，KPI 数据不更新。  
**建议**: 在 `activeTab === 1` 切换时触发刷新，或加入依赖刷新。

---

### B12 - 轮播 Tab 卡片宽度硬编码 310px [低]

**文件**: `src/screens/ExpenseScreen.tsx:129, 146`  
**描述**: snap 滚动和切换逻辑硬编码 `310`（卡片宽度）。不同屏幕宽度下，卡片实际宽度由 `calc(100vw - 61px)` 动态计算，310 可能与实际宽度不匹配，导致 snap 定位不准。  
**建议**: 动态读取卡片实际宽度。

---

## API 测试结果

| # | 请求 | 状态码 | 结果 |
|---|------|--------|------|
| 1 | `POST /login` 正确凭证 | 200 | ok，返回 token |
| 2 | `POST /login` 错误密码 | 200 | error，消息"用户名或密码错误" |
| 3 | `POST /login` 空字段 | 200 | error，消息"用户名和密码不能为空" |
| 4 | `POST /register` 弱密码 | 200 | error，消息"密码至少 6 位" |
| 5 | `POST /register` 重复用户名 | 200 | error，消息"用户名已存在" |
| 6 | `POST /forgot-password` 不存在邮箱 | 200 | ok（防枚举，但前端根据 status=ok 跳转了） |
| 7 | `POST /forgot-password` 空邮箱 | 200 | error，消息"请输入邮箱" |
| 8 | `POST /verify` 错误验证码 | 200 | error |
| 9 | `POST /reset-password` 错误验证码 | 200 | error |
| 10 | `POST /api/reconciliations` 正常数据 | 201 | ok，正确计算 channel_total/real_total/diff |
| 11 | `POST /api/reconciliations` 重复 bill_date | 201 | upsert 覆盖（**B9**） |
| 12 | `POST /api/reconciliations` 仅传 date | 201 | 创建全 0 记录（**B4**） |
| 13 | `POST /api/reconciliations` 负金额 | 201 | 接受（**B3**） |
| 14 | `GET /api/reconciliations` | 200 | 正常返回数据 |
| 15 | `GET /api/users` | 200 | 正常返回用户列表 |

---

## 汇总

| 级别 | 数量 | 编号 |
|------|------|------|
| 高 | 1 | B1 |
| 中 | 4 | B2, B3, B4, B5 |
| 低 | 7 | B6, B7, B8, B9, B10, B11, B12 |

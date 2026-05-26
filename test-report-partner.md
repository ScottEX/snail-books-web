# 合伙人页面测试报告

**测试日期**: 2026-05-27  
**测试范围**: `src/screens/PartnerScreen.tsx` + `src/i18n.ts` + `src/api/client.ts` + 后端 API  
**测试方法**: API 测试 (7 轮) + 源码审查 + 构建产物分析

---

## Bug 清单

### B1 - `partnerShare` 使用 `||` 导致 0% 持股错误回退 [中]

**文件**: `src/screens/PartnerScreen.tsx:92, 103, 327`  
**描述**: `partnerShare[p.name] || 0.33` 使用 `||` 运算符，当某合伙人持股比例为 0 时（合法值），会被视为 falsy 而错误地回退到 33%。  
**建议**: 改为 `partnerShare[p.name] ?? 0.33`

---

### B2 - `initCapital` 回退值不一致 [中]

**文件**: `src/screens/PartnerScreen.tsx:203 vs 408, 412`  
**描述**: 
- 合伙人卡片 (line 203): `initCapital[p.name] || 42900`
- 详情弹窗初始出资 (line 408): `initCapital[showDetail.name] || 0`
- 详情弹窗追加计算 (line 412): `initCapital[showDetail.name] || 0`

同一个合伙人的"初始出资"，卡片显示 ¥42,900，弹窗显示 ¥0，"追加"在弹窗中会变成 `investment - 0`，与卡片数据矛盾。  
**建议**: 统一回退值，两边都用同一个默认值。

---

### B3 - `handleDividend` 无错误处理 [中]

**文件**: `src/screens/PartnerScreen.tsx:98-110`  
**描述**: `api.createDividend` 调用没有 try/catch。请求失败时弹窗照常关闭，用户不会收到任何错误提示，数据也不会被刷新。  
**建议**: 包裹 try/catch，失败时显示 toast。

---

### B4 - `handleDelete` 部分失败静默忽略 [低]

**文件**: `src/screens/PartnerScreen.tsx:116-118`  
**描述**: 循环逐条删除 dividend 时，如果某条删除失败，不会中断也不会提示用户，其余条目继续删除，最后调用 `loadData()` 覆盖状态。用户无法知道哪些记录未成功删除。  
**建议**: 收集失败记录，全部完成后统一提示。

---

### B5 - 后端接受负数分红金额 [中]

**文件**: `snail-books-backend/app.py:325, 522`  
**描述**: `validate_required` 使用 `not data.get(f)` 判断，只检查 truthy 值。`-100` 是 truthy，可以成功创建负数分红记录。  
**建议**: 在 dividend 创建时增加 `amount > 0` 校验。

---

### B6 - `validate_required` 将 `0` 视为缺失字段 [低]

**文件**: `snail-books-backend/app.py:325`  
**描述**: `not data.get(f)` 将 `0` 视为 falsy，导致合法的零值被当作"缺少必填字段"拒绝。影响 `/api/dividends` (amount=0) 和 `/api/partners` (share=0, investment=0)。  
**建议**: 改为 `data.get(f) is None` 或 `f not in data`。

---

### B7 - DELETE 不存在的 dividend 返回 200 而非 404 [低]

**文件**: `snail-books-backend/app.py:534-538`  
**描述**: `DELETE /api/dividends/:id` 即使 id 不存在也返回 `{"status":"ok"}` 200。无法区分"删除成功"和"id 不存在"。  
**建议**: 检查 `db.execute` 影响行数，0 行时返回 404。

---

## 非 Bug 但值得关注

### N1 - `langs` 导入未使用

**文件**: `src/screens/PartnerScreen.tsx:4`  
`langs` 从 i18n 导入但页面没有语言切换按钮，`switchLang` 函数也未绑定 UI。

### N2 - `getPartnerHistory` 冗余 fallback

**文件**: `src/screens/PartnerScreen.tsx:135`  
`note || d.note` 中 `note` 来自 grouped 的 key（已做 `|| '---'` 处理），永远为 truthy，`|| d.note` 是死代码。

### N3 - 合伙人数据硬编码

**文件**: `src/screens/PartnerScreen.tsx:8-10`  
`partnerShare`、`initCapital`、`nameMap` 硬编码中文名。如果后端合伙人数据变更（增减、改名），前端映射全部失效，回退到不准确的默认值。

### N4 - 详情弹窗 grid 宽度用魔法数字

**文件**: `src/screens/PartnerScreen.tsx:658`  
`width: '47%' as any` 在窄屏可能不对齐。

---

## API 测试结果

| # | 请求 | 状态码 | 结果 |
|---|------|--------|------|
| 1 | `GET /api/partners` | 200 | 3 条合伙人，字段正确 |
| 2 | `GET /api/dividends` | 200 | 空数组 → 正常 |
| 3 | `POST /api/dividends` (正常数据) | 200 | 3 条记录创建成功，partner total_dividends 正确更新 |
| 4 | `POST /api/dividends` (缺少 partner) | 400 | 正确拒绝 |
| 5 | `POST /api/dividends` (空 items) | 200 | 接受空数组 |
| 6 | `POST /api/dividends` (负数金额) | 200 | **Bug B5** - 接受了 -100 |
| 7 | `POST /api/dividends` (零金额) | 400 | **Bug B6** - 拒绝 ¥0 |
| 8 | `POST /api/dividends` (大额) | 200 | ¥999,999,999 正常 |
| 9 | `DELETE /api/dividends/:id` (存在) | 200 | 成功删除 |
| 10 | `DELETE /api/dividends/:id` (不存在) | 200 | **Bug B7** - 应返回 404 |
| 11 | `PUT /api/partners/:id` (正常值) | 200 | 更新成功 |
| 12 | `PUT /api/partners/:id` (零值) | 400 | **Bug B6** - 拒绝合法零值 |

---

## 汇总

| 级别 | 数量 |
|------|------|
| Bug (中) | 4 |
| Bug (低) | 3 |
| 建议改进 | 4 |

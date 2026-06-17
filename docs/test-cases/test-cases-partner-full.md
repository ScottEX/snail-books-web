# 合伙人页面 - 测试用例

> 对应文件：`src/screens/PartnerScreen.tsx`、`src/i18n.ts`、`src/api/client.ts`

---

## 一、页面加载

### TC1.1 正常加载
- 进入页面 → 调用 `GET /api/partners`、`GET /api/dividends`
- 合伙人卡片渲染，数量与 API 返回一致
- 分红池总额 = 所有 dividend.amount 之和
- 流水表按 `note` 分组渲染

### TC1.2 接口返回空数据
- partners 返回 `[]` → 合伙人卡片区为空
- dividends 返回 `[]` → 分红池显示 ¥0，流水表无分红分组，仅显示出资/追加组

### TC1.3 接口异常
- partners 接口 500 → Toast 显示"数据加载失败"
- dividends 接口 500 → Toast 显示"数据加载失败"

### TC1.4 未登录/401
- 任一接口返回 401 → 清除 localStorage user，跳转到 /login

---

## 二、页面头部

### TC2.1 标题
- 红色竖条（8×36，中国红 #8B1E22）
- 主标题：`t('partnerTitle')`，字号 17，字重 600
- 副标题英文不变：`Lan's Luosifen · Partner Capital`

---

## 三、三张统计卡片

### TC3.1 合伙初始基金总额
- 图标：Building SVG（18×18，颜色 #8B1E22，背景 rgba(139,30,34,0.08)）
- 标签：`t('totalCapital')`
- 数值：¥130,000（硬编码）
- 底部绿色文字：`t('paidInRate')` 100%

### TC3.2 已派发分红池
- 图标：Coins SVG（颜色 #F59E0B，背景 #FFFBEB）
- 标签：`t('distributedPool')`
- 数值：`totalDiv.toLocaleString()`，黄色 #D97706
- 底部副标题：`t('cumulativeByShare')`
- 右侧按钮：`t('issueDividend')`，点击打开分红弹窗

### TC3.3 合伙席位（可点击）
- 图标：People SVG（颜色 #6B7280，背景 #F3F4F6）
- 标签：`t('partnerSeats')`
- 数值：`3 {t('shareholders')}`（硬编码 3）
- 底部副标题：`t('lpStructure')`
- 点击 → 打开组织架构弹窗

---

## 四、合伙人卡片

### TC4.1 卡片基本信息
- 每个卡片显示：姓名（翻译后）、持股百分比
- 右上角绿色徽章：`t('investComplete')`

### TC4.2 出资数据行
- 三列：认缴总额 / 初始 / 追加
- 认缴总额 = `p.investment`（API 返回）
- 初始 = `initCapital[name]`（硬编码映射，无映射默认 42900）
- 追加 = `investment - initCapital`

### TC4.3 分红底部栏
- 累计分红（黄色 #D97706）：`p.total_dividends`
- 回本率：`dividends / investment * 100`，取整百分比
- 投资为 0 时回本率显示 0
- 已回本 → 绿色文字 `t('fullyPaidBack')`
- 未回本 → 黄色文字 `t('pendingPayback')` + 剩余金额

### TC4.4 点击卡片
- 打开该合伙人的详情弹窗

---

## 五、资本账目流水表

### TC5.1 筛选按钮
- 四个胶囊按钮：全部 / 出资 / 追加 / 分红
- 选中按钮：黑色背景 `#1F2937`，白色文字
- 未选中按钮：灰色背景 `#F3F4F6`，灰色文字 `#6B7280`

### TC5.2 筛选 - "全部"
- 显示：初始出资组 + 追加投资组 + 所有分红组

### TC5.3 筛选 - "出资"
- 仅显示 2024年4月初始出资组
- 表头：蓝色点 · 标题 + 总额 ¥130,000
- 三行：张安武 34% ¥44,200 / 蓝柳富 33% ¥42,900 / 江宽 33% ¥42,900

### TC5.4 筛选 - "追加"
- 仅显示 2025年1月追加投资组
- 表头：紫色点 · 标题 + 总额 ¥30,162
- 三行对应金额：10255.08 / 9953.46 / 9953.46

### TC5.5 筛选 - "分红"
- 仅显示所有分红组
- 每组表头：黄色点 #F59E0B · 分红轮次名称 + 总额
- 每组右侧有红色"删除"按钮
- 金额颜色黄色 #D97706

### TC5.6 分红轮次名称翻译
- 格式 `第{n}次分红 ({date})` → `dividendRoundFmt` 翻译
- 中文环境下保持中文格式
- 英文下显示 `Dividend #{n} ({date})`
- 不匹配格式的 note 原样显示

---

## 六、分红弹窗

### TC6.1 打开弹窗
- 点击统计卡"发起分红"按钮或分红池卡右侧按钮
- 红色顶栏（#8B1E22）：标题 `t('issueProportional')` + 副标题 `t('autoByShare')`
- 右上角关闭按钮 "✕"

### TC6.2 输入与预览
- 金额输入框：placeholder `t('enterAmount')`，数字键盘
- 备注输入框：placeholder `t('roundNoteExample')`
- 输入金额后实时计算预览：
  - 张安武 34% → `金额 * 0.34`
  - 江宽 33% → `金额 * 0.33`
  - 蓝柳富 33% → `金额 * 0.33`
- 金额为 0 或空时预览每人显示 ¥0.00
- 金额包含小数时保留 2 位

### TC6.3 提交分红
- 点击 `t('confirmIssue')` → POST `/api/dividends`
- 请求体：`{ items: [{ partner, amount, note }] }`
- 成功后关闭弹窗、清空输入、刷新数据

### TC6.4 空金额提交
- 金额为空时点击确认 → 不调用 API，弹窗不关闭

### TC6.5 取消
- 点击"取消"按钮 → 关闭弹窗
- 点击遮罩层 → 关闭弹窗

### TC6.6 非法输入
- 输入非数字字符 → 预览金额为 NaN（应显示 0）

---

## 七、删除确认弹窗

### TC7.1 打开弹窗
- 流水表中点击某分红组的"删除"按钮
- 红色顶栏：标题 `t('confirmDeleteRecord')` + 副标题 `t('irreversible')`
- 红色警告框（#FEF2F2）：`将删除「{分红轮次名}」的所有分红记录`

### TC7.2 确认删除
- 点击红色确认按钮 → 删除该 note 下所有 dividend（逐条 DELETE）
- 成功后关闭弹窗、刷新数据

### TC7.3 取消删除
- 点击"取消" → 关闭弹窗，数据不变
- 点击遮罩层 → 关闭弹窗

---

## 八、合伙人详情弹窗

### TC8.1 打开弹窗
- 点击合伙人卡片
- 红色顶栏：合伙人姓名（翻译后）+ 职务·持股 xx%
- 职务映射：张安武→董事长、江宽→CEO、蓝柳富→打杂

### TC8.2 数据网格（2×2）
- 总出资（灰底 #F9FAFB）：`p.investment`
- 累计分红（黄底 #FFFBEB）：`p.total_dividends`
- 初始出资（灰底）：`initCapital[name]`
- 追加（灰底）：`investment - initCapital`

### TC8.3 回本进度条
- 仅在 `investment > 0` 时显示
- 左侧：`t('paybackProgress')`，右侧：`回本率 xx%`
- 进度条宽度 = `dividends / investment * 100`，上限 100%
- 已回本：绿色 #059669
- 未回本：黄色 #D97706
- 进度条下方：已回本显示绿色文字，未回本显示黄色待回金额

### TC8.4 分红历史列表
- 标题：`t('dividendHistory')`
- 列出该合伙人的每次分红记录（note + amount）
- 黄底行（`rgba(255,251,235,0.4)`），圆角 8
- 金额黄色 #D97706
- 无分红记录时显示 `t('noDividendRecords')`，居中灰色

### TC8.5 关闭
- 点击关闭按钮或遮罩层 → 关闭弹窗

---

## 九、组织架构弹窗

### TC9.1 打开弹窗
- 点击合伙席位统计卡
- 红色顶栏：标题 `t('partnerStructure')` + 副标题 `t('lpControl')`

### TC9.2 三级竖排结构
- 第一级：董事长（红色名字 #8B1E22）· 34%
- 竖线分隔
- 第二级：CEO · 33%
- 竖线分隔
- 第三级：打杂 · 33%
- 节点卡片：灰底 `#F9FAFB`，边框 `#E5E7EB`，圆角 12

### TC9.3 底部文字
- `t('jokeClosedLoop')`
- 灰色 #9CA3AF，居中，字号 10

### TC9.4 关闭
- 点击关闭按钮或遮罩层 → 关闭弹窗

---

## 十、多语言（三语切换）

### TC10.1 简体中文（zh-CN）
- 页面标题：柳味探秘合伙人资产
- 统计卡标签全部中文简体
- 合伙人姓名：张安武、江宽、蓝柳富
- 筛选：全部/出资/追加/分红
- 职务：董事长/CEO/打杂
- 俏皮话完整中文

### TC10.2 繁體中文（zh-TW）
- 页面标题：藍姐螺螄粉合夥人資產
- 姓名：張安武、江寬、藍柳富
- 职务：董事長/CEO/打雜

### TC10.3 English（en）
- 页面标题：Lan's Luosifen · Partner Capital
- 姓名拼音：Zhang Anwu, Jiang Kuan, Lan Liufu
- 分红轮次：Dividend #5 (2026/2/9)
- 职务：Chairman/CEO/Helper

---

## 十一、边界与异常

### TC11.1 投资额为 0
- 回本率显示 0%
- 不显示回本进度条

### TC11.2 分红超过投资（已完全回本）
- 卡片显示绿色"已回本 ✓"
- 进度条 100%，绿色
- 不再显示待回金额

### TC11.3 大额金额
- 金额 >= 1,000,000 → `toLocaleString()` 正确加千分位

### TC11.4 并发删除
- 快速连续点击删除按钮 → 不会重复发送请求（当前未防抖，可能存在风险）

### TC11.5 分红备注为空
- 自动生成：`第{groupKeys.length + 1}次分红`

### TC11.6 同名合伙人处理
- 同一 note 下同一合伙人可有多条记录 → 详情弹窗分红历史均列出

---

## 十二、API 测试矩阵

| # | 请求 | 预期 |
|---|------|------|
| 1 | `GET /api/partners` | 200，返回数组，字段含 id/name/share/investment/status |
| 2 | `GET /api/dividends` | 200，返回数组，字段含 id/partner/amount/note/created_at |
| 3 | `POST /api/dividends` | 201，body `{items:[{partner,amount,note}]}`，创建成功后 GET 可查到 |
| 4 | `DELETE /api/dividends/:id` | 204，删除后 GET 不再返回该记录 |
| 5 | 登录 → partners → dividends → 注销 | 全流程 200/302 |

# Snail-Books-Web 重构续篇（REFACTOR 验收 + 剩余项方案）

> **本文是 `docs/REFACTOR.md` 的续篇**  
> 上次审计 11 项，本次验收后剩 **7 项值得做**  
> 验收日期：2026-06-14  
> 验收方法：grep 候选 → 逐项 read_file 全代码 → 抽样验证，**不只看文档建议**

---

## 一、TL;DR

### 验收总览

| 项 | 文档原建议 | 实际完成情况 | 验收结论 |
|---|---|---|---|
| **P0-1** avatar 抽公共 | 6 处去重 | 5/6 替换，**LoginScreen 3 处漏（含 background）** | ⚠️ 收尾 |
| **P0-2** admin 入 api/client | 4 endpoint | 4 endpoint + 4 调用换了，**UserDetailScreen 6 处漏** | ⚠️ 收尾 |
| **P0-3** ExpenseScreen state 重构 | 30→集中 | useDisclosure 用了 4 处，**useDateField 写了不用**，**表单未合并** | ⚠️ 部分 |
| **P0-4** usePaginatedList 推广 | HomeScreen 用 useTransactionList | **HomeScreen 无分页 UI**，useHomeData 有 40 行死代码 | ⚠️ **建议本身有问题** |
| **P1-1** ProfileScreen 大拆 | 4 新 hook | 抽了 useSignatureForm/useAvatarCrop/useCoverCrop，**useChangePassword/Email 没拆** | ⚠️ 部分 |
| **P1-2** HomeScreen 大拆 | 3 新 hook | 抽了 useHomeData/useNavigationStack，**8 useEffect 一个没拆** | ⚠️ 部分 |
| **P1-3** TextField 组件 | 5+ 文件用 | 3 处用了，**LoginScreen 10 个没换** | ⚠️ 收尾 |
| **P1-4** 抽统一 Button | 234 处 | **完全没做**，实际 368 处但主操作 < 5% | ❌ **不建议**（价值高估） |
| **P1-5** useAsyncResource | 5+ 文件用 | 46 行 hook 建好，**0 处调用** | ⚠️ 落地 |
| **P2-1** sharedStyles 扩展 | 5 个新样式 | **完全没做**，3/5 样式没人写 | ⚠️ **只抽 2 个** |
| **P2-2** confirm util | Alert.alert 41 次 | **Alert.alert 全代码库 0 次**，ConfirmModal 已用 8 处 | ✅ **已完成**（数据错） |

### 推荐执行（按价值/工作量比）

| 序 | 项 | 工作量 | 风险 | 收益 | 备注 |
|---|---|---|---|---|---|
| 1 | ① P0-3 落地 useDateField | 1h | 低 | 中-高 | 沉没成本，行为不变 |
| 2 | ② P0-2 收尾 UserDetailScreen | 2h | **中** | 高 | admin 删/恢复，**必测** |
| 3 | ③ P0-1 收尾 LoginScreen | 1h | 低 | 中 | 扩 2 个 client 方法 |
| 4 | ④ P2-1 抽 card + sectionTitle | 1-2h | 极低 | 低 | 纯样式，**先保视觉一致** |
| 5 | ⑤ P1-5 落地 useAsyncResource | 半天 | 中 | 中 | **只动 2 文件的简单 GET** |
| 6 | ⑥ P0-3 表单合并 | 2h | 中-高 | 中 | 字段多，**必测** |
| 7 | ⑦ P1-3 LoginScreen TextField | 半天 | 中 | 中 | 暗色样式兼容需验证 |

**最高优先级**：① + ③（沉没成本回收 + 行为不变）  
**最需小心**：② + ⑥（admin 删/恢复、对账提交，关键流程）

---

## 二、验收时发现的关键问题（4 项不做）

### ⚠️ P0-4 usePaginatedList 推广 · 建议本身有问题

**文档建议**（REFACTOR.md P0-4 节）：
> 只有 HomeScreen.tsx 是真正候选……建议命名：useTransactionList() 内部用 usePaginatedList

**实测**：
```bash
grep "handlePage\("      src/screens/HomeScreen.tsx  → 0 处
grep "transactions\.map" src/screens/HomeScreen.tsx  → 0 处
grep "setPage\("         src/screens/HomeScreen.tsx  → 0 处
```

**useHomeData 暴露的 4 个分页相关返回**（`transactions/page/pages/handlePage`）**全是死代码**——HomeScreen 不渲染 transactions 列表，也无翻页按钮。

**根因**：
- usePaginatedList 的 API 是「**无限滚动累积**」模式（`onEndReached`/`handleScroll` + `hasMore` + `records` 累积）
- HomeScreen 的设计是「**交易列表嵌在 ScrollView 内**」，既不是滚动加载，也不是点击翻页
- 强行套 usePaginatedList 会**改产品交互**

**正确做法**：
- 先决定 useHomeData 那 40 行死代码**删还是补 UI**——这是**产品决策**不是重构决策
- **不要**为了"用上 usePaginatedList"硬把 HomeScreen 改成滚动加载

### ⚠️ P1-4 抽统一 Button · 价值高估 4-5 倍

**文档建议**（REFACTOR.md P1-4 节）：
> 234 处 TouchableOpacity 主操作按钮应统一

**实测**：
- 实际总数 **368 处**（已比审计时增长 55%）
- 抽样 `ProcurementScreen` 60 个 TouchableOpacity 中：
  - 主操作按钮（saveBtn/submitBtn/deleteBtn/confirmBtn 命名规范）：**仅 1 个**（L1332 submitBtn）
  - 其余 59 个是 chip/tab/+−/卡片/icon 等子项交互
- 全代码库主操作按钮精确搜（`styles.{saveBtn|submitBtn|deleteBtn|confirmBtn|...}`）：**仅 3 处**

**真正可抽的"主操作按钮" < 30 处**，节省 < 80 行——**撑不起一个新组件的维护成本**。

### ⚠️ P2-1 sharedStyles 扩展 · 3/5 凭空想象

**实测**（grep 各种样式在 screens 里的散落数）：

| 样式 | 散落数 | 评估 |
|---|---|---|
| `card: {` | 9 | ✅ 值得抽（但实际差异大，2-3 个真相似） |
| `sectionTitle: {` | 4 | ✅ 值得抽（2-3 个真相似） |
| `formRow: {` | **0** | ❌ 没人写 |
| `emptyHint: {` | **0** | ❌ 没人写 |
| `divider: {` | 2 | ❌ 边缘，可不抽 |

**结论**：只抽 card + sectionTitle 两个即可，其他三个**做了等于增加维护负担**。

### ✅ P2-2 confirm util · 已完成（文档数据错）

**文档建议**（REFACTOR.md P2-2 节）：
> Alert.alert(..., [{text, onPress}]) × 41 次散落

**实测**：
```bash
grep -rn "Alert\.alert" src/   →  0 处
grep -rn "ConfirmModal"  src/   →  8 处
```

**整段建议基于错误数据**：
- ❌ "Alert.alert 41 次" — **实际全代码库 0 次**
- ✅ 开发**早就在用 ConfirmModal**（8 处）替代 Alert.alert
- ✅ ConfirmModal 能力比 `confirm.ts` 强（支持 `loading` / `confirmColor` / `headerColor`）

**结论**：**P2-2 不需要做**。

---

## 三、7 项详细修复方案

> 每项含：目标 · 改动清单（文件:行号）· 关键 diff · 验证点

### ① P0-3 落地 useDateField（1h · 价值最高）

**目标**：把 `useDateField` hook 实际用起来。已建（43 行）但 0 调用——纯沉没成本。

**改动清单**（`src/screens/ExpenseScreen.tsx`）：

| 行 | 当前 | 改成 |
|---|---|---|
| L159-162 | 4 个独立 state（recDate/recDateKey/recDateErr + 自动填充 useEffect） | 1 个 `useDateField({sd, initial: ''})` |
| L160 | `useEffect(() => { if (sd.ready && recDate === '') setRecDate(sd.yesterday); }, ...)` | **删**（hook 内部已有） |
| L280-282 | 3 个独立 state（feeEntryDate/feeDateErr + 自动填充 useEffect） | 1 个 `useDateField({sd, initial: sd.today})` |
| L281 | `useEffect(() => { if (sd.ready && feeEntryDate === '') setFeeEntryDate(sd.today); }, ...)` | **删** |
| L665-685 | `DatePicker date={recDate} onChange={setRecDate} onFutureDate={() => setRecDateErr(c => c + 1)}` | `date={recDate.value} onChange={recDate.setValue} onFutureDate={() => recDate.setError(Date.now())}` |
| L913-923 | `DatePicker date={feeEntryDate} onChange={setFeeEntryDate} onFutureDate={() => setFeeDateErr(c => c + 1)}` | 同上 |
| L685 | `<DateErrorHint trigger={recDateErr} ...>` | `trigger={recDate.error}` |
| L923 | `<DateErrorHint trigger={feeDateErr} ...>` | `trigger={feeDate.error}` |

**关键 diff**：

```tsx
// 改前（L159-162, L280-282）
const [recDate, setRecDate] = useState('');
useEffect(() => { if (sd.ready && recDate === '') setRecDate(sd.yesterday); }, [sd.ready, sd.yesterday, recDate]);
const [recDateKey, setRecDateKey] = useState(0);
const [recDateErr, setRecDateErr] = useState(0);
const [feeEntryDate, setFeeEntryDate] = useState('');
useEffect(() => { if (sd.ready && feeEntryDate === '') setFeeEntryDate(sd.today); }, [sd.ready, sd.today, feeEntryDate]);
const [feeDateErr, setFeeDateErr] = useState(0);

// 改后
const recDate = useDateField({ sd, initial: '' });
const feeDate = useDateField({ sd, initial: sd.today });
// L160 / L281 useEffect 整段删
// L162 / L282 独立 state 删（被 hook 接管）
// key={recDateKey} → key={recDate.key}
```

**验证点**：
- [ ] 进入对账 tab：recDate 默认填昨天
- [ ] 选未来日期：触发 errDateFuture 提示
- [ ] 切到平台费 tab：feeDate 默认填今天
- [ ] 提交对账：日期校验 `sd.isFuture(recDate.value)` 仍正常

---

### ② P0-2 收尾 UserDetailScreen（2h · admin 安全敏感）

**目标**：6 处 raw admin fetch 改走 `api.admin.*`。

**步骤 1**：扩 `src/api/client.ts` L365-374：

```ts
admin: {
  check: () => authFetch('/api/admin/check'),
  getUnreviewedCount: () => authFetch('/api/admin/users/unreviewed-count'),
  markReviewed: (userId?: number) =>
    authFetch('/api/admin/users/mark-reviewed', {
      method: 'POST',
      ...(userId != null ? { body: JSON.stringify({ user_id: userId }) } : {}),
    }),
  getMe: () => authFetch('/api/users/me'),
  // ↓ 新增 4 个
  getUser: (id: number | string) => authFetch(`/api/admin/users/${id}`),
  updateUser: (id: number | string, body: Record<string, any>) =>
    authFetch(`/api/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteUser: (id: number | string) => authFetch(`/api/admin/users/${id}`, { method: 'DELETE' }),
  restoreUser: (id: number | string) => authFetch(`/api/admin/users/${id}/restore`, { method: 'POST' }),
},
```

**步骤 2**：改 `src/screens/UserDetailScreen.tsx`：

| 行 | 改前 | 改后 |
|---|---|---|
| L129 | `const resp = await fetch(\`/api/admin/users/${user.id}\`, { credentials: 'include', headers: { 'X-Lang': lang } })` | `const resp = await api.admin.getUser(user.id)` |
| L152-157 | `fetch(..., { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-Lang': lang }, body: JSON.stringify(body) })` | `const resp = await api.admin.updateUser(user.id, body)` |
| L178-182 | `fetch(..., { method: 'DELETE', credentials: 'include', headers: { 'X-Lang': lang } })` | `const resp = await api.admin.deleteUser(user.id)` |
| L204-208 | `fetch(\`/api/admin/users/${user.id}/restore\`, { method: 'POST', credentials: 'include', headers: { 'X-Lang': lang } })` | `const resp = await api.admin.restoreUser(user.id)` |

```tsx
// 改后 fetchDetail（L126-143）
const fetchDetail = useCallback(async () => {
  setLoading(true);
  try {
    const resp = await api.admin.getUser(user.id);  // ← 改这一行
    if (resp.ok) {
      const d = (await resp.json()).data;
      // ... 后面的 setX 不变
    }
  } catch {}
  setLoading(false);
}, [user.id]);

// L147-161 saveField 改后
const saveField = useCallback(async (field, value) => {
  setSaving(true);
  try {
    const body = { [field]: value };
    const resp = await api.admin.updateUser(user.id, body);  // ← 改这一行
    if (resp.ok && field === 'is_disabled') onUpdated();
  } catch {}
  setSaving(false);
}, [user.id, onUpdated]);
```

**验证点**：
- [ ] 进入用户详情页：数据正常加载
- [ ] 改 role/phone/email/is_disabled：保存成功
- [ ] 点删除：触发 ConfirmModal，确认后 schedule 出现
- [ ] 点恢复：恢复成功
- [ ] 自删除守卫仍工作（`isSelf` 检查）

---

### ③ P0-1 收尾 LoginScreen（1h · 含 background 路径）

**目标**：3 处 raw fetch（含 background）。

**关键问题**：现有 `getUserAvatar(userId)` 用 `user_id`，但 LoginScreen 用 `username` 或 `email` query。需扩展而非简单替换。

**步骤 1**：扩 `src/api/client.ts` L380-395：

```ts
/** 登录态用：根据 username 或 email 拉头像（与 getUserAvatar 区分） */
getUserAvatarByLogin: async (identifier: string): Promise<Blob | null> => {
  try {
    let resp = await fetch(API_BASE + `/api/users/avatar?username=${encodeURIComponent(identifier)}`);
    if (!resp.ok && identifier.includes('@')) {
      resp = await fetch(API_BASE + `/api/users/avatar?email=${encodeURIComponent(identifier)}`);
    }
    return resp.ok ? resp.blob() : null;
  } catch {
    return null;
  }
},

/** 登录态用：拉背景图 */
getUserBackground: async (identifier: string): Promise<Blob | null> => {
  try {
    const resp = await fetch(API_BASE + `/api/users/background?username=${encodeURIComponent(identifier)}`);
    return resp.ok ? resp.blob() : null;
  } catch {
    return null;
  }
},
```

**步骤 2**：改 `src/screens/LoginScreen.tsx` L80-111：

```tsx
// 改后（保持原 400ms debounce + blob 处理）
useEffect(() => {
  if (!username) { setAvatarUrl(''); setBgUrl(''); setBgReady(false); setAvatarReady(false); return; }
  setBgReady(false); setAvatarReady(false);
  const timer = setTimeout(async () => {
    // avatar
    try {
      const blob = await api.getUserAvatarByLogin(username);
      if (blob) {
        setAvatarUrl(URL.createObjectURL(blob));
        setAvatarReady(true);
      } else {
        setAvatarUrl(''); setAvatarReady(true);
      }
    } catch { setAvatarUrl(''); setAvatarReady(true); }

    // background
    try {
      const blob = await api.getUserBackground(username);
      if (blob) {
        setBgUrl(URL.createObjectURL(blob));
        setBgReady(true);
      } else {
        setBgUrl(''); setBgReady(true);
      }
    } catch { setBgUrl(''); setBgReady(true); }
  }, 400);
  return () => clearTimeout(timer);
}, [username]);
```

**验证点**：
- [ ] 登录页输入用户名（无 @）：头像/背景正常显示
- [ ] 输入邮箱：头像走 email fallback
- [ ] 输不存在用户：头像/背景置空、不报错
- [ ] 400ms debounce 仍正常（清空再输入不会闪）

---

### ④ P2-1 抽 card + sectionTitle（1-2h · 最低风险）

**目标**：9 个 card + 4 个 sectionTitle 中**真正相似**的抽到 `sharedStyles.ts`。

**步骤 1**：在 `src/sharedStyles.ts` 末尾追加：

```ts
// ─── 列表卡片（surface 背景 + 圆角 + padding） ──────────
/** 通用列表卡片：白底 + 圆角 14 + 内边距 14。Spread 进 StyleSheet.create()。 */
export const listCard = (colors: ThemeColors) => ({
  backgroundColor: colors.surface,
  borderRadius: 14,
  padding: 14,
});

/** 紧凑卡片：圆角 12 + 上下 padding 2-4（信息行类）。 */
export const tightCard = (colors: ThemeColors) => ({
  backgroundColor: colors.surface,
  borderRadius: 12,
  marginTop: 4,
  paddingVertical: 2,
});

// ─── Section Title（小标题） ──────────────────────
/** 区块小标题：textSub 色 + 半粗 + 上下间距。 */
export const sectionTitle = (colors: ThemeColors, opts?: { uppercase?: boolean; size?: number }) => ({
  fontSize: opts?.size ?? FONTS.microBold.size,
  fontWeight: FONTS.microBold.weight as any,
  color: colors.textSub,
  paddingVertical: 10,
  ...(opts?.uppercase ? { textTransform: 'uppercase' as any } : {}),
});
```

**步骤 2**：替换各文件中真正相似的 inline 定义：

| 文件:行 | 现状 | 改成 |
|---|---|---|
| `DailyRevenueHistory.tsx:347` | `card: { backgroundColor: colors.surface, borderRadius: 12, paddingVertical: 16, paddingHorizontal: 16 }` | `card: listCard(colors)`（或保留） |
| `ReconHistoryScreen.tsx:454` | `card: { backgroundColor: colors.surface, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: colors.secondary }` | `card: { ...listCard(colors), marginBottom: 12, borderWidth: 1, borderColor: colors.secondary }` |
| `ProfileScreen.tsx:966` | `card: { marginTop: 4, backgroundColor: colors.surface, borderRadius: 12, paddingHorizontal: 0, paddingVertical: 2 }` | `card: tightCard(colors)` |
| `UserDetailScreen.tsx:454` | 同上 | `card: tightCard(colors)` |
| `HomeScreen.tsx:929` | `sectionTitle: { fontSize: FONTS.microBold.size, ..., paddingVertical: 10 }` | `sectionTitle: sectionTitle(colors)` |
| `ProcurementDetailScreen.tsx:402` | 类似 | `sectionTitle: sectionTitle(colors)` |

**不要替换**（不是"列表卡片/小标题"模式）：

| 文件:行 | 不抽原因 |
|---|---|
| `ProfileScreen.tsx:1075` | Modal 容器（带 `modalCardAnimation`）— 走 modal 模式 |
| `ExpenseScreen.tsx:1266` | 内容卡片 + 自定义阴影 |
| `ExpenseSummaryCards.tsx:82` | Grid 卡片 `width: '48%'` — 布局特殊 |
| `PartnerScreen.tsx:1098` | 实际是 divider（`borderTopWidth: 1`），key 名撞了 |
| `ExpenseDetailScreen.tsx:585` | uppercase 版本 — 用 `sectionTitle(colors, {uppercase: true})` |

**验证点**：
- [ ] 6 个替换点的视觉与改前**像素级一致**
- [ ] 暗色主题下颜色正确（用 `colors` 注入）
- [ ] 没替换的 5 个文件没动

---

### ⑤ P1-5 落地 useAsyncResource（半天 · 4 文件只动 2）

**目标**：让 useAsyncResource 真的用起来。

**使用判断标准**：
- ✓ **适合**：数据是"独立缓存"（不需从外部组件读/写）
- ✗ **不适合**：数据需要被组件其他 state 操作（mutate 后重载）

**4 个文件分别建议**：

#### 5.1 `HomeScreen.tsx` — 跳过

`useHomeData` 内 L42 `useEffect(() => { loadData(); }, [loadData])` 中的 `loadData` 内部 `setSummary`/`setTransactions` 已被 5 个数据 state 接管，**全替换成本太高**。**跳过**。

#### 5.2 `UserManagementScreen.tsx`（5 useEffect）— 适合

`fetchUsers` 是经典"加载列表"模式：

```tsx
// 改前（约 L80-130）
const [users, setUsers] = useState<User[]>([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState('');
useEffect(() => { fetchUsers(); }, []);
const fetchUsers = async () => { /* try/catch + setLoading 三件套 */ };

// 改后
const { data: users, loading, error, reload: fetchUsers } = useAsyncResource<User[]>(
  () => api.getUsers(1, 100)  // 或对应方法
);
```

#### 5.3 `PdfPreviewPage.tsx` — 跳过

PDF 加载有 `pdfjs-dist` 特殊协议（worker/canvas），强行套 useAsyncResource 反而麻烦。**跳过**。

#### 5.4 `ProcurementScreen.tsx`（5 useEffect）— 部分适合

`loadProducts` / `loadSuppliers` 是简单 GET，**适合**；`loadCart` 涉及本地状态，**不适合**。

```tsx
// 改后（仅简单 GET 替换）
const productsRes = useAsyncResource(() => api.getProducts());
const products = productsRes.data ?? [];
```

**建议**：只动 UserManagementScreen + ProcurementScreen 的 2-3 个简单 GET，省 30-50 行 + 一致性收益。HomeScreen/PdfPreviewPage 跳过。

**验证点**：
- [ ] UserManagement 进页面：users 正常显示
- [ ] 切 filter：触发 reload，loading 态正确
- [ ] 网络失败：error 提示正常
- [ ] Procurement 产品列表正常加载

---

### ⑥ P0-3 收尾 ExpenseScreen 表单合并（2h · 字段多必测）

**目标**：7+4 字段合并为对象。

**步骤 1**：L165-171 替换为 `reconForm` 对象：

```tsx
// 改前
const [cardBalance, setCardBalance] = useState('');
const [cashBalance, setCashBalance] = useState('');
const [dineIn, setDineIn] = useState('');
const [meituan, setMeituan] = useState('');
const [flashSale, setFlashSale] = useState('');
const [tuan, setTuan] = useState('');
const [jd, setJd] = useState('');

// 改后
const [reconForm, setReconForm] = useState({
  cardBalance: '', cashBalance: '', dineIn: '', meituan: '',
  flashSale: '', tuan: '', jd: '',
});
const updateRecon = (k: keyof typeof reconForm, v: string) =>
  setReconForm(f => ({ ...f, [k]: v }));
// 用法：onChangeText={v => updateRecon('cardBalance', v)}
// 值：reconForm.cardBalance 等
```

**步骤 2**：L283-286 合并 `feeForm`：

```tsx
const [feeForm, setFeeForm] = useState({ feeMc: '', feeMw: '', feeEw: '', feeMt: '' });
const updateFee = (k: keyof typeof feeForm, v: string) =>
  setFeeForm(f => ({ ...f, [k]: v }));
```

**步骤 3**：全文件替换 `setCardBalance`/`setCashBalance`/...`setFeeMt` 所有调用（约 30+ 处）：
- `onChangeText={setCardBalance}` → `onChangeText={v => updateRecon('cardBalance', v)}`
- `toNum(cardBalance)` → `toNum(reconForm.cardBalance)`

**步骤 4**：`L228` 那个捕获初始值的 useEffect：

```tsx
// 改前
initReconValues.current = { card: cardBalance, cash: cashBalance, dine: dineIn, mt: meituan, fs: flashSale, jd, tuan };
// 改后（按字段名映射）
initReconValues.current = {
  card: reconForm.cardBalance,
  cash: reconForm.cashBalance,
  dine: reconForm.dineIn,
  mt: reconForm.meituan,
  fs: reconForm.flashSale,
  jd: reconForm.jd,
  tuan: reconForm.tuan,
};
```

**风险点**：
- `L190-217` 的 6 处 setX 重置（data.length === 0 / 找不到 match / 早于 last 三种 case）也要改成 `setReconForm(f => ({...f, cardBalance: '', ...}))`
- `L616` 的 `setFeeMc(''); setFeeMw(''); setFeeMw(''); setFeeEw(''); setFeeMt('')` → `setFeeForm({ feeMc: '', feeMw: '', feeEw: '', feeMt: '' })`
- L249 提交函数 `await api.createReconciliation({bill_date: recDate, card_balance: toNum(cardBalance), ...})` 的字段映射

**验证点**：
- [ ] 进入对账 tab：7 个字段加载正常（编辑历史记录或新建）
- [ ] 改任意字段：onChange 触发
- [ ] 提交对账：toNum 转换正确，后端保存
- [ ] initReconValues 初始值捕获仍生效（避免误判"未修改"）
- [ ] 三种 case（匹配历史/早于历史/无历史）都正确重置

---

### ⑦ P1-3 收尾 LoginScreen TextField（半天 · 暗色样式需验证）

**目标**：10 个 TextInput 改用 TextField。

**当前 TextField.tsx**（88 行）的 props：
`label, value, onChangeText, error?, placeholder?, secureTextEntry?, keyboardType?, multiline?, rightIcon?` — **够用**。

**难点分析**：

10 个 TextInput 实际分 3 个表单（登录/注册/重置），每个有不同形态：

| 行 | 用途 | 形态 |
|---|---|---|
| L325 | 登录 username | 普通 `textInput` |
| L340 | 登录 password | `pwInput` + 眼睛图标 |
| L385 | 注册 username | 普通 `textInput` |
| L398 | 注册 email | 普通 `textInput` + `keyboardType="email-address"` |
| L408 | 注册 password | `pwInput` + 眼睛图标 |
| L432 | 注册 password2 | `pwInput` + 眼睛图标 |
| L480 | 登录验证码 | `codeInput` + `maxLength=6` + `number-pad` + `ref` |
| L505 | 重置 email | 普通 `textInput` + `email-address` |
| L532 | 重置验证码 | `codeInput` + `maxLength=6` + `number-pad` + `ref` |
| L538 | 重置 password | `pwInput` + 眼睛图标 |

**推荐做法**：
- **替换 8 个**：6 个普通 + 3 个密码框（用 `rightIcon` 传 `pwEye`）— 注意：3 个 password 实际只替换 1 个唯一组件位置（同一 useState）
- **不替换 2 个 code**（L480/532）：`maxLength` + `number-pad` + 居中 + `ref` 特殊，强行塞进 TextField 会膨胀 props
- **前置**：扩 TextField.tsx 加 `placeholderTextColor` 和 `onSubmitEditing` prop

**实际能换**：8 个（6 普通 + 3 密码 + 算上 ref 转发）。Code 2 个不动。

**关键 diff 模板**（以登录 username + password 为例）：

```tsx
// 改前（约 L322-342）
<View style={styles.fieldWrap}>
  <Text style={styles.fieldLabel}>{t('username')}</Text>
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <TextInput style={[styles.textInput, { flex: 1 }]} value={username} onChangeText={setUsername}
      placeholder={t('loginPlaceholder') || '用户名 / 邮箱'} placeholderTextColor="rgba(255,255,255,0.55)"
      onSubmitEditing={handleLogin} />
  </View>
</View>
<View style={styles.fieldWrap}>
  <Text style={styles.fieldLabel}>{t('password')}</Text>
  <View style={styles.pwWrap}>
    <TextInput style={styles.pwInput} value={password} onChangeText={setPassword}
      placeholder={t('password')} placeholderTextColor="rgba(255,255,255,0.55)"
      secureTextEntry={!showPw} onSubmitEditing={handleLogin} />
    <TouchableOpacity style={styles.pwEye} onPress={() => setShowPw(!showPw)}>
      {/* eye icon */}
    </TouchableOpacity>
  </View>
</View>

// 改后
<Field label={t('username')} value={username} onChangeText={setUsername}
  placeholder={t('loginPlaceholder') || '用户名 / 邮箱'}
  placeholderTextColor="rgba(255,255,255,0.55)"
  onSubmitEditing={handleLogin} />
<Field label={t('password')} value={password} onChangeText={setPassword}
  placeholder={t('password')}
  placeholderTextColor="rgba(255,255,255,0.55)"
  secureTextEntry={!showPw}
  rightIcon={<TouchableOpacity onPress={() => setShowPw(!showPw)}><EyeIcon /></TouchableOpacity>}
  onSubmitEditing={handleLogin} />
```

**风险点**：
- LoginScreen 的 `fieldLabel` / `pwWrap` / `textInput` 都用 `rgba(255,255,255,0.55)` 暗色半透 placeholder——**TextField 内部样式可能不兼容**，需要先看 TextField 现有 style 决定
- `codeRef`（L480/532）ref forwarding 要确认 TextField 是否 forwardRef（看现有实现）
- `fieldWrap` 容器是否需要保留——TextField 内部已经包了

**建议**：先在 LoginScreen 抽 1 个 Field 子组件**就地**（不直接用 TextField），等 LoginScreen 全跑通再考虑是否直接用 TextField。**这个比看起来的复杂**——i18n/校验/特殊 prop 都有牵连。

**验证点**：
- [ ] 登录/注册/重置 3 个表单都正常切换
- [ ] 暗色 placeholder 文字半透效果保留
- [ ] 密码眼睛图标正常切换
- [ ] 验证码 ref 仍可聚焦
- [ ] 提交按钮 onSubmitEditing 触发
- [ ] 暗色主题下样式与改前一致

---

## 四、整体执行顺序

```
Week 1 (Day 1-2):
  ├── ① P0-3 落地 useDateField         (1h)
  ├── ③ P0-1 收尾 LoginScreen          (1h)
  └── ② P0-2 收尾 UserDetailScreen     (2h) ← **必测**

Week 1 (Day 3):
  └── ④ P2-1 抽 card + sectionTitle    (1-2h)

Week 2 (Day 1-2):
  ├── ⑤ P1-5 落地 useAsyncResource     (半天) ← 只动 2 文件
  └── ⑥ P0-3 表单合并                   (2h) ← **必测**

Week 2 (Day 3):
  └── ⑦ P1-3 LoginScreen TextField     (半天)
```

**总工作量估**：~10-12 小时（1.5 人天）

---

## 五、关键风险 & 回归测试

### 高风险项（必须端到端测）

| 项 | 风险点 | 必测流程 |
|---|---|---|
| ② P0-2 UserDetailScreen | admin 删/恢复用户 | 进入用户详情 → 改字段 → 删 → 恢复 → 自删守卫 |
| ⑥ P0-3 表单合并 | 对账提交错值 | 编辑历史记录 → 改字段 → 提交 → 后端校验数据 |
| ① P0-3 useDateField | 日期默认值/校验 | 选未来日期 → 提示触发 → 改回 → 提示消失 |
| ③ P0-1 LoginScreen | 头像/背景 fallback | 输入不存在用户 → 头像空 → 不报错 |

### 中风险项

| 项 | 风险点 | 必测流程 |
|---|---|---|
| ⑤ P1-5 useAsyncResource | reload 触发条件 | 进页 → 切 filter → 切回 → 数据一致 |
| ⑦ P1-3 TextField | 暗色样式 + ref 转发 | 三表单切换 + 暗色主题 + 验证码 ref |

### 低风险项

| 项 | 风险点 | 必测流程 |
|---|---|---|
| ④ P2-1 card + sectionTitle | 视觉一致性 | 暗色/亮色主题切换 + 截图对比 |

### 整体回归建议

每完成一项后：
1. 跑一遍对应 screen 的端到端流程
2. 切换亮/暗主题
3. 切换 zh/en/zh-TW 三语言
4. 提交一个 PR 后**手动冒烟一次**（首页 → 记账 → 对账 → 采购 → 管理员）

---

## 六、附：验收时使用的检测方法

如未来需要再扫一次，可直接复用以下命令（在项目根目录执行）：

```bash
# 1. screens 里直接用 fetch 的（应走 api/client）
grep -rn "fetch(['\"\`]\\?/api/" src/screens/

# 2. 主操作按钮精确搜索（命名规范的）
grep -rnE 'styles\.(saveBtn|submitBtn|deleteBtn|confirmBtn|primaryBtn|signinBtn|loginBtn|logoutBtn|archiveBtn|okBtn|cancelBtn|primaryAction)' src/screens/

# 3. Alert.alert 真实数量（应接近 0）
grep -rn "Alert\.alert" src/ | wc -l

# 4. 样式散落数（重构前先看数字）
grep -rcE '^\s*card: \{' src/screens/ | grep -v ':0$'
grep -rcE '^\s*sectionTitle: \{' src/screens/ | grep -v ':0$'

# 5. useState 数量（按文件）
grep -rcE 'useState\(' src/screens/ | sort -t: -k2 -rn

# 6. TouchableOpacity 总数（注意：含 chip/tab/+−，主操作仅 < 5%）
grep -rcE 'TouchableOpacity' src/screens/ | sort -t: -k2 -rn
```

### 审计教训

- **不要靠 grep 关键词计数下结论**——`page`/`useState`/`TouchableOpacity` 在 screens 里语义差异极大
- **必须 read_file 上下文确认**——比如 P0-4 初版曾把 HomeScreen/PdfPreviewPage/UserManagementScreen 都列为"应该用 usePaginatedList"——错了
- **文档数据要实测复核**——本次发现 3 处文档数字错：Alert.alert 41→0、234→368 TouchableOpacity、formRow/emptyHint 凭空存在
- **API 兼容性 > 重构理想**——`getUserAvatar(userId)` 不能直接替换 LoginScreen 的 `username` 路径，必须扩签名

---

**审计人**：东北虎（Hermes Agent）  
**关联文档**：`docs/REFACTOR.md`（首次审计，11 项发现）、`docs/REFACTOR_FOLLOWUP.md`（本文，验收 + 7 项方案）

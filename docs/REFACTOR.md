# Snail-Books-Web 重构方案

> **审计范围**：`src/` 共 56 个文件、19,509 行 TS/TSX  
> **审计方法**：批量正则提取 + 用法频次统计 + 抽样对比  
> **审计日期**：2026-06-14

---

## 一、TL;DR

本次审计共发现 **11 项重复模式**，按优先级分三档：

| 优先级 | 项数 | 预估节省 | 说明 |
|---|---|---|---|
| **P0 高频重复** | 4 项 | ~280 行 | 改动小、回报明确，应优先处理 |
| **P1 中频重复** | 5 项 | ~910 行 | 涉及多个文件，需排期 |
| **P2 低频清理** | 2 项 | ~100 行 | 顺手抽，无急迫性 |

执行完 P0+P1 后，项目从 **19,509 行 → ~18,300 行（-6%）**；更重要的是未来新增功能**无需重复同一套样板**。

---

## 二、已抽公共资源（保持现状）

本次审计同时确认**已抽得不错的模块**，后续重构请勿重复造轮子：

### 公共组件（22 个，位于 `src/components/`）

| 组件 | 使用次数 | 评价 |
|---|---|---|
| `Toast` | 10 | 统一提示 |
| `EmptyState` | 7 | 统一空态 |
| `ConfirmModal` | 6 | 弹窗确认；screens 里已 0 处 raw `<Modal>` ✓ |
| `ModalOverlay` | 多处 | 基础模态背景，被多个 modal 复用 |
| `DatePicker` | 多处 | 统一日期选择 |
| `CategoryChips` / `PaymentMethodChips` | 多处 | 类别选择器 |
| `SlideScreen` | 多处 | 滑入式屏幕容器 |
| `LoadingSpinner` / `FadeInView` | 多处 | 视觉反馈 |
| `ImagePreview` / `ReceiptUpload` | 多处 | 图片处理 |
| `BgCropModal` / `InvoiceModal` / `LogoutConfirmModal` / `SessionKickedModal` / `ThemePickerModal` / `ThemePicker` | 单点 | 各自专用 |

### 公共 Hooks（4 个，位于 `src/hooks/`）

| Hook | 使用次数 | 评价 |
|---|---|---|
| `useServerDate` | 11 | 服务端日期，统一时区 |
| `useSwipeBack` | 10 | 统一手势返回 |
| `usePaginatedList` | 4（见 P0-4） | 已抽，但仅 4 处使用 |
| `useCropCanvas` | 1 | 图片裁剪专用 |

### 工具与样式

- `api/client.ts`：67 个 API 方法（**但漏 admin 段**，见 P0-2）
- `theme.tsx`：12 个导出（颜色、字体、动画时长），结构清晰
- `utils/format.ts` / `utils/numbers.ts` / `utils/storage.ts`：数字与持久化工具
- `i18n.tsx`：1,865 行，3 语言字典集中维护

---

## 三、P0 高频重复（应优先处理）

### P0-1. `/api/users/avatar` 头像获取逻辑被复制 6 次

**现状**：每个 screen 都自己写 `fetch → blob → FileReader → base64`。

**重复位置**：
- `src/screens/LoginScreen.tsx`（×2：avatar + background）
- `src/screens/PartnerScreen.tsx`（×1）
- `src/screens/ExpenseDetailScreen.tsx`（×1）
- `src/screens/ProfileScreen.tsx`（×1）
- `src/screens/HomeScreen.tsx`（×1）
- `src/api/client.ts` 内部也使用了 1 次

**重构方案**：在 `src/api/client.ts` 增补：
```ts
export const api = {
  // ...现有 67 个方法...
  
  /** 获取用户头像，返回 base64 字符串，失败返回 null */
  getUserAvatar: async (userId: number | string): Promise<string | null> => {
    try {
      const resp = await authFetch(`/api/users/avatar?user_id=${userId}`);
      if (!resp.ok) return null;
      const blob = await resp.blob();
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch {
      return null;
    }
  },
};
```

**收益**：消除 6 处重复（~60–80 行），回归点从 6 个收敛为 1 个。

---

### P0-2. Admin 端点未进 `api/client.ts`，被迫用 raw `fetch()`

**实测发现的 raw fetch 路径**：

| 路径 | 调用处 |
|---|---|
| `/api/admin/users/mark-reviewed` | `HomeScreen.tsx`, `ProfileScreen.tsx` |
| `/api/admin/check` | `ProfileScreen.tsx` |
| `/api/admin/users/unreviewed-count` | `ProfileScreen.tsx` |
| `/api/users/me` | `ProfileScreen.tsx` |

每个 raw fetch 都要手写 `credentials: 'include', headers: { 'X-Lang': getLang() }` 样板（5–10 行/次）。

**重构方案**：在 `src/api/client.ts` 末尾追加 admin 段：
```ts
export const api = {
  // ...现有方法...
  
  admin: {
    check: () => authFetch('/api/admin/check'),
    getUnreviewedCount: () => authFetch('/api/admin/users/unreviewed-count'),
    markReviewed: () => authFetch('/api/admin/users/mark-reviewed', { method: 'POST' }),
    getMe: () => authFetch('/api/users/me'),
  },
};
```

调用处从 `await fetch('/api/admin/check', { credentials: 'include', headers: ... })` 简化为 `await api.admin.check()`。

**收益**：~40 行 raw fetch 样板，4 个 endpoint 一处定义。

---

### P0-3. `ExpenseScreen.tsx` 30 个 `useState` 严重过载

**当前 30 个 state 按功能分组**：

| 分组 | state 名称 | 数量 | 建议 |
|---|---|---|---|
| **对账表单** | `cardBalance, cashBalance, dineIn, meituan, flashSale, tuan, jd` | 7 | 合并为 1 个 `reconForm` 对象 |
| **平台费表单** | `feeMc, feeMw, feeEw, feeMt, feeEntryDate, feeDateErr` | 6 | 合并为 1 个 `feeForm` 对象 |
| **日期校验三件套** | `recDate, recDateKey, recDateErr` | 3 | 抽 `useDateField()` hook |
| **模态可见性** | `showFeeMonthPicker, showFeeSheet, showFeeHistory, showFeeHistoryFilterPicker` | 4 | 抽 `useDisclosure()` hook |
| **picker 位置** | `pickerPos, feeHistoryPickerPos` | 2 | 同 useDisclosure 模式 |

**重构方案**：

1. **新增 `src/hooks/useDisclosure.ts`**（~10 行）：
   ```ts
   import { useState } from 'react';
   
   export const useDisclosure = (initial = false) => {
     const [open, setOpen] = useState(initial);
     return {
       open,
       show: () => setOpen(true),
       hide: () => setOpen(false),
       toggle: () => setOpen(o => !o),
     };
   };
   ```

2. **新增 `src/hooks/useDateField.ts`**（~20 行）：封装「value + 校验 + 重置」三件套。

3. **表单单字段合并**：
   ```ts
   // 原来：7 个 useState
   const [cardBalance, setCardBalance] = useState('');
   const [cashBalance, setCashBalance] = useState('');
   // ...5 more
   
   // 改为：1 个对象
   const [reconForm, setReconForm] = useState({
     cardBalance: '', cashBalance: '', dineIn: '', meituan: '',
     flashSale: '', tuan: '', jd: '',
   });
   const updateField = (key: keyof typeof reconForm, v: string) =>
     setReconForm(f => ({ ...f, [key]: v }));
   ```

4. **平台费表单**：参考已有 `src/screens/expense/useExpenseForm.ts` 模式，新增 `useExpenseFeeForm()` 子 hook。

**收益**：~80 行，组件可读性大幅提升。

---

### P0-4. `usePaginatedList` 仅 4 处使用，遗漏候选需逐一核验

**当前使用**（已抽好的）：
- `src/screens/ReconHistoryScreen.tsx`
- `src/screens/ExpenseHistoryScreen.tsx`
- `src/screens/DailyRevenueHistory.tsx`
- `src/screens/ProcurementScreen.tsx`

**初步扫描出的「候选」（已逐一读代码核验）**：

| 文件 | 核验结果 | 详情 |
|---|---|---|
| `src/screens/HomeScreen.tsx` | ⚠️ **部分是** | L59 有 `const [page, setPage] = useState(1)` + L60 `pages` — **是**交易列表分页（L287-289、L520-521 调用 `setPage`）。但 L102 还有独立的 `pageStack` / `setPageStack` / `pushPage` 是子页面导航栈，**与分页无关**。需要小心拆分。 |
| `src/screens/UserManagementScreen.tsx` | ❌ **不是** | L122-130 `fetchUsers`：硬编码 `params.set('page', '1'); params.set('per_page', '100')`，**一次性拉全部 100 条**，没有 `setPage` 调用。前端再用 `useMemo` 做客户端筛选。**设计就是不分页，不该用 usePaginatedList**。 |
| `src/screens/PdfPreviewPage.tsx` | ❌ **不是** | L94 `const [currentPage, setCurrentPage] = useState(1)` 是 **PDF 阅读器的页码**（PDF.js 的 `pageNumber` prop，L415）。与数据分页无关。 |

> **审计经验教训**：本次初版曾把这 3 个文件都列为「应该用 usePaginatedList」——**这是错的**。靠 grep 关键词计数（`page`/`per_page` 出现次数）会**把不同语义的 `page` 混为一谈**。正确做法是先读上下文确认 `setPage` 是否真在调用，再判断是否需要分页 hook。

**重构方案**：

1. **只有 `HomeScreen.tsx` 是真正候选**，但改造需要同时梳理：
   - 把 `transactions` 列表分页（`page`/`pages`/`setPage`）抽到独立 hook
   - 保留 `pageStack`/`pushPage`/`popPage` 子页面导航（**这是另一个关注点，不该被分页 hook 接管**）
   - 建议命名：`useTransactionList()` 内部用 `usePaginatedList`

2. **新增 1 处真正可用的候选**：`src/screens/expense/ExpenseHistoryScreen.tsx` 已经用了，但可推广到**未来**的新分页列表场景。

**收益**：~50–80 行（仅 HomeScreen 一处）；更重要的是审计方法改进，避免后续误判。

---

## 四、P1 中频重复（需排期）

### P1-1. `ProfileScreen.tsx` 1,618 行怪兽

**现状**：1,618 行，30 个 useState，8 个 useEffect，5 处 fetch，4 处 modal state。

**重构方案**：把表单子模块拆出 hooks（参考已有 `src/screens/expense/useExpenseForm.ts`、`src/screens/home/useDailyRevenueForm.ts` 模式）：

```
src/screens/profile/
├── useProfileForms.ts        ← 已有，看看是否覆盖
├── useChangePasswordForm.ts  ← 新增
├── useEmailChangeForm.ts     ← 新增
├── useSignatureForm.ts       ← 新增
├── useAvatarForm.ts          ← 新增
└── useCoverForm.ts           ← 新增
```

每个 hook 各管自己的 state + 表单验证 + 提交逻辑，组件只负责 UI 拼装。

**收益**：~200 行；ProfileScreen 降至 ~800 行。

---

### P1-2. `HomeScreen.tsx` 1,288 行 + 8 个 useEffect

8 个 useEffect 拆解为：

```
src/screens/home/
├── useHomeDashboard.ts       ← 业务摘要 + 图表数据
├── useNotifications.ts       ← 未读数 + 通知
├── useUserList.ts            ← 管理员列表
└── useDailyRevenueForm.ts    ← 已存在
```

**收益**：~150 行；HomeScreen 降至 ~700 行。

---

### P1-3. 内联 `TextInput` × 41 处无统一样式

**分布**：

| 文件 | TextInput 数 |
|---|---|
| `src/screens/LoginScreen.tsx` | 10 |
| `src/screens/ProfileScreen.tsx` | 7 |
| `src/screens/ProcurementScreen.tsx` | 7 |
| `src/screens/home/DailyRevenuePanel.tsx` | 4 |
| `src/screens/procurement/ProductManagement.tsx` | 4 |

**重构方案**：新建 `src/components/TextField.tsx`：

```tsx
interface TextFieldProps {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  error?: string;
  placeholder?: string;
  secureTextEntry?: boolean;
  keyboardType?: 'default' | 'numeric' | 'email-address';
  multiline?: boolean;
  rightIcon?: React.ReactNode;
}

export const TextField: React.FC<TextFieldProps> = ({
  label, value, onChangeText, error, placeholder,
  secureTextEntry, keyboardType, multiline, rightIcon,
}) => (
  <View style={ marginBottom: spacing.md }>
    <Text style={ ...typography.label }>{label}</Text>
    <TextInput
      style={ ...styles.input, ...(error ? styles.inputError : null) }
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      secureTextEntry={secureTextEntry}
      keyboardType={keyboardType}
      multiline={multiline}
    />
    {error && <Text style={ color: theme.danger }>{error}</Text>}
  </View>
);
```

**收益**：~300 行；统一错误态、label 样式、间距。

---

### P1-4. 内联 `TouchableOpacity` × 234 处（主操作按钮应统一）

**分布（top 5）**：

| 文件 | 数 |
|---|---|
| `src/screens/ProcurementScreen.tsx` | 34 |
| `src/screens/ProfileScreen.tsx` | 31 |
| `src/screens/ExpenseScreen.tsx` | 25 |
| `src/screens/PartnerScreen.tsx` | 19 |
| `src/screens/LoginScreen.tsx` | 19 |

**注意**：列表项的内联点击**不**该都抽成 Button。仅主操作按钮（保存/提交/取消/确认）需要统一。

**重构方案**：参考现有 `src/components/ButtonPair.tsx`（80 行，已存在但仅 1–2 处用），扩展为：

```tsx
// src/components/Button.tsx
interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ReactNode;
}
```

**收益**：~200 行；统一禁用态、loading 态、危险操作视觉。

---

### P1-5. `useEffect(() => load..., [])` 初始加载模板被复制 5+ 次

**高频文件**：
- `HomeScreen.tsx`（×8）
- `UserManagementScreen.tsx`（×5）
- `PdfPreviewPage.tsx`（×5）
- `ProcurementScreen.tsx`（×5）

**重构方案**：新增 `src/hooks/useAsyncResource.ts`：

```ts
export const useAsyncResource = <T,>(
  fetcher: () => Promise<T>,
  deps: any[] = [],
) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const reload = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const result = await fetcher();
      setData(result);
    } catch (e: any) {
      setError(e?.message || '加载失败');
    } finally {
      setLoading(false);
    }
  }, deps);
  
  useEffect(() => { reload(); }, [reload]);
  
  return { data, loading, error, reload };
};
```

**收益**：~60 行 + 杜绝「忘了 reload」的 bug。

---

## 五、P2 低频清理（顺手抽）

### P2-1. `sharedStyles.ts` 只有 5 个导出，其他都散落

**当前 5 个导出**：`modalCardAnimation, modalClose, historyHeader, uploadReceiptStyles, spinnerAnimation`

**应补充的共用样式**：
- `card` / `cardShadow`（卡片容器）
- `formRow`（表单单行布局）
- `divider`（列表项分隔线）
- `sectionTitle`（章节标题）
- `emptyHint`（空态文案）

---

### P2-2. `Alert.alert(..., [{text, onPress}])` × 41 次散落

每个 screen 都自己写确认对话框样板。

**重构方案**：新增 `src/utils/confirm.ts`：

```ts
import { Alert } from 'react-native';
import { t } from '../i18n';

export const confirm = (
  title: string,
  message: string,
  onConfirm: () => void,
  onCancel?: () => void,
) => {
  Alert.alert(
    title,
    message,
    [
      { text: t('cancel'), style: 'cancel', onPress: onCancel },
      { text: t('confirm'), style: 'destructive', onPress: onConfirm },
    ],
  );
};
```

**收益**：~80 行重复；统一本地化（自动用 t() 包文案）。

---

## 六、推荐执行顺序

| 阶段 | 周次 | 任务 | 影响文件数 |
|---|---|---|---|
| **1** | Week 1 | P0-1 avatar 入 api/client | 6 |
| **1** | Week 1 | P0-2 admin 入 api/client | 4 |
| **1** | Week 1 | P0-3 ExpenseScreen state 重构 | 1 + 2 新增 hook |
| **2** | Week 2 | P0-4 usePaginatedList 推广 | 3 |
| **2** | Week 2 | P1-5 useAsyncResource | 4 + 1 新增 hook |
| **3** | Week 2 | P1-3 TextField 组件 | 5+ + 1 新增组件 |
| **3** | Week 3 | P1-4 Button 组件 | 10+ + 1 新增组件 |
| **4** | Week 3 | P1-1 ProfileScreen 大拆 | 1 + 4 新增 hook |
| **4** | Week 3 | P1-2 HomeScreen 大拆 | 1 + 3 新增 hook |
| **随时** | — | P2-1 sharedStyles 扩展 | 1 |
| **随时** | — | P2-2 confirm util | 1 + 全局替换 |

---

## 七、回归测试建议

每完成一项后必须回归：

| 涉及模块 | 测试入口 |
|---|---|
| api/client 新增方法 | 对应 screen 的端到端流程 |
| ProfileScreen 拆分 | 改密、改邮箱、改签名、上传头像、上传封面 |
| HomeScreen 拆分 | 首页所有 tab + 管理员入口 |
| ExpenseScreen 重构 | 对账录入 + 平台费录入 + 历史分页 |
| usePaginatedList 推广 | 列表加载更多、筛选、刷新 |
| Button/TextField 全局替换 | 所有表单交互流程 |

建议每次提交后跑一次完整的 React Native Web 端到端冒烟（手动 + 截图）。

---

## 八、附：本次审计的检测方法

如未来需要再扫一次，可直接复用以下正则（在项目根目录执行）：

```bash
# 1. screens 里直接用 fetch 的（应走 api/client）
grep -rn "fetch(\`\\?['\"]\\?/api/" src/screens/

# 2. 内联 TextInput 数量
grep -rn "<TextInput" src/screens/ | wc -l

# 3. 内联 Modal（应走 ConfirmModal）
grep -rn "<Modal[\s>]" src/screens/

# 4. useState 数量（按文件）
grep -rn "useState" src/screens/ | awk -F: '{print $1}' | sort | uniq -c | sort -rn

# 5. useEffect 数量
grep -rn "useEffect" src/screens/ | awk -F: '{print $1}' | sort | uniq -c | sort -rn
```

审计人：东北虎（Hermes Agent）

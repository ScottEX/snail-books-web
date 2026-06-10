# 蓝姐螺蛳粉 (snail-books-web)

React Native (Expo) Web 前端，记账 & 营收管理。

---

## 主题系统

三套主题方案，通过 `ThemeProvider` 全局管理，`localStorage` 本地缓存 + 后端 `/api/settings/theme` 按用户持久化。

### 方案一：勃艮第红与暖沙白

温润、沉稳、经典 — 适合账单、餐饮、营业数据场景。

| 角色 | 变量 | 色值 | 说明 |
|------|------|------|------|
| 基础底色 | `bg` | `#F9F7F4` | 极弱米色调暖白，降低刺眼感 |
| 卡片/面板 | `surface` | `#FFFFFF` | 纯白，配合阴影从底色浮出 |
| 主色调/主按钮 | `primary` | `#7D2329` | 勃艮第红，极具质感 |
| 强调色/金额高亮 | `accent` | `#7D2329` | 同主色 |
| 次按钮/描边 | `secondary` | `#EAE5E0` | 燕麦灰，极低存在感 |
| 主标题 | `textMain` | `#2C2626` | 微红灰调深色，比纯黑柔和 |
| 副标题 | `textSub` | `#8C8583` | 中性暖灰 |

### 方案二：曜石黑与流沙金

极简、冷峻、绝对专业 — 高端金融 App 经典结构。

| 角色 | 变量 | 色值 | 说明 |
|------|------|------|------|
| 基础底色 | `bg` | `#F3F4F6` | 冷灰白，现代科技感 |
| 卡片/面板 | `surface` | `#FFFFFF` | 纯白 |
| 主色调/主按钮 | `primary` | `#171A1F` | 曜石黑，极其冷峻 |
| 强调色/金额高亮 | `accent` | `#C5A880` | 流沙金，仅用于核心金额或 VIP 标签 |
| 次按钮/描边 | `secondary` | `#E5E7EB` | 标准中性灰 |
| 主标题 | `textMain` | `#111827` | 极深灰，高对比度 |
| 副标题 | `textSub` | `#6B7280` | 冷灰色 |

### 方案三：深空青与燕麦色

现代、清新、克制 — 莫兰迪色系，现代 SaaS 工具的轻盈精英感。

| 角色 | 变量 | 色值 | 说明 |
|------|------|------|------|
| 基础底色 | `bg` | `#F4F5F4` | 极淡灰绿色调 |
| 卡片/面板 | `surface` | `#FFFFFF` | 纯白 |
| 主色调/主按钮 | `primary` | `#2A4B4B` | 深空青色，低调现代 |
| 强调色/金额高亮 | `accent` | `#2A4B4B` | 同主色 |
| 次按钮/描边 | `secondary` | `#E1E5E4` | 微青灰 |
| 主标题 | `textMain` | `#1B2626` | 深青灰 |
| 副标题 | `textSub` | `#738080` | 中青灰 |

---

## 语义色（三套方案通用）

降低饱和度，融入高级感氛围，**绝不使用系统默认大红大绿**。

| 状态 | 变量 | 色值 | 设计意图 | 适用场景 |
|------|------|------|----------|----------|
| 成功 | `success` | `#4C7A5D` | 沉稳灰绿 | 账单已平、保存成功、对账完成 |
| 警告 | `warning` | `#D59A53` | 哑光橘黄 | 数据异常、待录入、网络延迟 |
| 危险 | `danger` | `#B34149` | 铁锈红 | 删除账单、退出账号、强阻断 |
| 信息 | `info` | `#4A7299` | 莫兰迪蓝灰 | 帮助图标、跳转链接 |

---

## 使用方式

```tsx
import { useTheme } from '../theme';

function MyComponent() {
  const { colors } = useTheme();
  return (
    <View style={{ backgroundColor: colors.bg }}>
      <Text style={{ color: colors.textMain }}>标题</Text>
      <Text style={{ color: colors.textSub }}>副标题</Text>
      <Button color={colors.primary}>确认</Button>
      <Text style={{ color: colors.accent }}>¥12,800</Text>
    </View>
  );
}
```

### `withAlpha()` 工具

需要半透明色时，永远用 `withAlpha()` 而不是硬编码 rgba：

```tsx
import { withAlpha } from '../theme';
// ❌ backgroundColor: 'rgba(125,35,41,0.5)'
// ✅
{ backgroundColor: withAlpha(colors.primary, 0.5) }
// 自动跟随当前主题色计算正确的 rgba
```

### 开发铁律

- **所有视觉颜色必须引用 `colors.*`，禁止硬编码 hex**
- `#FFFFFF`、`rgba(0,0,0,x)`、`rgba(255,255,255,x)` 等中性色可以硬编码（阴影、遮罩）
- 新增页面/组件先跑 `npx tsc --noEmit`，再提交

---

## CI/CD

| 分支 | 触发 | 目标 |
|------|------|------|
| `develop` | push | 自动部署到 staging (8601) |
| `main` | push / PR merge | 自动部署触发生产 (8600) |

```bash
# 开发流程
git checkout develop
# ... 改代码 ...
git push origin develop  # → 自动部署到 8601
```

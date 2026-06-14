# 蓝姐螺蛳粉 (snail-books-web)

React Native (Expo) Web 前端，记账 & 营收管理。

---

## 主题色板

完整 3 套主题方案 + 4 个语义色 + CSS Token + 字体规范详见 [docs/方案-主题系统.md](docs/方案-主题系统.md)。

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

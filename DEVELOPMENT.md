# 柳味探秘 · Web 端开发规范

## 技术栈
- **HTML**: Jinja2 模板（Flask 渲染）
- **CSS**: Tailwind CSS CDN（不手写独立 CSS）
- **JS**: 原生 JavaScript，无框架
- **i18n**: 共享 `/static/i18n.js`（简中 / 繁中 / EN）

## 设计规范

### 颜色
| 用途 | 值 |
|------|-----|
| 页面底色 | `#FAFAFA` |
| 卡片背景 | 白色 |
| 卡片边框 | `#EBEBEB`（细线替阴影） |
| 强调色 | `#8B1E22`（中国红） |
| 注释文字 | `#999` |
| 字体 | Inter + Noto Sans SC |

### 布局
- 统计卡片：`p-3.5`，横向布局（图标 + 数据并排）
- 弹窗：中国红顶栏 + 白色内容区，**禁用浏览器 alert/confirm**
- 筛选用胶囊按钮
- 移动 + 桌面双渲染
- 小圆点替大图标，无渐变、无暗色、无花哨

### 表格
- 流水表金额列**必须用 `<table>`**（flex/Grid 列宽对齐不可靠）
- 金额：`text-right tabular-nums tracking-tight`

### 响应式
- **所有 `md:block` / `lg:flex` 必须配 `hidden` 基类**
- 错误示范：`md:block`（移动端也可见）
- 正确示范：`hidden md:block`

## i18n 规范

### 添加新文字
1. 在 `static/i18n.js` 三个语言表（`zh-CN`/`zh-TW`/`en`）下添加
2. Key 用小驼峰英文
3. HTML 静态文字用 `data-i18n="key"` 属性
4. JS 动态文字用 `t('key')`
5. 所有 `fetch()` 必须带 `X-Lang: curLang` 头

### 语言切换
- 每个页面顶部放语言按钮（简/繁/EN pill）
- JS 渲染页面注册 `onLangChange` 回调触发重渲染
- `setLang()` 内必须同步 `window.curLang = lang`

### 不翻译的内容
- 数字、百分比、¥ 符号、emoji
- 合伙人姓名需翻译（`translateName()` 辅助函数）

## Service Worker

### 缓存陷阱
修改 `index.html` 或 `partner.html` 后，**必须 bump `sw.js` 的缓存版本**：
```javascript
const CACHE = "snail-v5";  // 每次改模板后 +1
```
否则用户看到的是旧版页面。

## 代码规范

### 禁止事项
- 不要手写 CSS（用 Tailwind 类）
- 不要用 `overflow-hidden` 在外层容器（裁切阴影）
- 不要用加载锁（`_loading` flag）防护并发 → 语言切换会失效
- 不要在 iOS App 中用 Tailwind `hidden` class（用 `.page-hidden` + 内联 style）

### 必须事项
- 改完代码**必须用浏览器实测**，不要没测就说好了
- 每次改 HTML/JS 后 `Cmd+Shift+R` 硬刷新
- 错误容器（`#xxx-error`）默认 `style="display:none"`
- 弹窗全部自定义，禁用原生 `alert()`/`confirm()`

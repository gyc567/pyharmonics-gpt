**✅ 推荐方案：Ionic + Capacitor 复用现有 Next.js 前端**

这是目前把你们 `pyharmonics-gpt` 项目**最快**扩展到移动端（iOS + Android）的方案。核心思路是：

- **保留现有 Next.js 前端**（几乎零重写）
- 用 **Capacitor** 把 Web 应用打包成原生 App
- 可选集成 **Ionic** 组件获得更好的移动端体验

下面是 **2026 年最新、最实操的详细教程 + 最佳实践**。

---

### 1. 项目结构确认

假设你的项目结构如下：

```
pyharmonics-gpt/
├── app/                  # Flask 后端
├── frontend/             # Next.js 前端（重点在这里操作）
│   ├── app/              # App Router
│   ├── components/
│   ├── package.json
│   └── ...
├── docker-compose.yml
└── ...
```

**进入前端目录**：
```bash
cd frontend
```

---

### 2. 安装 Capacitor（核心步骤）

```bash
# 1. 安装 Capacitor 核心
npm install @capacitor/core @capacitor/cli

# 2. 初始化 Capacitor
npx cap init

# 按提示填写：
# App name: PyHarmonics GPT
# Package ID: com.yourcompany.pyharmonicsgpt（建议用反向域名）
# Web directory: out（或 .next/static，如果用静态导出）
```

---

### 3. 配置 Next.js 支持 Capacitor（关键！）

Capacitor 推荐使用**静态构建**。在 Next.js 14 中推荐以下两种方式：

#### 推荐方式 A：使用静态导出（最稳定）

在 `next.config.mjs` 中添加：

```js
/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',           // 关键：静态导出
  trailingSlash: true,        // Capacitor 推荐
  images: {
    unoptimized: true,        // 静态导出需要
  },
};

export default nextConfig;
```

修改 `package.json` 的 scripts：

```json
"scripts": {
  "build": "next build",
  "export": "next build && next export",   // 新增
  "cap:sync": "npm run export && npx cap sync"
}
```

#### 方式 B：不改 output（保留 SSR）

如果必须用 SSR，可以用 `next start` + Capacitor 的 `server` 配置（较复杂，不推荐新手）。

**建议先用方式 A**。

---

### 4. 添加 iOS 和 Android 平台

```bash
# 添加平台
npx cap add ios
npx cap add android
```

这会在项目根目录生成 `ios/` 和 `android/` 文件夹。

---

### 5. 构建 + 同步（日常开发流程）

创建便捷脚本（推荐）：

在 `package.json` 中添加：

```json
"scripts": {
  "cap:build": "npm run build && npx cap sync",
  "cap:open:ios": "npx cap open ios",
  "cap:open:android": "npx cap open android",
  "cap:run:ios": "npx cap run ios",
  "cap:run:android": "npx cap run android"
}
```

**日常开发命令**：

```bash
# 1. 修改代码后构建并同步
npm run cap:build

# 2. 打开 Xcode（iOS）
npm run cap:open:ios

# 3. 打开 Android Studio（Android）
npm run cap:open:android

# 或者直接运行（需安装模拟器）
npm run cap:run:ios
npm run cap:run:android
```

---

### 6. 集成关键功能（最佳实践）

#### 6.1 Supabase Auth（魔法链接登录）

在 `app/layout.tsx` 或 `_app.tsx` 中初始化 Capacitor：

```tsx
import { Capacitor } from '@capacitor/core';

useEffect(() => {
  if (Capacitor.isNativePlatform()) {
    // 移动端特殊处理
    console.log('Running on native platform');
  }
}, []);
```

**魔法链接处理**（移动端常见问题）：

使用 Capacitor 的 `App` 插件监听 deep link：

```bash
npm install @capacitor/app
```

```tsx
import { App } from '@capacitor/app';

App.addListener('appUrlOpen', (data) => {
  // 处理 Supabase 魔法链接回调
  if (data.url.includes('access_token')) {
    // 解析 token 并登录
  }
});
```

#### 6.2 API 调用（调用 Flask 后端）

保持原有 `fetch` 或 `axios` 即可。移动端建议增加超时和重试机制。

推荐封装一个 API client：

```ts
// lib/api.ts
import { Capacitor } from '@capacitor/core';

const API_BASE = Capacitor.isNativePlatform() 
  ? 'https://your-production-api.com' 
  : 'http://localhost:5000';

export const api = {
  async query(prompt: string) {
    const res = await fetch(`${API_BASE}/api/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt }),
    });
    return res.json();
  }
};
```

#### 6.3 图表展示

继续使用你们现有的图表库（如 Recharts、Chart.js）。移动端表现良好。

如果需要更好性能，可考虑 `react-native-svg`（需额外配置）。

#### 6.4 推送通知（推荐）

```bash
npm install @capacitor/push-notifications
```

配置 Firebase / OneSignal 即可。

#### 6.5 状态栏、键盘、分享等原生功能

```bash
npm install @capacitor/status-bar @capacitor/keyboard @capacitor/share
```

---

### 7. 最佳实践（强烈建议遵守）

| 类别           | 最佳实践                                      | 说明 |
|----------------|-----------------------------------------------|------|
| **构建方式**   | 使用 `output: 'export'`                       | 最稳定 |
| **路由**       | 使用 Next.js App Router + `use client`        | 移动端友好 |
| **UI 组件**    | 保留 Tailwind + 可选引入 Ionic Web Components | 保持一致性 |
| **API 调用**   | 统一封装 `api.ts`，区分开发/生产环境          | 避免硬编码 |
| **认证**       | 使用 Supabase + Capacitor App 插件监听 deep link | 解决魔法链接问题 |
| **性能**       | 图片使用 `next/image` + `unoptimized: true`   | 静态导出要求 |
| **离线支持**   | 考虑添加 PWA + Workbox（可选）                | 提升体验 |
| **版本管理**   | `ios/` 和 `android/` 建议加入 `.gitignore`    | 只提交配置 |
| **热更新**     | 使用 Capacitor Live Reload（开发时）          | 极大提升效率 |

**推荐 `.gitignore` 添加**：

```gitignore
ios/
android/
```

---

### 8. 完整开发流程示例

```bash
# 1. 修改前端代码
# 2. 构建并同步
npm run cap:build

# 3. 打开 Xcode 运行 iOS
npm run cap:open:ios

# 4. 修改代码后热重载（推荐）
npx cap run ios -l --external  # 开启 Live Reload
```

---

### 9. 部署到应用商店

1. **iOS**：用 Xcode Archive → 上传到 App Store Connect
2. **Android**：用 Android Studio 生成 AAB → 上传 Google Play
3. 推荐使用 **EAS Build**（如果后期切换到 Expo）或 **Codemagic / GitHub Actions** 自动化构建。

---

### 10. 注意事项 & 常见问题

- **Next.js SSR 问题**：静态导出后不能用 `getServerSideProps`，需改成 `getStaticProps` 或客户端获取数据。
- **环境变量**：移动端无法直接使用 `.env.local`，需在构建时注入或用 Capacitor 配置。
- **CORS**：后端需要允许移动端域名（生产环境建议用正式域名）。
- **深链接**：魔法登录必须配置好 Universal Links（iOS）和 App Links（Android）。
- **性能**：移动端建议减少不必要的客户端组件，使用 React Server Components（静态导出有限制）。

---

### 总结推荐路径

| 阶段         | 建议方案                     | 预计时间 |
|--------------|------------------------------|----------|
| **最快验证** | Ionic + Capacitor + 现有 Next.js | 1-2 周  |

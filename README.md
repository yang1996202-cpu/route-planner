# Route Planner Worker

## 部署步骤

### 1. 安装 Wrangler
```bash
npm install -g wrangler
```

### 2. 登录 Cloudflare
```bash
wrangler login
```

### 3. 设置环境变量（Key 只存这里，不提交 Git）
```bash
wrangler secret put AMAP_KEY
# 输入：bce2e751b892a4ae1f21ad4706e48181
```

### 4. 本地测试
```bash
wrangler dev
```
打开 http://localhost:8787 测试

### 5. 部署到 Cloudflare
```bash
wrangler deploy
```

### 6. 绑定自定义域名（避免使用 yang1996202.workers.dev）

**方案 A：使用 Cloudflare 托管的域名**
1. Cloudflare Dashboard → 你的域名 → Workers Routes
2. 添加 Route：`route.yourdomain.com/*`
3. Worker：选择 `route-planner`

**方案 B：新域名**
1. 注册新域名（如 route-planner.app）
2. 添加到 Cloudflare
3. 同上设置 Workers Route

### 7. 删除旧的 Workers 项目
1. Cloudflare Dashboard → Workers & Pages
2. 找到旧的 `route-planner`（如果有重复的）
3. Settings → Delete

## 项目结构

```
route-planner-worker/
├── worker.js          # Worker 代理代码（包含嵌入的 HTML）
├── wrangler.toml      # Worker 配置
├── .gitignore         # Git 忽略文件
└── README.md          # 本文件
```

## 安全特性

- ✅ API Key 只存 Worker 环境变量
- ✅ 前端代码完全看不到 Key
- ✅ GitHub 仓库不暴露任何密钥
- ✅ 支持自定义域名

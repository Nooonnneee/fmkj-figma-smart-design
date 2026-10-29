# FMKJ 自托管部署（国内云服务器）

Figma Make 继续作为开发环境；正式环境跑在你自己的服务器上，使用 PostgreSQL。两边代码相同，区别只在配置：

| | Figma Make | 自己的服务器 |
|---|---|---|
| 配置文件 | `src/payload.config.ts` | `src/payload.selfhost.config.ts` |
| 数据库 | Figma 托管 | PostgreSQL（Docker） |
| 图片 | Figma 托管 | 服务器磁盘，或阿里云 OSS / 腾讯云 COS |
| 登录 | 不变 | 邮箱 + 密码 |

Docker 构建时会自动把配置切到自托管版本，不需要改代码。

## 1. 准备服务器

- 推荐 2 核 4G 以上（构建时内存占用较高），Ubuntu 22.04/24.04。
- 安装 Docker 和 Docker Compose 插件。
- 域名需完成 ICP 备案才能在国内服务器上用 80/443 端口。

## 2. 拉代码并配置

```bash
git clone <你的 GitHub 仓库地址> fmkj && cd fmkj
cp deploy/selfhost.env.example .env
openssl rand -hex 32   # 生成两次，分别填 PAYLOAD_SECRET 和 POSTGRES_PASSWORD
nano .env              # 填写 PUBLIC_URL、密钥、可选的国内镜像和对象存储
```

`.env` 不会被提交到 Git。`PAYLOAD_SECRET` 设定后不要再改，否则所有人都要重新登录。

## 3. 构建并启动

```bash
docker compose build
docker compose up -d
docker compose logs -f app   # 看到 Migrated 和 Ready 即可
```

首次启动会自动建表。之后每次更新代码，数据库变更也会在启动时自动执行。

## 4. 迁移 Figma 里的数据

**第一步：在 Figma Make 里导出。** 让 Figma Make 里的 AI 执行（只读，不会改动 Figma 里的数据）：

```bash
pnpm exec payload run --input '{"scriptPath":"scripts/data-export.ts","scriptArgs":["/tmp/fmkj-export"]}'
```

导出内容为 `data.json` 和 `files/`（全部产品图片，约 140 MB）。**里面有客户姓名和电话，不要上传到 GitHub**，用 scp 等方式直接传到服务器项目目录下的 `import/`：

```
fmkj/import/data.json
fmkj/import/files/...
```

**第二步：在服务器上导入。**

```bash
docker compose --profile tools run --rm tools run --input '{"scriptPath":"scripts/data-import.ts","scriptArgs":["/import"]}'
```

- 保留原有 ID 和所有关联关系（产品-品牌-图片、项目-报价）。
- 可以重复执行：已存在的记录会跳过。
- 报价中已被删除的产品，链接会被清空；报价明细的名称、型号、价格保留。
- 导入完成后删除服务器上的 `import/` 目录。

## 5. 创建管理员、重设员工密码

Figma 的密码加密格式和服务器版不兼容，**员工原密码无法迁移**，需要逐个重新设置。密码通过环境变量传入，不会留在命令参数里：

```bash
# 后台管理员（/admin），不存在时自动创建
docker compose --profile tools run --rm -e NEW_PASSWORD='至少10位的密码' tools \
  run --input '{"scriptPath":"scripts/set-password.ts","scriptArgs":["admins","you@example.com"]}'

# 员工账号（系统登录）
docker compose --profile tools run --rm -e NEW_PASSWORD='至少10位的密码' tools \
  run --input '{"scriptPath":"scripts/set-password.ts","scriptArgs":["users","staff@example.com"]}'
```

目前没有配置邮件服务，"忘记密码"邮件不会发出，需要用上面的命令重设。

## 6. HTTPS（Nginx）

应用只监听本机 `127.0.0.1:3000`。Nginx 示例：

```nginx
server {
  listen 443 ssl http2;
  server_name erp.example.com;
  ssl_certificate     /etc/nginx/ssl/erp.example.com.pem;
  ssl_certificate_key /etc/nginx/ssl/erp.example.com.key;
  client_max_body_size 50m;   # 图纸、图片上传

  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
}
server { listen 80; server_name erp.example.com; return 301 https://$host$request_uri; }
```

证书可在阿里云/腾讯云控制台免费申请。

## 7. 日常更新

在 Figma Make 里改完、推到 GitHub 后，在服务器上：

```bash
git pull
docker compose build app && docker compose up -d app
```

如果在 Figma 里改了数据结构（集合、字段），推送前需要生成迁移文件：

```bash
PAYLOAD_CONFIG_PATH=src/payload.selfhost.config.ts DATABASE_URI=<一个测试用 PostgreSQL> \
  pnpm exec payload migrate:create
```

并把 `src/migrations/` 下的新文件一起提交。服务器重启时会自动执行。

## 8. 备份

```bash
# 数据库
docker compose exec db pg_dump -U fmkj fmkj | gzip > backup-$(date +%F).sql.gz
# 图片（使用磁盘存储时）
docker run --rm -v fmkj_media:/m -v $PWD:/b alpine tar czf /b/media-$(date +%F).tgz -C /m .
```

建议每天定时执行，并把备份复制到服务器以外的地方。卷名前缀取决于项目目录名，可用 `docker volume ls` 确认。

## 已验证 / 未验证

已在兼容 PostgreSQL 的测试库上验证：生产构建（不依赖数据库）、启动自动建表、全量数据导入（728 产品、745 图片、项目、报价）、管理员和员工设置密码后登录、图片上传和读取。

尚未验证：在真实 Docker 环境中执行 `docker compose build`、阿里云 OSS / 腾讯云 COS 实际上传。首次部署时请留意这两步的日志。

## 9. 构建与本机旁路注记（K5/K6 运维注记）

以下来自 Mac 旁路 `docker compose build/up` 实机冒烟，便于裸 clone 按本文档即可过构建。

### 镜像源（DaoCloud 等）

国内部分镜像加速（如 `docker.m.daocloud.io`）可能对 `node:24` 返回 **401**。优先：

1. 官方 Docker Hub（本机/服务器开 HTTP 代理亦可），或
2. 在 `.env` 设置可用的 `NODE_IMAGE` / `NPM_REGISTRY`（见 `selfhost.env.example`）。

### 构建内存

建议构建机内存 **≥4–6G**。Docker Desktop 默认约 2G 时 Next 构建可能被 **SIGKILL（OOM）**，请在 Desktop 设置里调高 Memory 后重启 Docker。

### 本机端口旁路

正式默认绑定 **`127.0.0.1:3000:3000`**（见 `docker-compose.yml`）。若本机 `:3000` 已被占用，可临时把 compose 端口改为 `127.0.0.1:13000:3000` 做本地冒烟；**正式机/生产反代仍按 3000**。旁路端口改动不要长期偏离仓库默认。

### 构建期占位密钥（勿烤生产密钥）

`Dockerfile` builder 阶段使用占位 `PAYLOAD_SECRET` / `DATABASE_URI`（满足 `payload generate:importmap` / `next build` 加载自托管配置）。**不要**把生产 `.env` 里的真密钥作为 compose `build.args` 传入（避免写入镜像层）。运行时由 `env_file: .env` 与 compose 中的 `DATABASE_URI`（指向 `db` 服务）注入真值。

### Docker 内 pnpm 版本

镜像内通过 `corepack prepare pnpm@10.28.2` 钉死 pnpm 10（与 `package.json` 的 `engines.pnpm` / `packageManager` 一致）。勿依赖裸 `corepack enable` 拉到的 pnpm 12（会触发 release-age / ignored-builds 等问题）。`package.json` 已配置 `pnpm.onlyBuiltDependencies`，构建期**不必**再设 `dangerouslyAllowAllBuilds` 或永久 `minimum-release-age 0`。

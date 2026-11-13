# FMKJ 自托管部署（国内云服务器）

Figma Make 继续作为开发环境；正式环境跑在你自己的服务器上，使用 PostgreSQL。两边代码相同，区别只在配置：

|          | Figma Make              | 自己的服务器                          |
| -------- | ----------------------- | ------------------------------------- |
| 配置文件 | `src/payload.config.ts` | `src/payload.selfhost.config.ts`      |
| 数据库   | Figma 托管              | PostgreSQL（Docker）                  |
| 图片     | Figma 托管              | 服务器磁盘，或阿里云 OSS / 腾讯云 COS |
| 登录     | 不变                    | 邮箱 + 密码                           |

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

邮件：用户侧的注册验证码 / 忘记密码走 `RESEND_API_KEY` + `SMTP_FROM`（或 `SMTP_HOST/USER/PASS`），
配好即可用。**Payload 后台 `/admin` 的「忘记密码」仍然不会发信** —— 自托管配置里没有给 Payload
装 email adapter，邮件只会打到容器日志。管理员忘记密码用上面的 `set-password.ts` 重设。

## 6. HTTPS（Nginx）

应用只监听本机 `127.0.0.1:3000`，前面需要一层反向代理。**主站 fmkj.top 实际用的是 Caddy**
（和同机的另一个业务共用，见第 7 节的影子部署）。下面是 Nginx 的等价写法，供新装机器参考：

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

### 主站 fmkj.top 用影子部署（不停机、可回滚）

`fmkj.top` 那台机器**同时跑着别的业务**（`fanmeng-gateway-*`），直接
`docker compose up -d` 会重建容器、短暂中断两个业务。主站更新走影子部署：

```bash
bash deploy/shadow-release.sh              # 备份库 → 新目录 → 新镜像 → 新端口 → 验证 → 切 Caddy
bash deploy/shadow-release.sh --rollback 13028   # 回滚到指定端口（先确认该端口有服务）
```

脚本第 4.5 步是切流量前的最后一道闸：**用真浏览器在影子上跑一遍冒烟**。

⚠️ 那台宿主机没装 node / pnpm / playwright，**脚本自己跑不了冒烟**。它会直接停下并提示，
不会静默跳过（2026-11-13 就因此在第 4.5 步中止过，表现为「镜像构建完了但流量没切」）。
正确做法是**在本机**通过 SSH 隧道跑：

```bash
# 1. 把影子容器的端口（脚本会打印，如 13029）隧道到本机
ssh -f -N -L 19128:127.0.0.1:13029 ubuntu@124.222.225.26

# 2. 本机跑冒烟（本机有 playwright）
SMOKE_BASE=http://127.0.0.1:19128 SMOKE_OUT=/tmp/fmkj-smoke node e2e/smoke.mjs

# 3. 通过后带 SKIP_SMOKE=1 重跑脚本完成切流量（镜像已构建，会复用）
SKIP_SMOKE=1 bash deploy/shadow-release.sh
```

想让自动冒烟真正跑起来，可以在服务器上装 node + playwright，或用带 playwright 的
sidecar 镜像执行 —— 目前都没有做，所以每次发布都是「本机跑冒烟 → 服务器切流量」。

如果在 Figma 里改了数据结构（集合、字段），推送前需要生成迁移文件：

```bash
PAYLOAD_CONFIG_PATH=src/payload.selfhost.config.ts DATABASE_URI=<一个测试用 PostgreSQL> \
  pnpm exec payload migrate:create
```

并把 `src/migrations/` 下的新文件一起提交。服务器重启时会自动执行。

## 8. 备份

用 `deploy/backup.sh`，不要手敲 pg_dump —— 它多做两件事：写盘后立刻
`pg_restore --list` 校验（半截的 dump 恰恰能解压，看不出来），以及自动清理过期备份。

```bash
sudo install -m 755 deploy/backup.sh /opt/fmkj/bin/fmkj-backup.sh
sudo /opt/fmkj/bin/fmkj-backup.sh --db-only   # 先手动跑一次确认
```

挂到 cron（`/etc/cron.d/fmkj-backup`）：

```cron
30 3 * * * root /opt/fmkj/bin/fmkj-backup.sh >> /var/log/fmkj-backup.log 2>&1
```

策略：数据库每天一份 custom 格式、保留 14 天；素材卷满 7 天才打包、保留最近 2 份；
磁盘剩余不足 3G 时跳过素材。参数都能用环境变量覆盖（`KEEP_DB_DAYS` / `KEEP_MEDIA` /
`BACKUPS` / `DB_CONTAINER`）。

还原演练（**定期做一次，别等出事才第一次试**）：

```bash
docker exec fmkj-db-1 createdb -U fmkj restore_drill
docker exec -i fmkj-db-1 pg_restore -U fmkj -d restore_drill --no-owner < /opt/fmkj/backups/db-<时间>.dump
docker exec fmkj-db-1 psql -U fmkj -d restore_drill -tAc 'SELECT count(*) FROM projects;'
docker exec fmkj-db-1 dropdb -U fmkj restore_drill
```

备份目前落在**同一台服务器**上：能防误删、防写坏，防不了整机故障。异地副本
（对象存储 / 另一台机器）还需要单独配。

## 9. 桌面客户端（Windows / macOS）

客户端源码在 `desktop/`，打包方法见 `desktop/README.md`。客户端加载的是服务器上的网页工作台，服务器只需要托管安装包和自动更新清单：

1. 安装包放在项目目录下的 `desktop-releases/`（docker-compose 已只读挂载到容器的 `/data/desktop`）：

   ```bash
   mkdir -p desktop-releases
   # 在打包的电脑上（desktop/ 目录）执行：先传安装包，最后传更新清单
   sh scripts/upload.sh 用户@服务器:/项目目录/desktop-releases
   ```

   需要的文件：Windows 为 `FanmengSpace-Setup-<版本>.exe`、`.exe.blockmap`、`latest.yml`；macOS 为 `FanmengSpace-<版本>-mac-*.dmg`/`.zip`、`latest-mac.yml`。

2. 上传后不用重启：`/download` 页面一分钟内显示新版本；Windows 客户端会自动下载更新，macOS 客户端会提示前往下载页。
3. 首次启用需要重建一次镜像（新增了下载页和 `/downloads/desktop/*` 路由）：`docker compose build app && docker compose up -d app`。
4. 安装包也可以放在对象存储 / CDN：在 `.env` 设置 `DESKTOP_RELEASES_URL=https://cdn.example.com/desktop`，本地目录没有的文件会跳转过去。

固定下载地址可以印在宣传物料上：`/downloads/desktop/latest/windows`、`/downloads/desktop/latest/mac-arm64`、`/downloads/desktop/latest/mac-x64`。

客户端默认连接 `https://fmkj.top`（`desktop/app-config.json` 的 `defaultServerUrl`）。正式域名不同时，改这里后重新打包；私有部署的用户也可以在客户端「帮助 → 服务器设置」里填写自己的地址。

## 已验证 / 未验证

已在兼容 PostgreSQL 的测试库上验证：生产构建（不依赖数据库）、启动自动建表、全量数据导入（728 产品、745 图片、项目、报价）、管理员和员工设置密码后登录、图片上传和读取。

尚未验证：在真实 Docker 环境中执行 `docker compose build`、阿里云 OSS / 腾讯云 COS 实际上传。首次部署时请留意这两步的日志。

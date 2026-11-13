# 发布清单（现行）

> 2026-11-14 更新。主站 `fmkj.top` 已上线，日常发布走**影子部署**
> （`deploy/shadow-release.sh`），不再 `docker compose down && up`。
>
> 这份清单只留三部分：**每次发布做什么**、**一次性事项的现状**、**出事怎么回滚**。
> 旧的「首次上线」清单已完成，历史留在 git 里。

---

## 每次发布

按顺序打勾，任何一步失败都**不要**继续（生产在前一步之前不受影响）。

- [ ] 分支 + PR，CI 七道门禁全绿（`ci-selfhosted.yml`：oxfmt / eslint 0 warning /
      tsc / knowledge:check / vitest / 生产构建 / e2e 冒烟）
- [ ] 本机打包源码（服务器到 GitHub 只有几十 KB/s）：
      `git archive --format=tar main | COPYFILE_DISABLE=1 gzip > /tmp/fmkj.tar.gz`
- [ ] 上传并解压，确认**没有 AppleDouble**：`find . -name '._*' | wc -l` 为 0
- [ ] 服务器上 `SRC_DIR=<解压目录> PAUSE=1 bash deploy/shadow-release.sh`
      （自动做：备份数据库 → 构建镜像 → 迁移 → 起影子容器 → 验证网络与素材卷 → 停住）
- [ ] 本机开隧道跑冒烟（宿主机没有 node/playwright）：
      `ssh -f -N -L 19129:127.0.0.1:<新端口> ubuntu@124.222.225.26`
      `SMOKE_BASE=http://127.0.0.1:19129 node e2e/smoke.mjs` → 16/16 通过
- [ ] 切流量：`SKIP_SMOKE=1 bash deploy/shadow-release.sh --cut <新端口>`
- [ ] 切完核对三件事：
      Caddy 指向新端口、`payload_migrations` 有本次新迁移、`https://fmkj.top/login` 200
- [ ] 确认**上一版容器还活着**（它是回滚目标，脚本按设计保留「当前 + 上一版」）

## 一次性事项

| 项                   | 现状                                                      |
| -------------------- | --------------------------------------------------------- |
| 服务器 / 域名 / HTTPS | `124.222.225.26`，`fmkj.top`，Caddy 反代 `127.0.0.1:130xx` |
| 数据库                | 自托管 PostgreSQL（容器 `fmkj-db-1`），迁移由部署脚本自动跑 |
| 管理员 / 员工账号     | 已创建；重设密码用 `scripts/set-password.ts`               |
| 产品库                | 已导入（728 条）                                          |
| 素材卷                | `fmkj_media`（约 500MB），挂到影子的 `/data/media`         |
| 备份                  | **每天 03:30 自动**，见下                                  |

## 备份

`deploy/backup.sh` 装在服务器 `/opt/fmkj/bin/fmkj-backup.sh`，由
`/etc/cron.d/fmkj-backup` 每天 03:30 触发：

```bash
# 数据库：每天一份 custom 格式，保留 14 天，写盘后立刻 pg_restore --list 校验
# 素材：满 7 天才打包一次，保留最近 2 份，磁盘不足 3G 时跳过
```

手动跑 / 只跑数据库 / 强制备份素材：

```bash
sudo /opt/fmkj/bin/fmkj-backup.sh --db-only
sudo /opt/fmkj/bin/fmkj-backup.sh --media
```

**2026-11-14 做过真实恢复演练**：把最新 dump 灌进临时库 `restore_drill`，
projects / users / products / quotes / media 行数与生产完全一致，随后删库。

## 回滚

```bash
# 代码层面：把 Caddy 指回上一版容器（脚本会先探活，目标端口没服务就拒绝）
bash deploy/shadow-release.sh --rollback <上一版端口>

# 数据层面：部署脚本第 0 步已自动备份；更早的还原点用每日备份
docker exec -i fmkj-db-1 pg_restore -U fmkj -d fmkj --clean --if-exists < db-<时间>.dump
```

⚠️ 不要再用旧的 `docker compose down / up` 回滚：这台服务器同时跑着另一个业务，
而且 `fmkj-app:latest` 每次部署都会被覆盖，按 tag 回退并不存在。

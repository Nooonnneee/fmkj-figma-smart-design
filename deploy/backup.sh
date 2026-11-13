#!/usr/bin/env bash
# 生产备份：每天数据库，每 7 天素材卷。挂 cron 用。
#
# 为什么需要它：`shadow-release.sh` 只在**部署时**备份一次数据库。
# 两次部署之间隔一周，这一周里删错的项目、写坏的报价单就没有任何还原点。
# 2026-11-14 检查发现服务器上没有任何定时任务，最近一份备份是当晚部署顺手做的。
#
# 用法（服务器上，root 或能 sudo docker 的账号）：
#   bash deploy/backup.sh              # 每日：数据库；素材满 7 天才备份
#   bash deploy/backup.sh --db-only    # 只备份数据库
#   bash deploy/backup.sh --media      # 强制备份素材
#
# cron（/etc/cron.d/fmkj-backup）：
#   30 3 * * * root /opt/fmkj/bin/fmkj-backup.sh >> /var/log/fmkj-backup.log 2>&1
set -euo pipefail

BACKUPS=${BACKUPS:-/opt/fmkj/backups}
DB_CONTAINER=${DB_CONTAINER:-fmkj-db-1}
DB_USER=${DB_USER:-fmkj}
DB_NAME=${DB_NAME:-fmkj}
MEDIA_DIR=${MEDIA_DIR:-/var/lib/docker/volumes/fmkj_media/_data}
KEEP_DB_DAYS=${KEEP_DB_DAYS:-14}
KEEP_MEDIA=${KEEP_MEDIA:-2}
MEDIA_EVERY_DAYS=${MEDIA_EVERY_DAYS:-7}
MIN_FREE_GB=${MIN_FREE_GB:-3}

MODE=${1:-}
STAMP=$(date +%Y%m%d-%H%M)

# cron 里是 root，手动跑是 ubuntu；两种都要能用
SUDO=""
[[ $EUID -ne 0 ]] && SUDO=sudo

log() { printf '[%s] %s\n' "$(date '+%F %T')" "$*"; }
die() { printf '[%s] ✗ %s\n' "$(date '+%F %T')" "$*" >&2; exit 1; }

mkdir -p "$BACKUPS"

# ── 数据库 ────────────────────────────────────────────
# 用 -Fc（custom 格式）：自带压缩，恢复时可以只挑表，而且 `pg_restore --list`
# 能立刻证明这份文件不是半截的 —— 管道没写完的 gzip 恰好也能解压，看不出坏。
DB_FILE="$BACKUPS/db-$STAMP.dump"
log "数据库 → $DB_FILE"
$SUDO docker exec "$DB_CONTAINER" pg_dump -U "$DB_USER" -Fc "$DB_NAME" > "$DB_FILE" \
  || die "pg_dump 失败（生产未受影响）"
$SUDO docker exec -i "$DB_CONTAINER" pg_restore --list < "$DB_FILE" > /dev/null \
  || die "备份文件无法解析（$DB_FILE），请勿依赖它"
SIZE=$(du -h "$DB_FILE" | cut -f1)
log "✅ 数据库备份 $SIZE，已校验可解析"

# 清理过期数据库备份（只删自己产的 db-*.dump，不碰部署脚本的 fmkj-db-*.sql.gz）
find "$BACKUPS" -maxdepth 1 -name 'db-*.dump' -type f -mtime "+$KEEP_DB_DAYS" -print -delete \
  | while read -r f; do log "清理旧备份：$(basename "$f")"; done

[[ "$MODE" == "--db-only" ]] && exit 0

# ── 素材卷 ────────────────────────────────────────────
# 素材是「只增不改」的，每天全量打包太浪费；按最后一份的时间判断，满 7 天才打。
LAST_MEDIA=$(ls -1t "$BACKUPS"/media-*.tar.gz 2>/dev/null | head -1 || true)
if [[ "$MODE" != "--media" && -n "$LAST_MEDIA" ]]; then
  AGE_DAYS=$(( ( $(date +%s) - $(stat -c %Y "$LAST_MEDIA") ) / 86400 ))
  if [[ $AGE_DAYS -lt $MEDIA_EVERY_DAYS ]]; then
    log "素材上次备份在 ${AGE_DAYS} 天前（<${MEDIA_EVERY_DAYS} 天），跳过"
    exit 0
  fi
fi

FREE_GB=$(df --output=avail -BG "$BACKUPS" | tail -1 | tr -dc '0-9')
if [[ "${FREE_GB:-0}" -lt "$MIN_FREE_GB" ]]; then
  log "⚠️  磁盘只剩 ${FREE_GB}G（<${MIN_FREE_GB}G），跳过素材备份。先清理再跑 --media"
  exit 0
fi

MEDIA_FILE="$BACKUPS/media-$STAMP.tar.gz"
log "素材 → $MEDIA_FILE"
# 直接打包卷目录：不用临时拉一个 alpine 镜像，宿主机 tar 也更快。
$SUDO tar czf "$MEDIA_FILE" -C "$MEDIA_DIR" . || die "素材打包失败"
log "✅ 素材备份 $(du -h "$MEDIA_FILE" | cut -f1)"

# 只保留最近 KEEP_MEDIA 份
ls -1t "$BACKUPS"/media-*.tar.gz 2>/dev/null | tail -n "+$((KEEP_MEDIA + 1))" \
  | while read -r f; do $SUDO rm -f "$f"; log "清理旧素材备份：$(basename "$f")"; done

log "完成"

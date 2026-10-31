#!/bin/sh
# 把 release/ 里的安装包和自动更新清单上传到自托管服务器的 desktop-releases 目录。
# 用法：sh scripts/upload.sh 用户@服务器:/opt/fmkj/desktop-releases
# 先传安装包、最后传 latest*.yml，避免客户端先看到新版本却下载不到文件。
set -eu
DEST="${1:?用法：sh scripts/upload.sh 用户@服务器:/路径/desktop-releases}"
cd "$(dirname "$0")/../release"
FILES=$(ls FanmengSpace-* 2>/dev/null | grep -E '\.(exe|dmg|zip|blockmap)$' || true)
if [ -z "$FILES" ]; then
  echo "release/ 里没有安装包，请先运行 npm run dist:win 或 npm run dist:mac"
  exit 1
fi
# shellcheck disable=SC2086
rsync -av --progress $FILES "$DEST/"
rsync -av latest*.yml "$DEST/"
echo "上传完成：下载页立即显示新版本，客户端会在下次检查更新时发现。"

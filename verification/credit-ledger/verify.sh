#!/usr/bin/env bash
# 重跑「积分流水」的形式化验证：对三份配置逐条检查 Ledger.tla 的两条规则。
#
# 预期结果：
#   Current.cfg（今天的代码）   两条规则都违反
#   Locked.cfg（建议的修复）    两条都成立
#   NoGuard.cfg（修复但去掉 402 守卫）  只有 NoOverdraft 违反
#
# 只依赖 java + tla2tools.jar，两个都在仓库外，不要提交二进制。
# 想把反例读成中文路径，用 pstack 的 /statechart 读本目录的 report.md 或它另行生成的报告。
set -euo pipefail
cd "$(dirname "$0")"

export TLA2TOOLS="${TLA2TOOLS:-$HOME/.cache/fv-tla/tla2tools.jar}"
export JAVA="${JAVA:-$HOME/.cache/fv-tla/jre/Contents/Home/bin/java}"
RULES="BalanceMatchesLedger NoOverdraft"

if [ ! -f "$TLA2TOOLS" ]; then
  echo "❌ 找不到 tla2tools.jar：$TLA2TOOLS"
  echo "   下载 v1.7.4：https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar"
  echo "   sha256 应为 936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88"
  exit 1
fi
if [ ! -x "$JAVA" ]; then
  echo "❌ 找不到 java：$JAVA（Java 11+ 即可）"
  echo "   用 JAVA=/path/to/java 指定。本机没有 mise，statechart 的自动安装路径不可用。"
  exit 1
fi

OUT="${1:-/tmp/verify-credit-$(date +%s)}"
mkdir -p "$OUT"
BROKEN=0

for cfg in Current Locked NoGuard; do
  echo "▸ $cfg"
  for rule in $RULES; do
    # 每次只查一条规则：TLC 在第一条违反的规则处就停，否则后面那条就查不到。
    one="$OUT/$cfg.$rule.cfg"
    { grep -v '^INVARIANT' "$cfg.cfg"; echo "INVARIANT $rule"; } >"$one"
    log="$OUT/$cfg.$rule.log"
    "$JAVA" -cp "$TLA2TOOLS" tlc2.TLC -config "$one" -deadlock -workers 1 \
      -metadir "$OUT/meta/$cfg.$rule" Ledger.tla >"$log" 2>&1 || true
    if grep -q "No error has been found" "$log"; then
      printf '  %-22s ✅ 成立\n' "$rule"
    else
      printf '  %-22s ❌ 违反\n' "$rule"
      echo "     ↳ 反例：${log}（用 /statechart 读成「谁先读了余额、谁后写回去」的路径）"
      BROKEN=$((BROKEN + 1))
    fi
  done
done

echo
echo "结果目录：$OUT"
echo "违反次数：${BROKEN}（应为 3：Current 2 条 + NoGuard 1 条）"

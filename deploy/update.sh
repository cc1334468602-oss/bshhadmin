#!/usr/bin/env bash
# ==========================================================
# bshhadmin 管理后台 —— 更新部署（拉取最新代码并零停机重载）
# 用法：cd /var/www/bshhadmin && bash deploy/update.sh
# ==========================================================
set -e

APP_NAME="bshh-admin"
APP_PORT=9192
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

green() { echo -e "\033[32m$1\033[0m"; }
yellow(){ echo -e "\033[33m$1\033[0m"; }
red()   { echo -e "\033[31m$1\033[0m"; }

cd "$PROJECT_DIR"
echo ""
green "=== bshhadmin 后台更新 ==="

OLD_COMMIT=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")
echo "当前版本：$OLD_COMMIT"

echo ""
echo "[1/4] 拉取最新代码"
git fetch --all
git reset --hard origin/main
NEW_COMMIT=$(git rev-parse --short HEAD)
green "  ✓ 已更新到 $NEW_COMMIT"

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  yellow "  代码无变化"
fi

echo ""
echo "[2/4] 检查环境变量"
if [ ! -f .env ]; then
  red "  ✗ .env 不存在！请先运行 bash deploy/bootstrap.sh"
  exit 1
fi
green "  ✓ .env 存在"

echo ""
echo "[3/4] 重载服务"
node --check server.js || { red "  ✗ server.js 语法错误，已中止（服务未受影响）"; exit 1; }

pm2 reload "$APP_NAME" --update-env
green "  ✓ 已重载"

echo ""
echo "[4/4] 健康检查"
sleep 3
HEALTH=$(curl -s "http://127.0.0.1:$APP_PORT/api/health" || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  green "  ✓ 服务健康"
  echo "    $HEALTH"
  echo ""
  green "=== 更新完成：$OLD_COMMIT → $NEW_COMMIT ==="
else
  red "  ✗ 健康检查失败！"
  echo ""
  yellow "回滚命令："
  echo "  git reset --hard $OLD_COMMIT && pm2 reload $APP_NAME"
  echo ""
  yellow "查看日志："
  echo "  pm2 logs $APP_NAME --lines 50"
  exit 1
fi

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
if git fetch --all 2>/dev/null && git reset --hard origin/main 2>/dev/null; then
  green "  ✓ git 直连拉取成功"
else
  yellow "  git 直连失败，改用 codeload tarball 兜底..."
  TARBALL="https://codeload.github.com/cc1334468602-oss/bshhadmin/tar.gz/refs/heads/main"
  TMPD=$(mktemp -d)
  if curl -fsSL "$TARBALL" -o "$TMPD/u.tar.gz" && tar -xzf "$TMPD/u.tar.gz" -C "$TMPD"; then
    SRC=$(ls -d "$TMPD"/*/ | head -1)
    rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env' "$SRC"/ "$PROJECT_DIR"/
    green "  ✓ 已用 tarball 更新工作区"
    git fetch --all 2>/dev/null || true
    git reset --hard origin/main 2>/dev/null || true
  else
    red "  ✗ tarball 兜底也失败，请检查 ECS 网络后重试"
  fi
  rm -rf "$TMPD"
fi
NEW_COMMIT=$(git rev-parse --short HEAD)
green "  ✓ 已更新到 $NEW_COMMIT"

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  yellow "  代码无变化"
fi

# ---------- 1.5 安装依赖（如 package.json 变化） ----------
echo ""
echo "[1.5/4] 安装依赖"
npm install --registry=https://registry.npmmirror.com >/dev/null 2>&1 || npm install

echo ""
echo "[2/4] 检查环境变量"
if [ ! -f .env ]; then
  red "  ✗ .env 不存在！请先运行 bash deploy/bootstrap.sh"
  exit 1
fi
green "  ✓ .env 存在"

# 确保 .env 含数据库配置（固定凭据，与 setup-mysql.sh / .env.example 保持一致）
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-3306}"
DB_USER="${DB_USER:-bshh_user}"
DB_PASS="${DB_PASS:-Bshh@2026}"
DB_NAME="${DB_NAME:-bshh_db}"
# 若初始化脚本曾导出连接信息，则以导出值优先
if [ -f /tmp/bshh_db.env ]; then
  source /tmp/bshh_db.env
fi
for kv in "DB_HOST=$DB_HOST" "DB_PORT=$DB_PORT" "DB_USER=$DB_USER" "DB_PASS=$DB_PASS" "DB_NAME=$DB_NAME"; do
  key="${kv%%=*}"
  if grep -q "^${key}=" .env 2>/dev/null; then
    sed -i "s#^${key}=.*#${kv}#" .env
  else
    echo "$kv" >> .env
  fi
done
green "  ✓ 已确保 .env 包含数据库配置"

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

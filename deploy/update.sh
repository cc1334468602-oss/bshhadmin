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
# 重要：ECS 本地 git 的 origin/main 指针可能因网络不稳定而滞后，
# 若用 git reset --hard origin/main 作主路径，会把已修复的 db.js 回退为旧版 bug。
# 因此改为主路径用 GitHub codeload tarball 强制同步（永远取最新 main），git 仅作兜底。
TARBALL="https://codeload.github.com/cc1334468602-oss/bshhadmin/tar.gz/refs/heads/main"
TMPD=$(mktemp -d)
if curl -fsSL "$TARBALL" -o "$TMPD/u.tar.gz" 2>/dev/null && tar -xzf "$TMPD/u.tar.gz" -C "$TMPD" 2>/dev/null; then
  SRC=$(ls -d "$TMPD"/*/ 2>/dev/null | head -1)
  if [ -n "$SRC" ]; then
    if ! command -v rsync >/dev/null 2>&1; then
      dnf install -y rsync >/dev/null 2>&1 || yum install -y rsync >/dev/null 2>&1 || true
    fi
    if command -v rsync >/dev/null 2>&1; then
      rsync -a --exclude='.git' --exclude='node_modules' --exclude='.env' --exclude='logs' "$SRC"/ "$PROJECT_DIR"/
    else
      for item in "$SRC"/*; do
        base=$(basename "$item")
        case "$base" in
          .git|node_modules|.env|logs) continue ;;
          *) cp -a "$item" "$PROJECT_DIR"/ ;;
        esac
      done
    fi
    green "  ✓ 已用 tarball 更新工作区"
  else
    yellow "  tarball 内容解析失败，尝试 git 兜底..."
    if git fetch --all 2>/dev/null && git reset --hard FETCH_HEAD 2>/dev/null; then
      green "  ✓ git 兜底拉取成功"
    else
      red "  ✗ 代码拉取失败，请检查 ECS 网络后重试"
    fi
  fi
else
  yellow "  tarball 拉取失败，尝试 git 兜底..."
  if git fetch --all 2>/dev/null && git reset --hard FETCH_HEAD 2>/dev/null; then
    green "  ✓ git 兜底拉取成功"
  else
    red "  ✗ 代码拉取失败，请检查 ECS 网络后重试"
  fi
fi
rm -rf "$TMPD"

# 显示远程最新提交（git ls-remote 不受本地指针滞后影响）
REMOTE_SHA=$(timeout 10 git ls-remote https://github.com/cc1334468602-oss/bshhadmin main 2>/dev/null | awk '{print $1}') || true
NEW_COMMIT=${REMOTE_SHA:-latest}
if [ "$NEW_COMMIT" != "latest" ]; then NEW_COMMIT=${NEW_COMMIT:0:7}; fi
green "  ✓ 已更新到 $NEW_COMMIT"

if [ "$OLD_COMMIT" = "$NEW_COMMIT" ]; then
  yellow "  代码无变化（与远程 main 一致）"
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

pm2 startOrRestart ecosystem.config.js --update-env 2>/dev/null || pm2 start ecosystem.config.js --update-env
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

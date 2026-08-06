#!/usr/bin/env bash
# ==========================================================
# bshhadmin 管理后台 —— 服务器首次部署一键脚本
# 用法：cd /var/www/bshhadmin && bash deploy/bootstrap.sh
#
# 本脚本会引导录入简道云凭证并写入共享配置文件，
# 前台 bshh 读取同一份文件，配置一次两端生效。
# ==========================================================
set -e

APP_NAME="bshh-admin"
APP_PORT=9192
SHARED_DIR="/var/www/shared"
SHARED_CONFIG="$SHARED_DIR/jdy-config.json"
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

green() { echo -e "\033[32m$1\033[0m"; }
yellow(){ echo -e "\033[33m$1\033[0m"; }
red()   { echo -e "\033[31m$1\033[0m"; }

echo ""
green "=========================================="
green "  bshhadmin 管理后台 —— 首次部署"
green "=========================================="
echo "项目目录：$PROJECT_DIR"
echo ""

# ---------- [1/7] 检查 Node ----------
echo "[1/7] 检查 Node.js 环境"
if ! command -v node >/dev/null 2>&1; then
  yellow "  未检测到 Node.js，开始安装 Node 18 ..."
  if command -v yum >/dev/null 2>&1; then
    curl -fsSL https://rpm.nodesource.com/setup_18.x | bash -
    yum install -y nodejs
  elif command -v apt-get >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt-get install -y nodejs
  else
    red "  无法识别包管理器，请手动安装 Node.js 16+ 后重试"
    exit 1
  fi
fi
NODE_VER=$(node -v)
green "  ✓ Node.js $NODE_VER"

NODE_MAJOR=$(echo "$NODE_VER" | sed 's/v\([0-9]*\).*/\1/')
if [ "$NODE_MAJOR" -lt 16 ]; then
  red "  ✗ Node 版本过低（需要 16+），当前 $NODE_VER"
  exit 1
fi

# ---------- [2/7] 检查 PM2 ----------
echo ""
echo "[2/7] 检查 PM2"
if ! command -v pm2 >/dev/null 2>&1; then
  yellow "  未检测到 PM2，正在安装 ..."
  npm install -g pm2 --registry=https://registry.npmmirror.com
fi
green "  ✓ PM2 $(pm2 -v)"

# ---------- [3/7] 准备共享配置目录 ----------
echo ""
echo "[3/7] 准备共享配置目录"
mkdir -p "$SHARED_DIR"
chmod 750 "$SHARED_DIR"
green "  ✓ $SHARED_DIR"

# ---------- [4/7] 录入简道云凭证 ----------
echo ""
echo "[4/7] 配置简道云凭证"
if [ -f "$SHARED_CONFIG" ]; then
  green "  ✓ 共享配置已存在：$SHARED_CONFIG"
  read -p "  是否重新录入？(y/N) " REDO
  REDO=${REDO:-N}
else
  REDO="y"
fi

if [ "$REDO" = "y" ] || [ "$REDO" = "Y" ]; then
  echo ""
  yellow "  请依次粘贴简道云凭证（直接回车可跳过，之后在后台页面填写）"
  echo "  获取路径：简道云 → 开放平台 → 密钥管理 / 表单 URL"
  echo ""
  read -p "  API Key            : " IN_KEY
  read -p "  App ID             : " IN_APP
  read -p "  客户信息 entry_id  : " IN_CUSTOMER
  read -p "  内部贷款 entry_id  : " IN_LOAN
  read -p "  历史贷款 entry_id  : " IN_LOANH
  read -p "  资金周转 entry_id  : " IN_CASH
  read -p "  意向业务 entry_id  : " IN_INTENT
  read -p "  日常跟进 entry_id  : " IN_FOLLOW
  read -p "  资金回款 entry_id  : " IN_REPAY

  cat > "$SHARED_CONFIG" <<EOF
{
  "apiKey": "$IN_KEY",
  "appId": "$IN_APP",
  "entries": {
    "customer": "$IN_CUSTOMER",
    "loan": "$IN_LOAN",
    "loanHistory": "$IN_LOANH",
    "cashFlow": "$IN_CASH",
    "intention": "$IN_INTENT",
    "followUp": "$IN_FOLLOW",
    "repayment": "$IN_REPAY"
  }
}
EOF
  chmod 600 "$SHARED_CONFIG"
  green "  ✓ 已写入 $SHARED_CONFIG（权限 600）"
fi

# ---------- [5/7] 生成 .env ----------
echo ""
echo "[5/7] 生成环境变量文件"
cd "$PROJECT_DIR"
if [ -f .env ]; then
  green "  ✓ .env 已存在，跳过"
else
  cat > .env <<EOF
PORT=$APP_PORT
HOST=127.0.0.1
JDY_CONFIG_PATH=$SHARED_CONFIG
JDY_API_KEY=
JDY_APP_ID=
EOF
  chmod 600 .env
  green "  ✓ 已生成 .env（凭证以共享配置为准）"
fi

mkdir -p logs

# ---------- [6/7] 启动服务 ----------
echo ""
echo "[6/7] 启动服务"
node --check server.js || { red "  ✗ server.js 语法错误"; exit 1; }

if pm2 describe "$APP_NAME" >/dev/null 2>&1; then
  pm2 reload "$APP_NAME" --update-env
  green "  ✓ 已重载现有进程"
else
  pm2 start ecosystem.config.js
  green "  ✓ 已启动新进程"
fi
pm2 save >/dev/null 2>&1 || true
pm2 startup 2>/dev/null | grep -E "^sudo" | bash >/dev/null 2>&1 || true

# ---------- [7/7] 健康检查 + 简道云连通性 ----------
echo ""
echo "[7/7] 健康检查"
sleep 3
HEALTH=$(curl -s "http://127.0.0.1:$APP_PORT/api/health" || echo "")
if echo "$HEALTH" | grep -q '"status":"ok"'; then
  green "  ✓ 服务健康"
  echo "    $HEALTH"
else
  red "  ✗ 健康检查失败，查看日志：pm2 logs $APP_NAME --lines 50"
  exit 1
fi

echo ""
echo "  测试简道云连接 ..."
TESTRES=$(curl -s -X POST "http://127.0.0.1:$APP_PORT/api/jdy/test" -H "Content-Type: application/json" -d '{}' || echo "")
if echo "$TESTRES" | grep -q '"success":true'; then
  green "  ✓ 简道云连接成功"
else
  yellow "  ! 简道云连接未通过：$TESTRES"
  yellow "    可登录后台「简道云接口」页面重新配置并测试。"
fi

echo ""
green "=========================================="
green "  后台部署完成"
green "=========================================="
echo ""
echo "本机访问：http://127.0.0.1:$APP_PORT"
echo ""
echo "下一步："
echo "  1. 配置 Nginx：cp deploy/nginx.conf /etc/nginx/conf.d/bshhadmin.conf"
echo "     ★ 务必在配置里填上公司出口 IP 白名单，后台不应对全网开放"
echo "  2. 阿里云控制台安全组放行 80 / 443 端口"
echo ""
echo "常用命令："
echo "  pm2 logs $APP_NAME      查看日志"
echo "  pm2 restart $APP_NAME   重启"
echo "  bash deploy/update.sh   拉取更新并重载"
echo ""

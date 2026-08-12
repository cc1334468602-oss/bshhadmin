#!/usr/bin/env bash
# ============================================================
# setup-mysql.sh — 在阿里云 ECS 上安装并初始化数据库（MariaDB / MySQL 兼容）
#
# 说明：
#  - 采用 MariaDB（与 MySQL 完全兼容，mysql2 驱动通用，且阿里云默认源即可安装，国内可达）
#  - 创建数据库 bshh、应用账号 bshh（仅本机 127.0.0.1 可连），并导入表结构
#  - 幂等：重复执行不会破坏已有数据
#  - 连接信息写入 /tmp/bshh_db.env，供 deploy-ecs.sh 注入到 .env
#
# 用法：bash setup-mysql.sh
# ============================================================
set -e

green(){ echo -e "\033[32m$1\033[0m"; }
yellow(){ echo -e "\033[33m$1\033[0m"; }
red(){ echo -e "\033[31m$1\033[0m"; }

DB_NAME="bshh"
DB_USER="bshh"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_FILE=""
[ -f "$SCRIPT_DIR/../db/schema.sql" ] && SCHEMA_FILE="$SCRIPT_DIR/../db/schema.sql"
[ -z "$SCHEMA_FILE" ] && SCHEMA_FILE="/var/www/bshh/db/schema.sql"

echo ""; green ">>> 安装并初始化数据库（MariaDB / MySQL 兼容）"; echo ""

# 1) 安装服务端（幂等）
if ! command -v mysqld >/dev/null 2>&1 && ! command -v mariadbd >/dev/null 2>&1; then
  (dnf -y install mariadb-server >/dev/null 2>&1) || (yum -y install mariadb-server >/dev/null 2>&1) || {
    red "  ✗ 无法安装 mariadb-server，请手动安装后重跑本脚本"; exit 1;
  }
fi

# 2) 启动并设置开机自启
SVC="mariadb"
systemctl enable --now "$SVC" >/dev/null 2>&1 || { SVC="mysqld"; systemctl enable --now "$SVC" >/dev/null 2>&1 || true; }
sleep 3

# 3) 以 root（socket 认证）执行管理操作
MYSQL_ADMIN="mysql -u root"
if ! $MYSQL_ADMIN -e "SELECT 1;" >/dev/null 2>&1; then
  # 某些镜像 root 需要密码，尝试从文件读取
  if [ -f /root/.bshh_mysql_root ]; then
    MYSQL_ADMIN="mysql -u root -p$(cat /root/.bshh_mysql_root)"
  fi
fi

# 4) 数据库已存在则跳过初始化
if $MYSQL_ADMIN -e "USE ${DB_NAME};" >/dev/null 2>&1; then
  green "  ✓ 数据库 ${DB_NAME} 已存在，跳过初始化"
else
  DB_PASS="$(openssl rand -base64 18 | tr -dc 'A-Za-z0-9' | head -c 16)"
  $MYSQL_ADMIN <<SQL
CREATE DATABASE IF NOT EXISTS ${DB_NAME} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';
CREATE USER IF NOT EXISTS '${DB_USER}'@'127.0.0.1' IDENTIFIED BY '${DB_PASS}';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';
GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
  if [ -f "$SCHEMA_FILE" ]; then
    $MYSQL_ADMIN "${DB_NAME}" < "$SCHEMA_FILE"
    green "  ✓ 已导入表结构：$SCHEMA_FILE"
  else
    red "  ✗ 未找到 schema.sql（$SCHEMA_FILE），请确认仓库已克隆"
  fi
  echo "$DB_PASS" > /root/.bshh_mysql_dbpass; chmod 600 /root/.bshh_mysql_dbpass
fi

# 5) 导出连接信息
[ -f /root/.bshh_mysql_dbpass ] && DB_PASS="$(cat /root/.bshh_mysql_dbpass)"
cat > /tmp/bshh_db.env <<ENV
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASS=${DB_PASS}
DB_NAME=${DB_NAME}
ENV

# 6) 校验
if mysql -u "${DB_USER}" -p"${DB_PASS}" -h 127.0.0.1 -e "SELECT 1;" >/dev/null 2>&1; then
  green "  ✓ 应用账号 ${DB_USER}@127.0.0.1 连接正常"
else
  yellow "  ⚠ 应用账号连接校验未通过，请检查 MariaDB 是否监听 127.0.0.1（bind-address）"
fi

green "  ✓ 数据库初始化完成"
green "    连接信息已写入 /tmp/bshh_db.env"
echo ""

#!/usr/bin/env bash
# ==========================================================
# 在 ECS 上创建独立「测试库」bshh_test_db，并导入前后台全部表结构。
# 测试库与正式库 bshh_db 完全隔离，测试数据不会污染正式数据。
#
# 用法（二选一）：
#   MYSQL_ROOT_PASSWORD='wxbshh@2026' bash setup-test-db.sh   # 推荐，用 root 建库并授权
#   bash setup-test-db.sh                                        # 无 root 时用 bshh_user（需其有建库权限）
#
# 前置：已执行过 update.sh，/var/www/bshh 与 /var/www/bshhadmin 是最新代码
#       （schema.sql 已包含 admin_users 等全部表）。
# 后续：启动测试实例由 update.sh 的 pm2 自动完成（ecosystem 已含 *-test 实例）。
# ==========================================================
set -e

APP_USER='bshh_user'
APP_PASS='Bshh@2026'
TEST_DB='bshh_test_db'
ROOT_PW="${MYSQL_ROOT_PASSWORD:-}"

echo "==> 创建测试库 $TEST_DB 并授权 $APP_USER =="
if [ -n "$ROOT_PW" ]; then
  mysql -u root -p"$ROOT_PW" <<SQL
CREATE DATABASE IF NOT EXISTS \`$TEST_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
GRANT ALL PRIVILEGES ON \`$TEST_DB\`.* TO '$APP_USER'@'localhost';
FLUSH PRIVILEGES;
SQL
else
  mysql -u "$APP_USER" -p"$APP_PASS" -e "CREATE DATABASE IF NOT EXISTS \`$TEST_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;"
fi

echo "==> 导入表结构（前台 bshh + 后台 bshhadmin，均为 IF NOT EXISTS，可重复执行）==="
mysql -u "$APP_USER" -p"$APP_PASS" "$TEST_DB" < /var/www/bshh/db/schema.sql
mysql -u "$APP_USER" -p"$APP_PASS" "$TEST_DB" < /var/www/bshhadmin/db/schema.sql

echo "==> 创建独立共享配置目录（避免测试改简道云配置影响正式）==="
mkdir -p /var/www/shared-test

echo "✅ 测试库 $TEST_DB 已就绪。启动测试实例（pm2 由 update.sh 拉起）后会自动种子数据（含 admin/111111）。"

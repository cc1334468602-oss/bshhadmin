#!/usr/bin/env bash
# ==========================================================
# 在 ECS 上创建独立「测试库」bshh_test_db，并导入前后台全部表结构。
# 测试库与正式库 bshh_db 完全隔离，测试数据不会污染正式数据。
#
# 用法：
#   bash setup-test-db.sh                                          # 优先用应用账号 bshh_user（本机 root 不可达时用）
#   MYSQL_ROOT_PASSWORD='真实root密码' bash setup-test-db.sh        # 若 bshh_user 无建库权限，可显式传 root 密码
#
# 前置：已执行过 update.sh，/var/www/bshh 与 /var/www/bshhadmin 是最新代码
#       （schema.sql 已包含 admin_users 等全部表）。
# 后续：启动测试实例由 update.sh 的 pm2 自动完成（ecosystem 已含 *-test 实例）。
#
# 重要：两个 schema.sql 顶部都带 `CREATE DATABASE bshh_db; USE bshh_db;`，
#       直接导入会把表写进【正式库】！本脚本在导入前用 sed 剥掉这两行，
#       并把表结构导入到命令行选定的 $TEST_DB 中。
# ==========================================================
set -e

APP_USER="${DB_USER:-bshh_user}"
APP_PASS="${DB_PASS:-Bshh@2026}"
TEST_DB="${BSHH_TEST_DB:-bshh_test_db}"
ROOT_PW="${MYSQL_ROOT_PASSWORD:-}"

echo "==> 应用账号 $APP_USER 的权限（用于判断是否可建库/授权）："
mysql -u "$APP_USER" -p"$APP_PASS" -e "SHOW GRANTS FOR CURRENT_USER();" 2>&1 | sed 's/^/    /' || true

# 用给定 mysql 调用前缀建库 + 授权；成功返回 0，失败返回 1
mkdb() {
  local CMD="$1"
  echo "==> 尝试用 [$CMD] 创建测试库并授权 $APP_USER =="
  $CMD -e "CREATE DATABASE IF NOT EXISTS \`$TEST_DB\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;" || return 1
  # 授权：兼容 localhost / 127.0.0.1 / 通配，失败不致命（若账号已是全局权限则无需授权）
  $CMD -e "GRANT ALL PRIVILEGES ON \`$TEST_DB\`.* TO '$APP_USER'@'localhost';" 2>/dev/null || \
  $CMD -e "GRANT ALL PRIVILEGES ON \`$TEST_DB\`.* TO '$APP_USER'@'127.0.0.1';" 2>/dev/null || \
  $CMD -e "GRANT ALL PRIVILEGES ON \`$TEST_DB\`.* TO '$APP_USER'@'%';" 2>/dev/null || true
  return 0
}

OK=0
# 1) 先试应用账号（本机 root 通常不可达）
if mkdb "mysql -u $APP_USER -p$APP_PASS"; then OK=1; fi
# 2) 再试 root（显式密码 / sudo socket / 无密 socket）
if [ "$OK" = "0" ] && [ -n "$ROOT_PW" ]; then
  if mkdb "mysql -u root -p$ROOT_PW"; then OK=1; fi
fi
if [ "$OK" = "0" ]; then
  if mkdb "sudo mysql -u root" 2>/dev/null; then OK=1; fi
fi
if [ "$OK" = "0" ]; then
  if mkdb "mysql -u root" 2>/dev/null; then OK=1; fi
fi
if [ "$OK" = "0" ]; then
  echo "❌ 无法创建测试库：应用账号 $APP_USER 无建库权限，且 root 不可用。"
  echo "   请获取真实 root 密码后重试： MYSQL_ROOT_PASSWORD='真实密码' bash $0"
  exit 1
fi

echo "==> 导入表结构到 $TEST_DB（已剥离 CREATE DATABASE/USE，避免污染正式库 bshh_db）==="
sed -e '/CREATE DATABASE/d' -e '/^USE /d' /var/www/bshh/db/schema.sql      | mysql -u "$APP_USER" -p"$APP_PASS" "$TEST_DB"
sed -e '/CREATE DATABASE/d' -e '/^USE /d' /var/www/bshhadmin/db/schema.sql | mysql -u "$APP_USER" -p"$APP_PASS" "$TEST_DB"

echo "==> 创建独立共享配置目录（避免测试改简道云配置影响正式）==="
mkdir -p /var/www/shared-test
if [ -f /var/www/shared/jdy-config.json ]; then
  cp /var/www/shared/jdy-config.json /var/www/shared-test/jdy-config.json
  echo "==> 已复制正式简道云配置到 /var/www/shared-test/jdy-config.json（测试实例 jdyReady 将变为 true）"
else
  echo "⚠️  未找到 /var/www/shared/jdy-config.json，测试实例 jdyReady 会为 false；不影响数据库功能。如需测试简道云接口，请手动复制正式配置到 /var/www/shared-test/。"
fi

echo ""
echo "✅ 测试库 $TEST_DB 已就绪。"
echo "   请重启测试实例使其重连： pm2 restart bshh-test bshh-admin-test"
echo "   验证： curl -s http://127.0.0.1:9194/api/health   （db.connected 应为 true）"

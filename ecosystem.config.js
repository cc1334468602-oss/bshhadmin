/**
 * PM2 进程配置 —— bshhadmin 管理后台
 * 启动：pm2 start ecosystem.config.js
 */
module.exports = {
  apps: [
    {
      name: 'bshh-admin',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 9192,
        // 生产环境只监听本地，由 Nginx 反向代理对外
        HOST: '127.0.0.1',
        // 与前台 bshh 共用同一份配置，此处写入后前台即时生效
        JDY_CONFIG_PATH: '/var/www/shared/jdy-config.json',
      },
      error_file: './logs/err.log',
      out_file: './logs/out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
    // ---------- 测试环境实例：连独立测试库 bshh_test_db，与正式库隔离 ----------
    {
      name: 'bshh-admin-test',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '300M',
      env: {
        NODE_ENV: 'production',
        PORT: 9194,
        HOST: '127.0.0.1',
        // 仅覆盖库名与共享配置路径，其余（DB_HOST/USER/PASS）复用同一 .env
        DB_NAME: 'bshh_test_db',
        // 独立的简道云配置，避免测试改动影响正式
        JDY_CONFIG_PATH: '/var/www/shared-test/jdy-config.json',
      },
      error_file: './logs/err-test.log',
      out_file: './logs/out-test.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
    },
  ],
};

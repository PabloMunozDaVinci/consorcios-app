// =============================================================================
// PM2 Ecosystem Configuration
// =============================================================================
module.exports = {
  apps: [
    {
      name: 'consorcios-app',
      script: 'node_modules/next/dist/bin/next',
      args: 'start',
      cwd: '/home/pablo/consorcios-app',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
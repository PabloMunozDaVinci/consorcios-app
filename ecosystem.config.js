// =============================================================================
// PM2 Ecosystem Configuration
// =============================================================================
// NOTE: Run this from the repo root with: pm2 start ecosystem.config.js
// PM2 will use the directory of this file as the working directory by default.
// The app uses Next.js with 'output: standalone', so it runs the prebuilt
// server at .next/standalone/server.js (not 'next start').
// Ensure .env.local or production environment variables are set in the
// environment before starting PM2 (they won't be read from disk by the
// standalone server unless explicitly copied to .next/standalone/.env.local).
module.exports = {
  apps: [
    {
      name: 'consorcios-app',
      script: '.next/standalone/server.js',
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
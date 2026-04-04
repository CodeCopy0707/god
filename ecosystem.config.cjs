// ecosystem.config.cjs — PM2 production configuration
// Note: Uses .cjs extension to work in ESM ("type":"module") projects

module.exports = {
  apps: [
    {
      name:        'payment-matcher',
      script:      'dist/index.js',
      interpreter: 'node',

      // Single process — concurrency handled internally with async loops
      instances:  1,
      exec_mode:  'fork',

      // Auto-restart on crash
      autorestart:         true,
      watch:               false,
      max_memory_restart:  '300M',

      // Restart back-off strategy
      restart_delay:  2000,   // ms before restarting
      max_restarts:   10,
      min_uptime:     '5s',

      // Log settings
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      error_file:  'logs/err.log',
      out_file:    'logs/out.log',
      merge_logs:  true,

      // Environment
      env: {
        NODE_ENV: 'development',
      },
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};

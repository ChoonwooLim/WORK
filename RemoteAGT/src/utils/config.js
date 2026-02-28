// src/utils/config.js
// Centralized configuration management
import 'dotenv/config';

const config = {
  port: parseInt(process.env.PORT || '4100'),
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: (process.env.NODE_ENV || 'development') !== 'production',

  // Database
  db: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'devuser',
    password: process.env.DB_PASSWORD || 'devpass123',
    database: process.env.DB_NAME || 'devdb',
  },

  // Redis
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
  },

  // Telegram
  telegram: {
    botToken: process.env.TELEGRAM_BOT_TOKEN || '',
    adminId: process.env.TELEGRAM_ADMIN_ID || '',
  },

  // Orbitron
  orbitron: {
    apiUrl: process.env.ORBITRON_API_URL || 'http://localhost:4000/api',
    apiKey: process.env.ORBITRON_API_KEY || '',
  },

  // Security
  jwt: {
    secret: process.env.JWT_SECRET || 'remoteagt_dev_secret',
    expiresIn: '7d',
  },

  // Monitoring
  monitor: {
    collectInterval: parseInt(process.env.METRIC_COLLECT_INTERVAL || '30000'),
    alertCooldown: parseInt(process.env.ALERT_COOLDOWN || '300000'),
  },

  // Workspace
  workspace: process.env.AGT_WORKSPACE_PATH || '/home/stevenlim/WORK',
};

export default config;

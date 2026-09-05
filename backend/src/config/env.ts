import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  databasePath: process.env.DATABASE_PATH || './data/merchantos.db',
  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_XXXXXXXXXXXXXXXX',
    keySecret: process.env.RAZORPAY_KEY_SECRET || 'YOUR_SECRET_HERE',
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET || 'YOUR_WEBHOOK_SECRET',
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    enabled: !!process.env.OPENAI_API_KEY,
  },
  jwtSecret: process.env.JWT_SECRET || 'merchantos-jwt-secret-change-me',
};

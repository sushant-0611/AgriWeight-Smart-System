import dotenv from 'dotenv'

dotenv.config()

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || '',
  deviceApiKey: process.env.DEVICE_API_KEY || '',
  defaultDeviceId: (process.env.DEFAULT_DEVICE_ID || 'AGRIWEIGHT-01').trim(),
  offlineTimeoutMs: Number(process.env.OFFLINE_TIMEOUT_MS || 15000),
}

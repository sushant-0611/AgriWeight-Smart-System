import dotenv from 'dotenv'

dotenv.config()

function listFromEnv(value) {
  if (!value) return []
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || '',
  // Optional custom resolvers for networks whose local DNS server refuses
  // MongoDB Atlas SRV lookups. Leave empty to use the system resolvers.
  mongoDnsServers: listFromEnv(process.env.MONGODB_DNS_SERVERS),
  deviceApiKey: process.env.DEVICE_API_KEY || '',
  defaultDeviceId: (process.env.DEFAULT_DEVICE_ID || 'AGRIWEIGHT-01').trim(),
  offlineTimeoutMs: Number(process.env.OFFLINE_TIMEOUT_MS || 45000),
}

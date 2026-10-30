import dotenv from 'dotenv'

dotenv.config()

// The client requires a fixed set of exactly ten registered farmer IDs, each
// four digits. Only these IDs may be entered from the hardware; any other ID
// is rejected and nothing is stored for it.
const DEFAULT_REGISTERED_FARMER_IDS = [
  '1001', '1002', '1003', '1004', '1005',
  '1006', '1007', '1008', '1009', '1010',
]

const registeredFarmerIds = process.env.REGISTERED_FARMER_IDS
  ? process.env.REGISTERED_FARMER_IDS.split(',')
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  : DEFAULT_REGISTERED_FARMER_IDS

export const config = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI || '',
  deviceApiKey: process.env.DEVICE_API_KEY || '',
  defaultDeviceId: (process.env.DEFAULT_DEVICE_ID || 'AGRIWEIGHT-01').trim(),
  offlineTimeoutMs: Number(process.env.OFFLINE_TIMEOUT_MS || 15000),
  registeredFarmerIds,
}

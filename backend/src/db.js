import dns from 'node:dns'
import mongoose from 'mongoose'
import { config } from './config.js'

export async function connectDb(uri) {
  if (!uri) {
    throw new Error('MONGODB_URI is not set. Copy .env.example to .env and fill it in.')
  }

  if (config.mongoDnsServers.length) {
    dns.setServers(config.mongoDnsServers)
    console.log(`[db] using DNS resolvers: ${config.mongoDnsServers.join(', ')}`)
  }

  mongoose.connection.on('connected', () => {
    console.log('[db] MongoDB connected')
  })
  mongoose.connection.on('error', (err) => {
    console.error('[db] MongoDB error:', err.message)
  })
  mongoose.connection.on('disconnected', () => {
    console.warn('[db] MongoDB disconnected')
  })

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 })
}

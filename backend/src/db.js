import mongoose from 'mongoose'

export async function connectDb(uri) {
  if (!uri) {
    console.error('[db] MONGODB_URI is not set. Copy .env.example to .env and fill it in.')
    process.exit(1)
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

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
}

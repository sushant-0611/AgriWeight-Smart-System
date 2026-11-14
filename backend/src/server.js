import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { connectDb } from './db.js'
import Farmer from './models/Farmer.js'
import Device from './models/Device.js'
import WeighingRecord from './models/WeighingRecord.js'
import devicesRouter from './routes/devices.js'
import weighingsRouter from './routes/weighings.js'
import farmersRouter from './routes/farmers.js'
import dashboardRouter from './routes/dashboard.js'
import { errorHandler, notFound } from './middleware/errorHandler.js'

const app = express()

app.use(cors())
app.use(express.json({ limit: '16kb' }))

app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', time: new Date().toISOString() } })
})

app.use('/api/devices', devicesRouter)
app.use('/api/weighings', weighingsRouter)
app.use('/api/farmers', farmersRouter)
app.use('/api/dashboard', dashboardRouter)

app.use(notFound)
app.use(errorHandler)

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection:', reason)
})

try {
  await connectDb(config.mongoUri)
  // Wait for unique/partial indexes (Farmer ID, Aadhaar, device IDs) before
  // accepting traffic so duplicate-protection is active from the first write.
  await Promise.all([Farmer.init(), Device.init(), WeighingRecord.init()])
} catch (err) {
  console.error('[startup] Could not start the backend:', err.message)
  process.exit(1)
}

app.listen(config.port, () => {
  console.log(`AgriWeight backend running at http://localhost:${config.port}`)
})

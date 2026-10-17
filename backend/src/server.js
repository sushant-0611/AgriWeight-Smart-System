import express from 'express'
import cors from 'cors'
import { config } from './config.js'
import { connectDb } from './db.js'
import devicesRouter from './routes/devices.js'
import weighingsRouter from './routes/weighings.js'
import farmersRouter from './routes/farmers.js'
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

app.use(notFound)
app.use(errorHandler)

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandled rejection:', reason)
})

await connectDb(config.mongoUri)

app.listen(config.port, () => {
  console.log(`AgriWeight backend running at http://localhost:${config.port}`)
})

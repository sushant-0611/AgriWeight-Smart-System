import { Router } from 'express'
import Device from '../models/Device.js'
import WeighingRecord from '../models/WeighingRecord.js'
import { deviceAuth } from '../middleware/deviceAuth.js'
import { config } from '../config.js'
import { round2, round3 } from '../utils/money.js'
import {
  asyncHandler,
  badRequest,
  normalizeFarmerId,
  normalizeMode,
} from '../utils/http.js'
import { farmerSummaryById, serializeRecord } from '../utils/serializers.js'
import { isRegisteredFarmerId } from '../utils/farmers.js'

const router = Router()

// POST /api/devices/telemetry — ESP32 heartbeat with current state.
router.post(
  '/telemetry',
  deviceAuth,
  asyncHandler(async (req, res) => {
    const { device_id, net_weight_kg, mode, farmer_id, price_per_kg } =
      req.body || {}

    if (typeof device_id !== 'string' || !device_id.trim()) {
      throw badRequest('device_id is required')
    }

    const weight = Number(net_weight_kg)
    if (!Number.isFinite(weight)) {
      throw badRequest('net_weight_kg must be a number')
    }

    let farmerId = farmer_id ? normalizeFarmerId(farmer_id) : null
    if (farmerId && !isRegisteredFarmerId(farmerId)) {
      // Never store an unregistered farmer ID in telemetry. Ignoring it keeps
      // the heartbeat (and online status) alive while guaranteeing that only
      // registered farmers ever appear in the system.
      farmerId = null
    }

    const price =
      price_per_kg !== undefined && price_per_kg !== null && price_per_kg !== ''
        ? Number(price_per_kg)
        : null
    if (price !== null && (!Number.isFinite(price) || price < 0)) {
      throw badRequest('price_per_kg must be a non-negative number')
    }

    const now = new Date()
    const device = await Device.findOneAndUpdate(
      { device_id: device_id.trim() },
      {
        $set: {
          last_seen_at: now,
          telemetry: {
            net_weight_kg: round3(weight),
            mode: normalizeMode(mode),
            farmer_id: farmerId,
            price_per_kg: price !== null ? round2(price) : null,
            updated_at: now,
          },
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({
      success: true,
      data: { deviceId: device.device_id, lastSeenAt: device.last_seen_at },
    })
  })
)

// GET /api/devices/:deviceId/status — dashboard poll endpoint.
router.get(
  '/:deviceId/status',
  asyncHandler(async (req, res) => {
    const deviceId = String(req.params.deviceId || '').trim()
    if (!deviceId) throw badRequest('deviceId is required')

    const device = await Device.findOne({ device_id: deviceId }).lean()
    const now = new Date()

    let online = false
    let lastSeenAt = null
    let telemetry = null

    if (device && device.last_seen_at) {
      lastSeenAt = device.last_seen_at
      online =
        now.getTime() - new Date(lastSeenAt).getTime() <=
        config.offlineTimeoutMs
      if (device.telemetry) {
        telemetry = {
          netWeightKg: device.telemetry.net_weight_kg,
          mode: device.telemetry.mode,
          farmerId: device.telemetry.farmer_id,
          pricePerKg: device.telemetry.price_per_kg,
          updatedAt: device.telemetry.updated_at,
        }
      }
    }

    let farmerSummary = null
    if (telemetry && telemetry.farmerId) {
      farmerSummary = await farmerSummaryById(telemetry.farmerId)
    }

    const lastRecordDoc = await WeighingRecord.findOne({
      device_id: deviceId,
    })
      .sort({ created_at: -1, _id: -1 })
      .lean()

    res.json({
      success: true,
      data: {
        deviceId,
        online,
        lastSeenAt,
        serverTime: now.toISOString(),
        telemetry,
        farmerSummary,
        lastRecord: lastRecordDoc ? serializeRecord(lastRecordDoc) : null,
      },
    })
  })
)

export default router

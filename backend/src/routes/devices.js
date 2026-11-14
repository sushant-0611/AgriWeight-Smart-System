import { Router } from 'express'
import Device from '../models/Device.js'
import Farmer from '../models/Farmer.js'
import WeighingRecord from '../models/WeighingRecord.js'
import { deviceAuth } from '../middleware/deviceAuth.js'
import { config } from '../config.js'
import { round2, round3 } from '../utils/money.js'
import {
  asyncHandler,
  badRequest,
  conflict,
  normalizeFarmerId,
  normalizeMode,
  notFound,
} from '../utils/http.js'
import {
  farmerSummaryById,
  serializeDevice,
  serializeFarmer,
  serializeRecord,
} from '../utils/serializers.js'
import { farmerExists } from '../utils/farmers.js'

const router = Router()

const INVALID_FARMER_MESSAGE = 'Invalid Farmer ID. Farmer is not registered.'

async function farmersForDevices(devices) {
  const ids = [...new Set(devices.map((d) => d.assigned_farmer_id).filter(Boolean))]
  if (!ids.length) return new Map()
  const farmers = await Farmer.find({ farmer_id: { $in: ids } }).lean()
  return new Map(farmers.map((farmer) => [farmer.farmer_id, farmer]))
}

// GET /api/devices — devices known to the system with assignment state.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const devices = await Device.find({}).sort({ created_at: -1, _id: -1 }).lean()
    const farmerMap = await farmersForDevices(devices)
    const now = new Date()
    res.json({
      success: true,
      data: devices.map((device) =>
        serializeDevice(device, { farmer: farmerMap.get(device.assigned_farmer_id), now })
      ),
    })
  })
)

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
    if (farmerId && !(await farmerExists(farmerId))) {
      // Keep the heartbeat (and online status) alive, but never attach an
      // unregistered farmer ID to telemetry.
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

// POST /api/devices/:deviceId/assign — link a device to a registered farmer.
// Upserts the device so a device can be assigned before its first heartbeat.
router.post(
  '/:deviceId/assign',
  asyncHandler(async (req, res) => {
    const deviceId = String(req.params.deviceId || '').trim()
    if (!deviceId) throw badRequest('Device ID is required.')

    const farmerId = normalizeFarmerId(req.body?.farmerId ?? req.body?.farmer_id)
    if (!farmerId) throw badRequest('Farmer ID is required for assignment.')

    const farmer = await Farmer.findOne({ farmer_id: farmerId }).lean()
    if (!farmer) throw notFound(INVALID_FARMER_MESSAGE)

    const otherDevice = await Device.findOne({
      assigned_farmer_id: farmerId,
      device_id: { $ne: deviceId },
    })
      .select('device_id')
      .lean()
    if (otherDevice) {
      throw conflict(
        `Farmer ${farmerId} is already assigned to device ${otherDevice.device_id}. Unassign it first.`
      )
    }

    const now = new Date()
    const device = await Device.findOneAndUpdate(
      { device_id: deviceId },
      {
        $set: { assigned_farmer_id: farmerId, assigned_at: now },
        $setOnInsert: { device_id: deviceId },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    )

    res.json({
      success: true,
      data: {
        message: `Device ${deviceId} assigned to farmer ${farmerId}.`,
        device: serializeDevice(device, { farmer }),
      },
    })
  })
)

// DELETE /api/devices/:deviceId/assign — remove the farmer mapping.
router.delete(
  '/:deviceId/assign',
  asyncHandler(async (req, res) => {
    const deviceId = String(req.params.deviceId || '').trim()
    if (!deviceId) throw badRequest('Device ID is required.')

    const device = await Device.findOneAndUpdate(
      { device_id: deviceId },
      { $set: { assigned_farmer_id: null, assigned_at: null } },
      { new: true }
    )
    if (!device) throw notFound(`Device ${deviceId} not found`)

    res.json({
      success: true,
      data: {
        message: `Device ${deviceId} unassigned.`,
        device: serializeDevice(device),
      },
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

    const profileFarmerId = telemetry?.farmerId || device?.assigned_farmer_id || null
    const [profileFarmer, farmerSummary, lastRecordDoc] = await Promise.all([
      profileFarmerId ? Farmer.findOne({ farmer_id: profileFarmerId }).lean() : null,
      profileFarmerId ? farmerSummaryById(profileFarmerId) : null,
      WeighingRecord.findOne({ device_id: deviceId })
        .sort({ created_at: -1, _id: -1 })
        .lean(),
    ])

    res.json({
      success: true,
      data: {
        deviceId,
        online,
        lastSeenAt,
        serverTime: now.toISOString(),
        telemetry,
        farmerProfile: profileFarmer ? serializeFarmer(profileFarmer) : null,
        assignedFarmerId: device?.assigned_farmer_id || null,
        assignedAt: device?.assigned_at || null,
        farmerSummary,
        lastRecord: lastRecordDoc ? serializeRecord(lastRecordDoc) : null,
      },
    })
  })
)

export default router

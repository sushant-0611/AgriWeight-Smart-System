import { Router } from 'express'
import Farmer from '../models/Farmer.js'
import WeighingRecord from '../models/WeighingRecord.js'
import { deviceAuth } from '../middleware/deviceAuth.js'
import { config } from '../config.js'
import { computeAmount, round2, round3 } from '../utils/money.js'
import {
  asyncHandler,
  badRequest,
  normalizeFarmerId,
  normalizeMode,
  parsePageQuery,
} from '../utils/http.js'
import { serializeRecord } from '../utils/serializers.js'

const router = Router()

// POST /api/weighings — save one completed weighing from the ESP32.
router.post(
  '/',
  deviceAuth,
  asyncHandler(async (req, res) => {
    const { farmer_id, weight_kg, price_per_kg, device_id, mode, record_key } =
      req.body || {}

    const farmerId = normalizeFarmerId(farmer_id)
    if (!farmerId || farmerId.length > 32) {
      throw badRequest('A valid farmer_id is required (max 32 characters)')
    }

    const weight = Number(weight_kg)
    if (!Number.isFinite(weight) || weight <= 0 || weight > 100000) {
      throw badRequest('weight_kg must be a number greater than 0')
    }

    const price = Number(price_per_kg)
    if (!Number.isFinite(price) || price <= 0 || price > 1000000) {
      throw badRequest('price_per_kg must be a number greater than 0')
    }

    const deviceId =
      typeof device_id === 'string' && device_id.trim()
        ? device_id.trim()
        : config.defaultDeviceId

    const recordKey =
      typeof record_key === 'string' && record_key.trim()
        ? record_key.trim().slice(0, 64)
        : null

    // Safe retry: if this record_key was already saved, return it unchanged.
    if (recordKey) {
      const existing = await WeighingRecord.findOne({
        device_id: deviceId,
        record_key: recordKey,
      }).lean()
      if (existing) {
        return res.json({
          success: true,
          data: { record: serializeRecord(existing), duplicate: true },
        })
      }
    }

    // Atomic upsert — concurrent requests never create duplicate farmers.
    let farmer
    try {
      farmer = await Farmer.findOneAndUpdate(
        { farmer_id: farmerId },
        { $setOnInsert: { farmer_id: farmerId } },
        { upsert: true, new: true }
      )
    } catch (err) {
      if (err && err.code === 11000) {
        farmer = await Farmer.findOne({ farmer_id: farmerId })
      }
      if (!farmer) throw err
    }

    const weightKg = round3(weight)
    const pricePerKg = round2(price)
    const record = await WeighingRecord.create({
      farmer_ref: farmer._id,
      farmer_id: farmer.farmer_id,
      device_id: deviceId,
      weight_kg: weightKg,
      price_per_kg: pricePerKg,
      total_amount: computeAmount(weightKg, pricePerKg),
      mode: normalizeMode(mode),
      record_key: recordKey,
    })

    console.log(
      `[weighing] saved: ${farmer.farmer_id} ${weightKg} kg @ ₹${pricePerKg}/kg = ₹${record.total_amount} (${deviceId})`
    )

    res.status(201).json({
      success: true,
      data: { record: serializeRecord(record), duplicate: false },
    })
  })
)

// GET /api/weighings — recent records with optional filters.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { page, limit } = parsePageQuery(req.query)
    const filter = {}
    if (req.query.farmer_id) {
      filter.farmer_id = normalizeFarmerId(req.query.farmer_id)
    }
    if (req.query.device_id) filter.device_id = String(req.query.device_id).trim()

    const total = await WeighingRecord.countDocuments(filter)
    const docs = await WeighingRecord.find(filter)
      .sort({ created_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    res.json({
      success: true,
      data: {
        records: docs.map(serializeRecord),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
      },
    })
  })
)

export default router

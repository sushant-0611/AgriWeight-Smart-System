import { Router } from 'express'
import Farmer from '../models/Farmer.js'
import Device from '../models/Device.js'
import WeighingRecord from '../models/WeighingRecord.js'
import {
  asyncHandler,
  badRequest,
  conflict,
  normalizeFarmerId,
  notFound,
  parsePageQuery,
} from '../utils/http.js'
import {
  allFarmerSummaries,
  farmerSummaryById,
  serializeFarmer,
  serializeRecord,
} from '../utils/serializers.js'
import {
  findFarmer,
  findFarmerByAadhaar,
  generateNextFarmerId,
  isDuplicateKeyError,
} from '../utils/farmers.js'
import { parseFarmerCreate, parseFarmerUpdate } from '../utils/validators.js'

const router = Router()

const INVALID_FARMER_MESSAGE = 'Invalid Farmer ID. Farmer is not registered.'

async function assignmentMap() {
  const devices = await Device.find({ assigned_farmer_id: { $ne: null } })
    .select('device_id assigned_farmer_id')
    .lean()
  const map = new Map()
  for (const device of devices) {
    map.set(device.assigned_farmer_id, device.device_id)
  }
  return map
}

// GET /api/farmers — registered farmers with cumulative weighing totals.
// Optional filters: q (name/ID/mobile), village, status.
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const filter = {}
    const q = String(req.query.q || '').trim()
    const village = String(req.query.village || '').trim()
    const status = String(req.query.status || '').trim().toLowerCase()

    if (q) {
      const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
      filter.$or = [
        { farmer_id: pattern },
        { full_name: pattern },
        { mobile_number: pattern },
        { village: pattern },
      ]
    }
    if (village) filter.village = new RegExp(`^${village.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
    if (status === 'active') filter.status = { $ne: 'inactive' }
    if (status === 'inactive') filter.status = 'inactive'

    const [farmers, summaries, assignments] = await Promise.all([
      Farmer.find(filter).sort({ created_at: -1, _id: -1 }).lean(),
      allFarmerSummaries(),
      assignmentMap(),
    ])

    const summaryMap = new Map(summaries.map((row) => [row.farmerId, row]))

    const data = farmers.map((farmer) => {
      const summary = summaryMap.get(farmer.farmer_id)
      return {
        ...serializeFarmer(farmer),
        recordCount: summary?.recordCount || 0,
        totalWeightKg: summary?.totalWeightKg || 0,
        totalAmount: summary?.totalAmount || 0,
        lastRecordAt: summary?.lastRecordAt || null,
        assignedDeviceId: assignments.get(farmer.farmer_id) || null,
      }
    })

    res.json({ success: true, data })
  })
)

// GET /api/farmers/next-id — next available numeric Farmer ID.
router.get(
  '/next-id',
  asyncHandler(async (_req, res) => {
    res.json({ success: true, data: { farmerId: await generateNextFarmerId() } })
  })
)

// POST /api/farmers/verify — hardware operator checks a Farmer ID before
// assigning a device. Never creates a farmer.
router.post(
  '/verify',
  asyncHandler(async (req, res) => {
    const farmerId = normalizeFarmerId(req.body?.farmerId ?? req.body?.farmer_id)
    if (!farmerId) throw badRequest('Enter a Farmer ID to verify.')

    const farmer = await findFarmer(farmerId)
    if (!farmer) {
      const err = notFound(INVALID_FARMER_MESSAGE)
      throw err
    }

    const [summary, device, recordCount] = await Promise.all([
      farmerSummaryById(farmer.farmer_id),
      Device.findOne({ assigned_farmer_id: farmer.farmer_id }).select('device_id').lean(),
      WeighingRecord.countDocuments({ farmer_id: farmer.farmer_id }),
    ])

    res.json({
      success: true,
      data: {
        message: 'Farmer verified successfully.',
        farmer: serializeFarmer(farmer),
        assignedDeviceId: device?.device_id || null,
        recordCount: summary?.recordCount ?? recordCount,
      },
    })
  })
)

// POST /api/farmers — register a new farmer.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    const values = parseFarmerCreate(req.body)

    let farmerId = values.farmerId
    if (farmerId) {
      if (await Farmer.exists({ farmer_id: farmerId })) {
        throw conflict(`Farmer ID ${farmerId} is already registered.`)
      }
    }

    if (values.aadhaarNumber) {
      const duplicate = await findFarmerByAadhaar(values.aadhaarNumber)
      if (duplicate) {
        throw conflict(
          `This Aadhaar number is already registered to farmer ${duplicate.farmer_id}.`
        )
      }
    }

    let farmer = null
    for (let attempt = 0; attempt < 5 && !farmer; attempt += 1) {
      if (!farmerId) farmerId = await generateNextFarmerId()

      try {
        farmer = await Farmer.create({
          farmer_id: farmerId,
          full_name: values.fullName,
          mobile_number: values.mobileNumber,
          village: values.village,
          address: values.address,
          aadhaar_number: values.aadhaarNumber,
          land_area_acres: values.landAreaAcres,
          crop_type: values.cropType,
          status: values.status,
        })
      } catch (err) {
        if (isDuplicateKeyError(err, 'farmer_id') && !values.farmerId) {
          farmerId = null
          continue
        }
        if (isDuplicateKeyError(err, 'farmer_id')) {
          throw conflict(`Farmer ID ${farmerId} is already registered.`)
        }
        if (isDuplicateKeyError(err, 'aadhaar_number')) {
          throw conflict('This Aadhaar number is already registered to another farmer.')
        }
        throw err
      }
    }

    if (!farmer) {
      throw conflict('Could not generate a unique Farmer ID. Please try again.')
    }

    res.status(201).json({
      success: true,
      data: {
        message: `Farmer ${farmer.farmer_id} registered successfully.`,
        farmer: serializeFarmer(farmer, { includeAadhaar: true }),
      },
    })
  })
)

// GET /api/farmers/:farmerId — full farmer profile (includes Aadhaar for the
// admin edit form).
router.get(
  '/:farmerId',
  asyncHandler(async (req, res) => {
    const farmer = await findFarmer(req.params.farmerId)
    if (!farmer) throw notFound(`Farmer ${normalizeFarmerId(req.params.farmerId)} not found`)

    const [device, summary] = await Promise.all([
      Device.findOne({ assigned_farmer_id: farmer.farmer_id }).select('device_id').lean(),
      farmerSummaryById(farmer.farmer_id),
    ])

    res.json({
      success: true,
      data: {
        ...serializeFarmer(farmer, { includeAadhaar: true }),
        assignedDeviceId: device?.device_id || null,
        summary: summary || {
          farmerId: farmer.farmer_id,
          recordCount: 0,
          totalWeightKg: 0,
          totalAmount: 0,
          latestPricePerKg: null,
        },
      },
    })
  })
)

// PATCH /api/farmers/:farmerId — edit profile. The Farmer ID itself is
// immutable because hardware records reference it.
router.patch(
  '/:farmerId',
  asyncHandler(async (req, res) => {
    const farmerId = normalizeFarmerId(req.params.farmerId)
    const farmer = await Farmer.findOne({ farmer_id: farmerId })
    if (!farmer) throw notFound(`Farmer ${farmerId} not found`)

    const values = parseFarmerUpdate(req.body)
    if (values.farmerId && values.farmerId !== farmer.farmer_id) {
      throw badRequest('Farmer ID cannot be changed. Create a new farmer instead.')
    }
    delete values.farmerId

    if (values.aadhaarNumber) {
      const duplicate = await findFarmerByAadhaar(values.aadhaarNumber, farmer.farmer_id)
      if (duplicate) {
        throw conflict(
          `This Aadhaar number is already registered to farmer ${duplicate.farmer_id}.`
        )
      }
    }

    farmer.full_name = values.fullName ?? farmer.full_name
    farmer.mobile_number = values.mobileNumber ?? farmer.mobile_number
    farmer.village = values.village ?? farmer.village
    if (values.address !== undefined) farmer.address = values.address
    if (values.aadhaarNumber !== undefined) farmer.aadhaar_number = values.aadhaarNumber
    if (values.landAreaAcres !== undefined) farmer.land_area_acres = values.landAreaAcres
    if (values.cropType !== undefined) farmer.crop_type = values.cropType
    if (values.status !== undefined) farmer.status = values.status

    try {
      await farmer.save()
    } catch (err) {
      if (isDuplicateKeyError(err, 'aadhaar_number')) {
        throw conflict('This Aadhaar number is already registered to another farmer.')
      }
      throw err
    }

    res.json({
      success: true,
      data: {
        message: `Farmer ${farmer.farmer_id} updated successfully.`,
        farmer: serializeFarmer(farmer, { includeAadhaar: true }),
      },
    })
  })
)

// DELETE /api/farmers/:farmerId — remove the farmer and release any assigned
// device. Past weighing records are intentionally kept for audit.
router.delete(
  '/:farmerId',
  asyncHandler(async (req, res) => {
    const farmerId = normalizeFarmerId(req.params.farmerId)
    const farmer = await Farmer.findOne({ farmer_id: farmerId }).lean()
    if (!farmer) throw notFound(`Farmer ${farmerId} not found`)

    const [recordCount, releasedDevices] = await Promise.all([
      WeighingRecord.countDocuments({ farmer_id: farmerId }),
      Device.updateMany(
        { assigned_farmer_id: farmerId },
        { $set: { assigned_farmer_id: null, assigned_at: null } }
      ),
    ])
    await Farmer.deleteOne({ farmer_id: farmerId })

    res.json({
      success: true,
      data: {
        message: `Farmer ${farmerId} deleted.`,
        farmerId,
        releasedDevices: releasedDevices.modifiedCount || 0,
        retainedWeighingRecords: recordCount,
      },
    })
  })
)

// GET /api/farmers/:farmerId/summary
router.get(
  '/:farmerId/summary',
  asyncHandler(async (req, res) => {
    const farmerId = normalizeFarmerId(req.params.farmerId)
    const farmer = await Farmer.findOne({ farmer_id: farmerId }).lean()
    if (!farmer) throw notFound(`Farmer ${farmerId} not found`)

    const summary = await farmerSummaryById(farmer.farmer_id)
    res.json({
      success: true,
      data: summary || {
        farmerId: farmer.farmer_id,
        recordCount: 0,
        totalWeightKg: 0,
        totalAmount: 0,
        latestPricePerKg: null,
      },
    })
  })
)

// GET /api/farmers/:farmerId/records — paginated, newest first,
// with a sequential record number per farmer (ordered by time).
router.get(
  '/:farmerId/records',
  asyncHandler(async (req, res) => {
    const farmerId = normalizeFarmerId(req.params.farmerId)
    const { page, limit } = parsePageQuery(req.query)

    const total = await WeighingRecord.countDocuments({ farmer_id: farmerId })
    const totalPages = Math.max(1, Math.ceil(total / limit))
    const docs = await WeighingRecord.find({ farmer_id: farmerId })
      .sort({ created_at: -1, _id: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const records = docs.map((doc, index) => ({
      ...serializeRecord(doc),
      recordNo: total - ((page - 1) * limit + index),
    }))

    res.json({
      success: true,
      data: { records, pagination: { page, limit, total, totalPages } },
    })
  })
)

export default router

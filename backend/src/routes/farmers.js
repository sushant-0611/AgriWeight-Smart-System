import { Router } from 'express'
import Farmer from '../models/Farmer.js'
import WeighingRecord from '../models/WeighingRecord.js'
import {
  asyncHandler,
  normalizeFarmerId,
  notFound,
  parsePageQuery,
} from '../utils/http.js'
import {
  allFarmerSummaries,
  farmerSummaryById,
  serializeRecord,
} from '../utils/serializers.js'

const router = Router()

// GET /api/farmers — one row per farmer with cumulative totals.
router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const farmers = await allFarmerSummaries()
    res.json({ success: true, data: farmers })
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

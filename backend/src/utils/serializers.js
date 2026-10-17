import WeighingRecord from '../models/WeighingRecord.js'

export function serializeRecord(doc) {
  return {
    id: String(doc._id),
    farmerId: doc.farmer_id,
    deviceId: doc.device_id,
    weightKg: doc.weight_kg,
    pricePerKg: doc.price_per_kg,
    totalAmount: doc.total_amount,
    mode: doc.mode,
    crateNumber: doc.crate_number ?? null,
    createdAt: doc.created_at,
  }
}

// Cumulative totals from saved records for one farmer.
export async function farmerSummaryById(farmerId) {
  const rows = await WeighingRecord.aggregate([
    { $match: { farmer_id: farmerId } },
    {
      $group: {
        _id: '$farmer_id',
        recordCount: { $sum: 1 },
        totalWeight: { $sum: '$weight_kg' },
        totalAmountSum: { $sum: '$total_amount' },
      },
    },
    {
      $project: {
        _id: 0,
        recordCount: 1,
        totalWeightKg: { $round: ['$totalWeight', 3] },
        totalAmount: { $round: ['$totalAmountSum', 2] },
      },
    },
  ])

  if (!rows.length) return null

  const latest = await WeighingRecord.findOne({ farmer_id: farmerId })
    .sort({ created_at: -1, _id: -1 })
    .lean()

  return {
    farmerId,
    recordCount: rows[0].recordCount,
    totalWeightKg: rows[0].totalWeightKg,
    totalAmount: rows[0].totalAmount,
    latestPricePerKg: latest ? latest.price_per_kg : null,
  }
}

export async function allFarmerSummaries() {
  const rows = await WeighingRecord.aggregate([
    {
      $group: {
        _id: '$farmer_id',
        recordCount: { $sum: 1 },
        totalWeight: { $sum: '$weight_kg' },
        totalAmountSum: { $sum: '$total_amount' },
        lastRecordAt: { $max: '$created_at' },
      },
    },
    { $sort: { _id: 1 } },
    {
      $project: {
        _id: 0,
        farmerId: '$_id',
        recordCount: 1,
        totalWeightKg: { $round: ['$totalWeight', 3] },
        totalAmount: { $round: ['$totalAmountSum', 2] },
        lastRecordAt: 1,
      },
    },
  ])
  return rows
}

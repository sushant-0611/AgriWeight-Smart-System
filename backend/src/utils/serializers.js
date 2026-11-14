import WeighingRecord from '../models/WeighingRecord.js'
import { config } from '../config.js'

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

export function maskAadhaar(value) {
  if (!value) return null
  const digits = String(value).replace(/\D/g, '')
  if (digits.length < 4) return null
  return `XXXX XXXX ${digits.slice(-4)}`
}

export function serializeFarmer(doc, { includeAadhaar = false } = {}) {
  return {
    farmerId: doc.farmer_id,
    fullName: doc.full_name || null,
    mobileNumber: doc.mobile_number || null,
    village: doc.village || null,
    address: doc.address || null,
    aadhaarNumber: includeAadhaar
      ? doc.aadhaar_number || null
      : maskAadhaar(doc.aadhaar_number),
    landAreaAcres: doc.land_area_acres ?? null,
    cropType: doc.crop_type || null,
    status: doc.status || 'active',
    createdAt: doc.created_at,
    updatedAt: doc.updated_at,
  }
}

export function isProfileComplete(farmer) {
  return Boolean(farmer?.fullName && farmer?.mobileNumber && farmer?.village)
}

export function isDeviceOnline(lastSeenAt, now = new Date()) {
  if (!lastSeenAt) return false
  return now.getTime() - new Date(lastSeenAt).getTime() <= config.offlineTimeoutMs
}

export function serializeDevice(doc, { farmer = null, now = new Date() } = {}) {
  return {
    deviceId: doc.device_id,
    online: isDeviceOnline(doc.last_seen_at, now),
    lastSeenAt: doc.last_seen_at || null,
    assignedFarmerId: doc.assigned_farmer_id || null,
    assignedFarmerName: farmer?.full_name || null,
    assignedFarmerVillage: farmer?.village || null,
    assignedAt: doc.assigned_at || null,
    createdAt: doc.created_at,
    telemetry: doc.telemetry
      ? {
          netWeightKg: doc.telemetry.net_weight_kg ?? null,
          mode: doc.telemetry.mode ?? null,
          farmerId: doc.telemetry.farmer_id ?? null,
          pricePerKg: doc.telemetry.price_per_kg ?? null,
          updatedAt: doc.telemetry.updated_at ?? null,
        }
      : null,
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

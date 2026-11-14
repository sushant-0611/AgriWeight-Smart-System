import Farmer from '../models/Farmer.js'
import { normalizeFarmerId } from './http.js'

export { normalizeFarmerId }

export async function findFarmer(farmerId) {
  const id = normalizeFarmerId(farmerId)
  if (!id) return null
  return Farmer.findOne({ farmer_id: id }).lean()
}

export async function farmerExists(farmerId) {
  const id = normalizeFarmerId(farmerId)
  if (!id) return false
  return Boolean(await Farmer.exists({ farmer_id: id }))
}

export async function findFarmerByAadhaar(aadhaarNumber, excludeFarmerId = null) {
  if (!aadhaarNumber) return null
  const filter = { aadhaar_number: aadhaarNumber }
  if (excludeFarmerId) filter.farmer_id = { $ne: excludeFarmerId }
  return Farmer.findOne(filter).lean()
}

// Next numeric Farmer ID after the highest existing one. IDs that are not
// purely numeric are ignored. The unique index remains the final guarantee.
export async function generateNextFarmerId() {
  const rows = await Farmer.find({ farmer_id: { $regex: /^[0-9]{1,12}$/ } })
    .select('farmer_id')
    .lean()

  let max = 1000
  for (const row of rows) {
    const value = Number(row.farmer_id)
    if (Number.isSafeInteger(value) && value > max) max = value
  }

  return String(max + 1)
}

export function isDuplicateKeyError(err, field) {
  if (!err || err.code !== 11000) return false
  if (!field) return true
  const pattern = err.keyPattern || {}
  return Boolean(pattern[field])
}

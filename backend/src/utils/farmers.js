import Farmer from '../models/Farmer.js'
import { config } from '../config.js'
import { unprocessable } from './http.js'

// Fixed registry of the farmer IDs the client has approved. Membership is
// checked instead of trusting any ID that arrives from the hardware.
const registeredSet = new Set(
  config.registeredFarmerIds.map((id) => String(id).trim().toUpperCase())
)

export function isRegisteredFarmerId(value) {
  return registeredSet.has(String(value || '').trim().toUpperCase())
}

export function registeredFarmerIdList() {
  return [...registeredSet]
}

// Normalises and validates a farmer ID, throwing a 422 when it is not one of
// the fixed registered IDs. Callers must use the returned value.
export function assertRegisteredFarmerId(value) {
  const id = String(value || '').trim().toUpperCase()
  if (!registeredSet.has(id)) {
    throw unprocessable(
      `Farmer ID "${id || '(empty)'}" is not registered. Only the registered farmer IDs are accepted.`
    )
  }
  return id
}

// Seeds the ten fixed farmers so they appear on the dashboard and can be
// referenced by records. Safe to run on every startup.
export async function ensureRegisteredFarmers() {
  const ids = registeredFarmerIdList()
  await Promise.all(
    ids.map((farmer_id) =>
      Farmer.findOneAndUpdate(
        { farmer_id },
        { $setOnInsert: { farmer_id } },
        { upsert: true, new: true }
      )
    )
  )
  console.log(`[farmers] registered ${ids.length} fixed farmer IDs: ${ids.join(', ')}`)
}

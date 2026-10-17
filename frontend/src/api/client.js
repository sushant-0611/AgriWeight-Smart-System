const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')

export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'AGRIWEIGHT-01'

async function request(path) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Accept: 'application/json' },
  })

  let body = null
  try {
    body = await res.json()
  } catch {
    body = null
  }

  if (!res.ok || !body || body.success !== true) {
    const message = body?.error?.message || `Request failed (HTTP ${res.status})`
    throw new Error(message)
  }

  return body.data
}

export function fetchDeviceStatus(deviceId) {
  return request(`/api/devices/${encodeURIComponent(deviceId)}/status`)
}

export function fetchFarmers() {
  return request('/api/farmers')
}

export function fetchFarmerSummary(farmerId) {
  return request(`/api/farmers/${encodeURIComponent(farmerId)}/summary`)
}

export function fetchFarmerRecords(farmerId, page = 1, limit = 15) {
  return request(
    `/api/farmers/${encodeURIComponent(farmerId)}/records?page=${page}&limit=${limit}`
  )
}

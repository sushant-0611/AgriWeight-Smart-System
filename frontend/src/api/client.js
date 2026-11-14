const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '')

export const DEVICE_ID = import.meta.env.VITE_DEVICE_ID || 'AGRIWEIGHT-01'

const NETWORK_ERROR =
  'Unable to reach the server. Check that the backend is running and try again.'

async function request(path, { method = 'GET', body } = {}) {
  let res
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch {
    throw new Error(NETWORK_ERROR)
  }

  let payload = null
  try {
    payload = await res.json()
  } catch {
    payload = null
  }

  if (!res.ok || !payload || payload.success !== true) {
    const message = payload?.error?.message || `Request failed (HTTP ${res.status})`
    const error = new Error(message)
    error.status = res.status
    error.details = payload?.error?.details || null
    throw error
  }

  return payload.data
}

function queryString(params) {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      search.set(key, String(value).trim())
    }
  }
  const text = search.toString()
  return text ? `?${text}` : ''
}

export function fetchDeviceStatus(deviceId) {
  return request(`/api/devices/${encodeURIComponent(deviceId)}/status`)
}

export function fetchFarmers(params = {}) {
  return request(`/api/farmers${queryString(params)}`)
}

export function fetchFarmer(farmerId) {
  return request(`/api/farmers/${encodeURIComponent(farmerId)}`)
}

export function fetchNextFarmerId() {
  return request('/api/farmers/next-id')
}

export function createFarmer(payload) {
  return request('/api/farmers', { method: 'POST', body: payload })
}

export function updateFarmer(farmerId, payload) {
  return request(`/api/farmers/${encodeURIComponent(farmerId)}`, {
    method: 'PATCH',
    body: payload,
  })
}

export function deleteFarmer(farmerId) {
  return request(`/api/farmers/${encodeURIComponent(farmerId)}`, { method: 'DELETE' })
}

export function verifyFarmer(farmerId) {
  return request('/api/farmers/verify', { method: 'POST', body: { farmerId } })
}

export function fetchFarmerSummary(farmerId) {
  return request(`/api/farmers/${encodeURIComponent(farmerId)}/summary`)
}

export function fetchFarmerRecords(farmerId, page = 1, limit = 15) {
  return request(
    `/api/farmers/${encodeURIComponent(farmerId)}/records?page=${page}&limit=${limit}`
  )
}

export function fetchDevices() {
  return request('/api/devices')
}

export function assignDevice(deviceId, farmerId) {
  return request(`/api/devices/${encodeURIComponent(deviceId)}/assign`, {
    method: 'POST',
    body: { farmerId },
  })
}

export function unassignDevice(deviceId) {
  return request(`/api/devices/${encodeURIComponent(deviceId)}/assign`, {
    method: 'DELETE',
  })
}

export function fetchDashboardStats() {
  return request('/api/dashboard/stats')
}

import { normalizeFarmerId, validationError } from './http.js'

const FARMER_ID_PATTERN = /^[0-9]{1,12}$/

function pick(body, camel, snake) {
  if (body[camel] !== undefined) return body[camel]
  if (snake && body[snake] !== undefined) return body[snake]
  return undefined
}

function has(body, camel, snake) {
  return body[camel] !== undefined || (snake && body[snake] !== undefined)
}

function cleanText(value) {
  if (value === null || value === undefined) return null
  const text = String(value).trim().replace(/\s+/g, ' ')
  return text || null
}

export function normalizeMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  return digits
}

export function normalizeAadhaar(value) {
  return String(value || '').replace(/\D/g, '')
}

function validateFarmerFields(body, { partial }) {
  const errors = {}
  const values = {}

  if (!partial || has(body, 'farmerId', 'farmer_id')) {
    const raw = pick(body, 'farmerId', 'farmer_id')
    const farmerId = normalizeFarmerId(raw)
    if (!farmerId) {
      // Optional: the backend generates the next unique ID when omitted.
    } else if (!FARMER_ID_PATTERN.test(farmerId)) {
      errors.farmerId = 'Farmer ID must be 1 to 12 digits.'
    } else {
      values.farmerId = farmerId
    }
  }

  if (!partial || has(body, 'fullName', 'full_name')) {
    const fullName = cleanText(pick(body, 'fullName', 'full_name'))
    if (!fullName) {
      errors.fullName = 'Full name is required.'
    } else if (fullName.length < 2) {
      errors.fullName = 'Full name must be at least 2 characters.'
    } else if (fullName.length > 120) {
      errors.fullName = 'Full name must be at most 120 characters.'
    } else {
      values.fullName = fullName
    }
  }

  if (!partial || has(body, 'mobileNumber', 'mobile')) {
    const raw = pick(body, 'mobileNumber', 'mobile')
    const mobile = normalizeMobile(raw)
    if (!mobile) {
      errors.mobileNumber = 'Mobile number is required.'
    } else if (!/^[6-9][0-9]{9}$/.test(mobile)) {
      errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number.'
    } else {
      values.mobileNumber = mobile
    }
  }

  if (!partial || has(body, 'village', 'village')) {
    const village = cleanText(pick(body, 'village', 'village'))
    if (!village) {
      errors.village = 'Village is required.'
    } else if (village.length > 80) {
      errors.village = 'Village must be at most 80 characters.'
    } else {
      values.village = village
    }
  }

  if (has(body, 'address', 'address')) {
    const address = cleanText(pick(body, 'address', 'address'))
    if (address && address.length > 300) {
      errors.address = 'Address must be at most 300 characters.'
    } else {
      values.address = address
    }
  }

  if (has(body, 'aadhaarNumber', 'aadhaar_number')) {
    const raw = cleanText(pick(body, 'aadhaarNumber', 'aadhaar_number'))
    if (!raw) {
      values.aadhaarNumber = null
    } else {
      const aadhaar = normalizeAadhaar(raw)
      if (!/^[0-9]{12}$/.test(aadhaar)) {
        errors.aadhaarNumber = 'Aadhaar number must be exactly 12 digits.'
      } else {
        values.aadhaarNumber = aadhaar
      }
    }
  }

  if (has(body, 'landAreaAcres', 'land_area_acres')) {
    const raw = pick(body, 'landAreaAcres', 'land_area_acres')
    if (raw === null || raw === undefined || String(raw).trim() === '') {
      values.landAreaAcres = null
    } else {
      const acres = Number(raw)
      if (!Number.isFinite(acres) || acres < 0 || acres > 100000) {
        errors.landAreaAcres = 'Land area must be a number between 0 and 100000 acres.'
      } else {
        values.landAreaAcres = Math.round(acres * 1000) / 1000
      }
    }
  }

  if (has(body, 'cropType', 'crop_type')) {
    const cropType = cleanText(pick(body, 'cropType', 'crop_type'))
    if (cropType && cropType.length > 80) {
      errors.cropType = 'Crop type must be at most 80 characters.'
    } else {
      values.cropType = cropType
    }
  }

  if (has(body, 'status', 'status')) {
    const status = String(body.status || '').trim().toLowerCase()
    if (status !== 'active' && status !== 'inactive') {
      errors.status = 'Status must be active or inactive.'
    } else {
      values.status = status
    }
  }

  if (Object.keys(errors).length) {
    throw validationError('Please correct the highlighted fields.', errors)
  }

  return values
}

export function parseFarmerCreate(body) {
  const values = validateFarmerFields(body || {}, { partial: false })
  return {
    status: 'active',
    address: null,
    aadhaarNumber: null,
    landAreaAcres: null,
    cropType: null,
    ...values,
  }
}

export function parseFarmerUpdate(body) {
  const payload = body || {}
  const values = validateFarmerFields(payload, { partial: true })
  if (!Object.keys(values).length) {
    throw validationError('Provide at least one field to update.', {})
  }
  return values
}

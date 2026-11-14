export function normalizeMobile(value) {
  const digits = String(value || '').replace(/\D/g, '')
  if (digits.length === 12 && digits.startsWith('91')) return digits.slice(2)
  return digits
}

export function normalizeAadhaar(value) {
  return String(value || '').replace(/\D/g, '')
}

export function validateFarmerForm(values) {
  const errors = {}
  const farmerId = String(values.farmerId || '').trim()

  if (farmerId && !/^[0-9]{1,12}$/.test(farmerId)) {
    errors.farmerId = 'Farmer ID must be 1 to 12 digits.'
  }

  const fullName = String(values.fullName || '').trim()
  if (!fullName) errors.fullName = 'Full name is required.'
  else if (fullName.length < 2) errors.fullName = 'Full name must be at least 2 characters.'

  const mobile = normalizeMobile(values.mobileNumber)
  if (!mobile) errors.mobileNumber = 'Mobile number is required.'
  else if (!/^[6-9][0-9]{9}$/.test(mobile)) {
    errors.mobileNumber = 'Enter a valid 10-digit Indian mobile number.'
  }

  const village = String(values.village || '').trim()
  if (!village) errors.village = 'Village is required.'

  const address = String(values.address || '').trim()
  if (address.length > 300) errors.address = 'Address must be at most 300 characters.'

  const aadhaarRaw = String(values.aadhaarNumber || '').trim()
  if (aadhaarRaw && !/^[0-9]{12}$/.test(normalizeAadhaar(aadhaarRaw))) {
    errors.aadhaarNumber = 'Aadhaar number must be exactly 12 digits.'
  }

  const landArea = String(values.landAreaAcres ?? '').trim()
  if (landArea) {
    const acres = Number(landArea)
    if (!Number.isFinite(acres) || acres < 0 || acres > 100000) {
      errors.landAreaAcres = 'Enter a valid land area in acres.'
    }
  }

  const cropType = String(values.cropType || '').trim()
  if (cropType.length > 80) errors.cropType = 'Crop type must be at most 80 characters.'

  return errors
}

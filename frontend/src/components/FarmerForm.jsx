import { useEffect, useRef, useState } from 'react'
import {
  createFarmer,
  fetchNextFarmerId,
  updateFarmer,
} from '../api/client.js'
import { normalizeAadhaar, normalizeMobile, validateFarmerForm } from '../utils/validation.js'
import Icon from './Icons.jsx'
import { useToast } from './Toast.jsx'

const EMPTY_VALUES = {
  farmerId: '',
  fullName: '',
  mobileNumber: '',
  village: '',
  address: '',
  aadhaarNumber: '',
  landAreaAcres: '',
  cropType: '',
  status: 'active',
}

function initialValues(farmer) {
  if (!farmer) return { ...EMPTY_VALUES }
  return {
    farmerId: farmer.farmerId || '',
    fullName: farmer.fullName || '',
    mobileNumber: farmer.mobileNumber || '',
    village: farmer.village || '',
    address: farmer.address || '',
    aadhaarNumber: farmer.aadhaarNumber || '',
    landAreaAcres:
      farmer.landAreaAcres === null || farmer.landAreaAcres === undefined
        ? ''
        : String(farmer.landAreaAcres),
    cropType: farmer.cropType || '',
    status: farmer.status || 'active',
  }
}

function FormField({ id, label, required, error, hint, children }) {
  return (
    <div className="aw-field">
      <label className="form-label" htmlFor={id}>
        {label}
        {required && <span className="aw-required"> *</span>}
      </label>
      {children}
      {error && (
        <div className="invalid-feedback d-block" role="alert">
          {error}
        </div>
      )}
      {!error && hint && <div className="form-text">{hint}</div>}
    </div>
  )
}

export default function FarmerForm({ farmer = null, onSaved, onCancel }) {
  const isEdit = Boolean(farmer)
  const toast = useToast()
  const [values, setValues] = useState(() => initialValues(farmer))
  const [errors, setErrors] = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [generatingId, setGeneratingId] = useState(false)
  const firstFieldRef = useRef(null)

  useEffect(() => {
    firstFieldRef.current?.focus()
  }, [])

  useEffect(() => {
    if (isEdit) return undefined
    let cancelled = false

    async function loadNextId() {
      setGeneratingId(true)
      try {
        const data = await fetchNextFarmerId()
        if (!cancelled) {
          setValues((prev) => (prev.farmerId ? prev : { ...prev, farmerId: data.farmerId }))
        }
      } catch (err) {
        if (!cancelled) toast.error(`Could not generate a Farmer ID: ${err.message}`)
      } finally {
        if (!cancelled) setGeneratingId(false)
      }
    }

    loadNextId()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit])

  function handleChange(event) {
    const { name, value } = event.target
    setValues((prev) => ({ ...prev, [name]: value }))
    setErrors((prev) => {
      if (!prev[name]) return prev
      const next = { ...prev }
      delete next[name]
      return next
    })
  }

  async function regenerateId() {
    setGeneratingId(true)
    try {
      const data = await fetchNextFarmerId()
      setValues((prev) => ({ ...prev, farmerId: data.farmerId }))
      setErrors((prev) => {
        const next = { ...prev }
        delete next.farmerId
        return next
      })
    } catch (err) {
      toast.error(`Could not generate a Farmer ID: ${err.message}`)
    } finally {
      setGeneratingId(false)
    }
  }

  function buildPayload() {
    return {
      ...(isEdit ? {} : { farmerId: values.farmerId.trim() || undefined }),
      fullName: values.fullName.trim(),
      mobileNumber: normalizeMobile(values.mobileNumber),
      village: values.village.trim(),
      address: values.address.trim() || null,
      aadhaarNumber: values.aadhaarNumber ? normalizeAadhaar(values.aadhaarNumber) : null,
      landAreaAcres:
        String(values.landAreaAcres).trim() === ''
          ? null
          : Number(values.landAreaAcres),
      cropType: values.cropType.trim() || null,
      status: values.status,
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    if (submitting) return

    const clientErrors = validateFarmerForm(values)
    if (Object.keys(clientErrors).length) {
      setErrors(clientErrors)
      toast.error('Please correct the highlighted fields.')
      return
    }

    setSubmitting(true)
    setErrors({})
    try {
      const payload = buildPayload()
      const data = isEdit
        ? await updateFarmer(farmer.farmerId, payload)
        : await createFarmer(payload)
      toast.success(data.message)
      onSaved(data.farmer)
    } catch (err) {
      if (err.details && Object.keys(err.details).length) {
        setErrors(err.details)
      }
      toast.error(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} noValidate>
      <p className="aw-form-note">
        Fields marked <span className="aw-required">*</span> are required. Aadhaar is
        optional but must be unique when provided.
      </p>

      <div className="row g-3">
        <div className="col-md-6">
          <FormField
            id="farmerId"
            label="Farmer ID"
            error={errors.farmerId}
            hint={isEdit ? 'Farmer ID cannot be changed.' : 'Digits only. Leave as generated or enter your own unique ID.'}
          >
            <div className="input-group">
              <input
                ref={firstFieldRef}
                id="farmerId"
                name="farmerId"
                type="text"
                inputMode="numeric"
                className={`form-control ${errors.farmerId ? 'is-invalid' : ''}`}
                value={values.farmerId}
                onChange={handleChange}
                disabled={isEdit || generatingId}
                placeholder="e.g. 1001"
                autoComplete="off"
              />
              {!isEdit && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={regenerateId}
                  disabled={generatingId}
                  title="Generate the next available Farmer ID"
                >
                  {generatingId ? (
                    <span className="spinner-border spinner-border-sm" aria-hidden="true" />
                  ) : (
                    'Generate'
                  )}
                </button>
              )}
            </div>
          </FormField>
        </div>

        <div className="col-md-6">
          <FormField id="fullName" label="Full Name" required error={errors.fullName}>
            <input
              id="fullName"
              name="fullName"
              type="text"
              className={`form-control ${errors.fullName ? 'is-invalid' : ''}`}
              value={values.fullName}
              onChange={handleChange}
              maxLength={120}
              placeholder="Farmer's full name"
              autoComplete="name"
            />
          </FormField>
        </div>

        <div className="col-md-6">
          <FormField
            id="mobileNumber"
            label="Mobile Number"
            required
            error={errors.mobileNumber}
            hint="10-digit Indian mobile number."
          >
            <input
              id="mobileNumber"
              name="mobileNumber"
              type="tel"
              inputMode="numeric"
              className={`form-control ${errors.mobileNumber ? 'is-invalid' : ''}`}
              value={values.mobileNumber}
              onChange={handleChange}
              maxLength={15}
              placeholder="9876543210"
              autoComplete="tel"
            />
          </FormField>
        </div>

        <div className="col-md-6">
          <FormField id="village" label="Village" required error={errors.village}>
            <input
              id="village"
              name="village"
              type="text"
              className={`form-control ${errors.village ? 'is-invalid' : ''}`}
              value={values.village}
              onChange={handleChange}
              maxLength={80}
              placeholder="Village name"
              autoComplete="address-level2"
            />
          </FormField>
        </div>

        <div className="col-md-6">
          <FormField
            id="aadhaarNumber"
            label="Aadhaar Number"
            error={errors.aadhaarNumber}
            hint="Optional. 12 digits, unique per farmer."
          >
            <input
              id="aadhaarNumber"
              name="aadhaarNumber"
              type="text"
              inputMode="numeric"
              className={`form-control ${errors.aadhaarNumber ? 'is-invalid' : ''}`}
              value={values.aadhaarNumber}
              onChange={handleChange}
              maxLength={14}
              placeholder="1234 5678 9012"
              autoComplete="off"
            />
          </FormField>
        </div>

        <div className="col-md-6">
          <FormField
            id="landAreaAcres"
            label="Land Area (acres)"
            error={errors.landAreaAcres}
            hint="Optional."
          >
            <input
              id="landAreaAcres"
              name="landAreaAcres"
              type="number"
              min="0"
              step="0.01"
              className={`form-control ${errors.landAreaAcres ? 'is-invalid' : ''}`}
              value={values.landAreaAcres}
              onChange={handleChange}
              placeholder="e.g. 2.5"
            />
          </FormField>
        </div>

        <div className="col-md-6">
          <FormField id="cropType" label="Crop Type" error={errors.cropType} hint="Optional.">
            <input
              id="cropType"
              name="cropType"
              type="text"
              className={`form-control ${errors.cropType ? 'is-invalid' : ''}`}
              value={values.cropType}
              onChange={handleChange}
              maxLength={80}
              placeholder="e.g. Sugarcane"
            />
          </FormField>
        </div>

        <div className="col-md-6">
          <FormField id="status" label="Status" error={errors.status}>
            <select
              id="status"
              name="status"
              className={`form-select ${errors.status ? 'is-invalid' : ''}`}
              value={values.status}
              onChange={handleChange}
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </FormField>
        </div>

        <div className="col-12">
          <FormField id="address" label="Address" error={errors.address} hint="Optional.">
            <textarea
              id="address"
              name="address"
              className={`form-control ${errors.address ? 'is-invalid' : ''}`}
              value={values.address}
              onChange={handleChange}
              maxLength={300}
              rows={2}
              placeholder="House, street, post office"
            />
          </FormField>
        </div>
      </div>

      <div className="aw-form-actions">
        <button type="button" className="btn btn-outline-secondary" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" className="btn btn-success" disabled={submitting}>
          {submitting ? (
            <>
              <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
              Saving...
            </>
          ) : (
            <>
              <Icon name={isEdit ? 'check' : 'plus'} size={16} className="me-1" />
              {isEdit ? 'Save Changes' : 'Register Farmer'}
            </>
          )}
        </button>
      </div>
    </form>
  )
}

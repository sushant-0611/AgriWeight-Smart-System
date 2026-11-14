import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  DEVICE_ID,
  assignDevice,
  fetchDevices,
  unassignDevice,
  verifyFarmer,
} from '../api/client.js'
import { timeAgo } from '../utils/format.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import Icon from './Icons.jsx'
import LoadingBlock from './LoadingBlock.jsx'
import StatusBadge from './StatusBadge.jsx'
import { useToast } from './Toast.jsx'

function DeviceStatus({ online }) {
  return (
    <span className={`aw-device-status ${online ? 'online' : 'offline'}`}>
      <span className="aw-device-dot" aria-hidden="true" />
      {online ? 'Online' : 'Offline'}
    </span>
  )
}

export default function Hardware({ onNavigate }) {
  const toast = useToast()
  const [devices, setDevices] = useState([])
  const [devicesLoading, setDevicesLoading] = useState(true)
  const [devicesError, setDevicesError] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [farmerIdInput, setFarmerIdInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [verified, setVerified] = useState(null)
  const [verifyError, setVerifyError] = useState(null)
  const [deviceInput, setDeviceInput] = useState('')
  const [assigning, setAssigning] = useState(false)
  const [unassignTarget, setUnassignTarget] = useState(null)
  const [unassignBusy, setUnassignBusy] = useState(false)

  const loadDevices = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setDevicesLoading(true)
    else setRefreshing(true)
    try {
      const data = await fetchDevices()
      setDevices(data)
      setDevicesError(null)
    } catch (err) {
      setDevicesError(err.message)
    } finally {
      if (!silent) setDevicesLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadDevices()
    const timer = setInterval(() => loadDevices({ silent: true }), 5000)
    return () => clearInterval(timer)
  }, [loadDevices])

  const suggestedDeviceId = useMemo(
    () => devices[0]?.deviceId || DEVICE_ID,
    [devices]
  )

  const alreadyAssigned = Boolean(
    verified?.assignedDeviceId &&
      deviceInput.trim() === verified.assignedDeviceId
  )

  async function handleVerify(event) {
    event.preventDefault()
    if (verifying) return

    const farmerId = farmerIdInput.trim()
    if (!farmerId) {
      setVerifyError('Enter a Farmer ID to verify.')
      return
    }

    setVerifying(true)
    setVerifyError(null)
    setVerified(null)
    try {
      const data = await verifyFarmer(farmerId)
      setVerified(data)
      setDeviceInput(
        (current) => current || data.assignedDeviceId || suggestedDeviceId
      )
      toast.success(data.message)
    } catch (err) {
      setVerifyError(err.message)
      toast.error(err.message)
    } finally {
      setVerifying(false)
    }
  }

  async function handleAssign(event) {
    event.preventDefault()
    if (!verified) {
      toast.error('Verify a registered Farmer ID first.')
      return
    }
    const deviceId = deviceInput.trim()
    if (!deviceId) {
      toast.error('Enter the Device ID to assign.')
      return
    }

    setAssigning(true)
    try {
      const data = await assignDevice(deviceId, verified.farmer.farmerId)
      toast.success(data.message)
      setVerified((current) =>
        current ? { ...current, assignedDeviceId: deviceId } : current
      )
      await loadDevices({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setAssigning(false)
    }
  }

  async function confirmUnassign() {
    if (!unassignTarget) return
    setUnassignBusy(true)
    try {
      const data = await unassignDevice(unassignTarget.deviceId)
      toast.success(data.message)
      if (verified?.assignedDeviceId === unassignTarget.deviceId) {
        setVerified((current) => (current ? { ...current, assignedDeviceId: null } : current))
      }
      setUnassignTarget(null)
      await loadDevices({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setUnassignBusy(false)
    }
  }

  return (
    <div className="container py-3 py-md-4">
      <div className="aw-page-head">
        <div>
          <h1 className="aw-page-title mb-1">Hardware Setup</h1>
          <p className="aw-page-subtitle mb-0">
            Verify a registered Farmer ID, then assign the weighing device before
            weighing begins.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-outline-secondary"
          onClick={() => loadDevices({ silent: true })}
          disabled={refreshing}
        >
          {refreshing ? (
            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
          ) : (
            <Icon name="activity" size={15} className="me-1" />
          )}
          Refresh
        </button>
      </div>

      <div className="aw-steps" aria-label="Hardware setup steps">
        <div className="aw-step">
          <span className="aw-step-no">1</span>
          <span>Enter the Farmer ID</span>
        </div>
        <div className="aw-step">
          <span className="aw-step-no">2</span>
          <span>Verify registered farmer</span>
        </div>
        <div className="aw-step">
          <span className="aw-step-no">3</span>
          <span>Assign the device</span>
        </div>
      </div>

      {devicesError && (
        <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2" role="alert">
          <strong>Device list unavailable.</strong>
          <span>{devicesError}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary ms-auto"
            onClick={() => loadDevices()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-6">
          <section className="aw-panel h-100">
            <h2 className="aw-section-title mb-1">1. Verify Farmer</h2>
            <p className="aw-note mb-3">
              The Farmer ID must already exist in the Farmers tab. Invalid IDs are
              rejected before any hardware is assigned.
            </p>

            <form onSubmit={handleVerify} className="aw-inline-form" noValidate>
              <label className="form-label" htmlFor="hardwareFarmerId">
                Farmer ID
              </label>
              <div className="d-flex flex-column flex-sm-row gap-2">
                <input
                  id="hardwareFarmerId"
                  type="text"
                  inputMode="numeric"
                  className={`form-control ${verifyError ? 'is-invalid' : ''}`}
                  placeholder="Enter Farmer ID, e.g. 1001"
                  value={farmerIdInput}
                  onChange={(event) => {
                    setFarmerIdInput(event.target.value)
                    if (verifyError) setVerifyError(null)
                  }}
                  autoComplete="off"
                />
                <button type="submit" className="btn btn-success aw-btn-primary" disabled={verifying}>
                  {verifying ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Verifying...
                    </>
                  ) : (
                    <>
                      <Icon name="check" size={16} className="me-1" />
                      Verify Farmer
                    </>
                  )}
                </button>
              </div>
            </form>

            {verifyError && (
              <div className="alert alert-danger mt-3 mb-0" role="alert">
                <strong>{verifyError}</strong>
              </div>
            )}

            {verified && (
              <div className="aw-verify-success mt-3">
                <div className="aw-verify-success-head">
                  <span className="aw-verify-check" aria-hidden="true">
                    <Icon name="check" size={16} />
                  </span>
                  <span>Farmer verified successfully.</span>
                </div>
                <dl className="aw-status-list mb-0">
                  <div className="aw-status-row">
                    <dt>Farmer ID</dt>
                    <dd>{verified.farmer.farmerId}</dd>
                  </div>
                  <div className="aw-status-row">
                    <dt>Full Name</dt>
                    <dd>{verified.farmer.fullName || <span className="aw-muted">Not provided</span>}</dd>
                  </div>
                  <div className="aw-status-row">
                    <dt>Village</dt>
                    <dd>{verified.farmer.village || <span className="aw-muted">Not provided</span>}</dd>
                  </div>
                  <div className="aw-status-row">
                    <dt>Mobile Number</dt>
                    <dd>{verified.farmer.mobileNumber || <span className="aw-muted">Not provided</span>}</dd>
                  </div>
                  <div className="aw-status-row">
                    <dt>Status</dt>
                    <dd>
                      <StatusBadge status={verified.farmer.status} />
                    </dd>
                  </div>
                  <div className="aw-status-row">
                    <dt>Assigned Device</dt>
                    <dd>{verified.assignedDeviceId || <span className="aw-muted">Not assigned</span>}</dd>
                  </div>
                  <div className="aw-status-row">
                    <dt>Saved Records</dt>
                    <dd>{verified.recordCount ?? 0}</dd>
                  </div>
                </dl>

                {(!verified.farmer.fullName ||
                  !verified.farmer.mobileNumber ||
                  !verified.farmer.village) && (
                  <div className="aw-callout aw-callout-warning mt-3">
                    <strong>Profile incomplete.</strong> Add the name, mobile number
                    and village in the Farmers tab.
                    {onNavigate && (
                      <button
                        type="button"
                        className="aw-link-btn ms-2"
                        onClick={() => onNavigate('farmers')}
                      >
                        Open Farmers
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>

        <div className="col-lg-6">
          <section className="aw-panel h-100">
            <h2 className="aw-section-title mb-1">2. Assign Device</h2>
            <p className="aw-note mb-3">
              Link the hardware to the verified farmer. A device can be assigned to
              one farmer at a time.
            </p>

            {!verified ? (
              <div className="aw-disabled-state">
                <Icon name="device" size={26} />
                <p className="mb-0">Verify a farmer to enable device assignment.</p>
              </div>
            ) : (
              <form onSubmit={handleAssign} noValidate>
                <div className="aw-field">
                  <label className="form-label" htmlFor="hardwareDeviceId">
                    Device ID
                  </label>
                  <input
                    id="hardwareDeviceId"
                    type="text"
                    className="form-control"
                    list="aw-device-options"
                    value={deviceInput}
                    onChange={(event) => setDeviceInput(event.target.value)}
                    placeholder={suggestedDeviceId}
                    autoComplete="off"
                  />
                  <datalist id="aw-device-options">
                    {devices.map((device) => (
                      <option key={device.deviceId} value={device.deviceId} />
                    ))}
                  </datalist>
                  <div className="form-text">
                    This must match the Device ID configured on the ESP32
                    (<code>{DEVICE_ID}</code> by default).
                  </div>
                </div>

                <div className="aw-assign-summary">
                  <span className="aw-mini-label">Assigning to</span>
                  <div className="fw-semibold">
                    {verified.farmer.fullName || 'Unnamed farmer'} (Farmer ID{' '}
                    {verified.farmer.farmerId})
                  </div>
                  <div className="aw-note">
                    {verified.farmer.village || 'Village not provided'}
                  </div>
                </div>

                <button
                  type="submit"
                  className="btn btn-success aw-btn-primary w-100"
                  disabled={assigning || alreadyAssigned}
                >
                  {assigning ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                      Assigning...
                    </>
                  ) : alreadyAssigned ? (
                    <>
                      <Icon name="check" size={16} className="me-1" />
                      Device Already Assigned
                    </>
                  ) : (
                    <>
                      <Icon name="link" size={16} className="me-1" />
                      Assign Device to Farmer
                    </>
                  )}
                </button>

                {alreadyAssigned ? (
                  <p className="aw-note mt-2 mb-0">
                    <strong>{verified.assignedDeviceId}</strong> is already assigned to
                    this farmer. Use the device list below to unassign it.
                  </p>
                ) : (
                  verified.assignedDeviceId && (
                    <p className="aw-note mt-2 mb-0">
                      This farmer is currently linked to{' '}
                      <strong>{verified.assignedDeviceId}</strong>. Unassign it in the
                      device list below before assigning a different device.
                    </p>
                  )
                )}
              </form>
            )}
          </section>
        </div>
      </div>

      <section className="aw-panel p-0 overflow-hidden mt-3">
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <div>
            <h2 className="aw-section-title mb-1">Registered Devices</h2>
            <p className="aw-note mb-0">Devices known to the system and their assignments.</p>
          </div>
          <span className="text-muted small">
            {devices.length} device{devices.length === 1 ? '' : 's'}
          </span>
        </div>

        {devicesLoading ? (
          <LoadingBlock label="Loading devices..." />
        ) : devices.length === 0 ? (
          <div className="aw-empty py-5 text-center">
            <div className="fw-semibold">No devices registered yet</div>
            <div className="text-muted small mt-1">
              Assign a Device ID above, or wait for the ESP32 to send its first heartbeat.
            </div>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table aw-table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Device ID</th>
                  <th scope="col">Assigned Farmer</th>
                  <th scope="col">Status</th>
                  <th scope="col">Last Seen</th>
                  <th scope="col" className="text-end">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.deviceId}>
                    <td>
                      <span className="aw-id-chip">{device.deviceId}</span>
                    </td>
                    <td>
                      {device.assignedFarmerId ? (
                        <>
                          <div className="fw-semibold">
                            {device.assignedFarmerName || 'Unnamed farmer'}
                          </div>
                          <div className="aw-note">
                            ID {device.assignedFarmerId}
                            {device.assignedFarmerVillage
                              ? ` · ${device.assignedFarmerVillage}`
                              : ''}
                          </div>
                        </>
                      ) : (
                        <span className="aw-muted">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <DeviceStatus online={device.online} />
                    </td>
                    <td>
                      {device.lastSeenAt ? (
                        <span title={new Date(device.lastSeenAt).toLocaleString()}>
                          {timeAgo(device.lastSeenAt)}
                        </span>
                      ) : (
                        <span className="aw-muted">Never</span>
                      )}
                    </td>
                    <td className="text-end">
                      {device.assignedFarmerId ? (
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary"
                          onClick={() => setUnassignTarget(device)}
                        >
                          Unassign
                        </button>
                      ) : (
                        <span className="aw-muted small">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {unassignTarget && (
        <ConfirmDialog
          title="Unassign device?"
          message={
            <>
              Unassign device <strong>{unassignTarget.deviceId}</strong> from farmer{' '}
              <strong>{unassignTarget.assignedFarmerId}</strong>?
            </>
          }
          note="The device and farmer remain registered; only the link is removed."
          confirmLabel="Unassign Device"
          busy={unassignBusy}
          onConfirm={confirmUnassign}
          onClose={() => setUnassignTarget(null)}
        />
      )}
    </div>
  )
}

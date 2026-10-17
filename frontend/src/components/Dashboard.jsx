import { useEffect, useState } from 'react'
import { DEVICE_ID, fetchDeviceStatus } from '../api/client.js'
import {
  formatWeight,
  formatINR,
  formatDateTime,
  timeAgo,
} from '../utils/format.js'

const POLL_INTERVAL_MS = 2000

export default function Dashboard({ onStatusChange }) {
  const [status, setStatus] = useState(null)
  const [serverReachable, setServerReachable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)

  useEffect(() => {
    let cancelled = false
    let timer = null

    async function poll() {
      try {
        const data = await fetchDeviceStatus(DEVICE_ID)
        if (cancelled) return
        setStatus(data)
        setServerReachable(true)
        setLastSync(new Date().toISOString())
        onStatusChange(Boolean(data.online))
      } catch {
        if (cancelled) return
        setServerReachable(false)
        onStatusChange(false)
      } finally {
        if (!cancelled) setLoading(false)
      }
      if (!cancelled) timer = setTimeout(poll, POLL_INTERVAL_MS)
    }

    poll()
    return () => {
      cancelled = true
      if (timer) clearTimeout(timer)
    }
  }, [onStatusChange])

  if (loading) {
    return (
      <div className="d-flex justify-content-center align-items-center py-5">
        <div className="spinner-border text-success" role="status">
          <span className="visually-hidden">Loading dashboard...</span>
        </div>
      </div>
    )
  }

  const online = serverReachable && Boolean(status?.online)
  const telemetry = status?.telemetry || null
  const summary = status?.farmerSummary || null
  const lastRecord = status?.lastRecord || null

  const mode = telemetry?.mode || null
  const hasWeight = online && telemetry?.netWeightKg !== null && telemetry?.netWeightKg !== undefined
  const estimate =
    hasWeight && telemetry?.pricePerKg !== null && telemetry?.pricePerKg !== undefined
      ? Math.round(Number(telemetry.netWeightKg) * Number(telemetry.pricePerKg) * 100) / 100
      : null

  return (
    <div className="container py-3 py-md-4">
      {!serverReachable && (
        <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
          <strong>Server unreachable.</strong>
          <span>Make sure the backend is running. Retrying automatically...</span>
        </div>
      )}

      <div className="row g-3">
        <div className="col-lg-7">
          <section className="aw-panel h-100">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <h2 className="aw-section-title mb-0">Current Net Weight</h2>
              {mode ? (
                <span className={`aw-mode-badge ${mode === 'AUTO' ? 'auto' : 'manual'}`}>
                  {mode}
                </span>
              ) : (
                <span className="aw-mode-badge unknown">—</span>
              )}
            </div>

            <div className={`aw-weight-display${online ? '' : ' inactive'}`} aria-live="polite">
              {hasWeight ? (
                <>
                  {Number(telemetry.netWeightKg).toFixed(3)}
                  <span className="aw-weight-unit"> kg</span>
                </>
              ) : (
                <>
                  <span className="aw-weight-missing">—.———</span>
                  <span className="aw-weight-unit"> kg</span>
                </>
              )}
            </div>
            <div className="text-muted small mt-1">
              {online
                ? 'Live weight from ESP32 device'
                : 'Weight unavailable — hardware offline or no recent telemetry'}
            </div>

            <hr className="aw-divider" />

            <div className="row g-3">
              <div className="col-sm-6">
                <div className="aw-mini-label">Current Farmer ID</div>
                <div className="aw-mini-value">
                  {telemetry?.farmerId ? telemetry.farmerId : <span className="text-muted">—</span>}
                </div>
              </div>
              <div className="col-sm-6">
                <div className="aw-mini-label">Current Price / kg</div>
                <div className="aw-mini-value">
                  {telemetry?.pricePerKg !== null && telemetry?.pricePerKg !== undefined ? (
                    formatINR(telemetry.pricePerKg)
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="col-lg-5">
          <section className="aw-panel h-100">
            <h2 className="aw-section-title mb-3">Hardware Status</h2>
            <dl className="aw-status-list mb-0">
              <div className="aw-status-row">
                <dt>Device ID</dt>
                <dd>{status?.deviceId || DEVICE_ID}</dd>
              </div>
              <div className="aw-status-row">
                <dt>Status</dt>
                <dd>
                  <span className={`badge ${online ? 'bg-success' : 'bg-danger'}`}>
                    {online ? 'Online' : 'Offline'}
                  </span>
                </dd>
              </div>
              <div className="aw-status-row">
                <dt>Last Communication</dt>
                <dd>{status?.lastSeenAt ? timeAgo(status.lastSeenAt) : 'Never'}</dd>
              </div>
              <div className="aw-status-row">
                <dt>Last Communication Time</dt>
                <dd>{status?.lastSeenAt ? formatDateTime(status.lastSeenAt) : '—'}</dd>
              </div>
              <div className="aw-status-row">
                <dt>Server</dt>
                <dd>
                  <span className={`badge ${serverReachable ? 'bg-success' : 'bg-danger'}`}>
                    {serverReachable ? 'Connected' : 'Unreachable'}
                  </span>
                </dd>
              </div>
              <div className="aw-status-row">
                <dt>Last Data Sync</dt>
                <dd>{lastSync ? timeAgo(lastSync) : '—'}</dd>
              </div>
            </dl>
          </section>
        </div>
      </div>

      <div className="row g-3 mt-0">
        <div className="col-md-6">
          <section className="aw-panel h-100">
            <h2 className="aw-section-title mb-1">Current Weighing</h2>
            <p className="aw-note mb-3">Live estimate from the device — not saved yet.</p>
            <dl className="aw-status-list mb-0">
              <div className="aw-status-row">
                <dt>Net Weight</dt>
                <dd>{hasWeight ? formatWeight(telemetry.netWeightKg) : '—'}</dd>
              </div>
              <div className="aw-status-row">
                <dt>Price / kg</dt>
                <dd>
                  {telemetry?.pricePerKg !== null && telemetry?.pricePerKg !== undefined
                    ? formatINR(telemetry.pricePerKg)
                    : '—'}
                </dd>
              </div>
              <div className="aw-status-row aw-status-highlight">
                <dt>Estimated Amount</dt>
                <dd className="aw-amount">{estimate !== null ? formatINR(estimate) : '—'}</dd>
              </div>
            </dl>
          </section>
        </div>

        <div className="col-md-6">
          <section className="aw-panel h-100">
            <h2 className="aw-section-title mb-1">Farmer Saved Totals</h2>
            <p className="aw-note mb-3">
              {summary
                ? `Cumulative totals from saved records for ${summary.farmerId}.`
                : 'Cumulative totals from saved records in the database.'}
            </p>
            {summary ? (
              <dl className="aw-status-list mb-0">
                <div className="aw-status-row">
                  <dt>Completed Crates</dt>
                  <dd>{summary.recordCount}</dd>
                </div>
                <div className="aw-status-row">
                  <dt>Total Weight</dt>
                  <dd>{formatWeight(summary.totalWeightKg)}</dd>
                </div>
                <div className="aw-status-row aw-status-highlight">
                  <dt>Total Amount</dt>
                  <dd className="aw-amount">{formatINR(summary.totalAmount)}</dd>
                </div>
              </dl>
            ) : (
              <p className="text-muted small mb-0">
                No saved records yet for the current farmer. Complete a weighing on the
                hardware to see totals here.
              </p>
            )}
          </section>
        </div>
      </div>

      <div className="row g-3 mt-0">
        <div className="col-12">
          <section className="aw-panel">
            <h2 className="aw-section-title mb-3">Last Successful Weighing</h2>
            {lastRecord ? (
              <div className="d-flex flex-wrap align-items-center gap-2 gap-md-3 aw-last-record">
                <span className="fw-semibold">{lastRecord.farmerId}</span>
                <span>{formatWeight(lastRecord.weightKg)}</span>
                <span>{formatINR(lastRecord.pricePerKg)} / kg</span>
                <span className="text-success fw-semibold">{formatINR(lastRecord.totalAmount)}</span>
                <span className="text-muted small ms-md-auto">
                  {formatDateTime(lastRecord.createdAt)}
                </span>
              </div>
            ) : (
              <p className="text-muted small mb-0">
                No weighing records saved yet. Saved records will appear here.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}

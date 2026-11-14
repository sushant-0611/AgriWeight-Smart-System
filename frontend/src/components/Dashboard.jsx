import { useCallback, useEffect, useState } from 'react'
import { DEVICE_ID, fetchDashboardStats, fetchDeviceStatus } from '../api/client.js'
import {
  formatWeight,
  formatINR,
  formatDate,
  formatDateTime,
  timeAgo,
} from '../utils/format.js'
import EmptyState from './EmptyState.jsx'
import Icon from './Icons.jsx'
import LoadingBlock from './LoadingBlock.jsx'
import StatusBadge from './StatusBadge.jsx'

const POLL_INTERVAL_MS = 2000
const STATS_INTERVAL_MS = 15000

function StatCard({ icon, label, value, hint, loading }) {
  return (
    <div className="aw-stat-card">
      <span className="aw-stat-icon" aria-hidden="true">
        <Icon name={icon} size={20} />
      </span>
      <div className="aw-stat-body">
        <div className="aw-stat-label">{label}</div>
        {loading ? (
          <div className="aw-stat-skeleton" aria-hidden="true" />
        ) : (
          <div className="aw-stat-value">{Number(value || 0).toLocaleString('en-IN')}</div>
        )}
        <div className="aw-stat-hint">{hint}</div>
      </div>
    </div>
  )
}

export default function Dashboard({ onStatusChange, onNavigate }) {
  const [status, setStatus] = useState(null)
  const [serverReachable, setServerReachable] = useState(true)
  const [loading, setLoading] = useState(true)
  const [lastSync, setLastSync] = useState(null)
  const [stats, setStats] = useState(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [statsError, setStatsError] = useState(null)

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

  const loadStats = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setStatsLoading(true)
    try {
      const data = await fetchDashboardStats()
      setStats(data)
      setStatsError(null)
    } catch (err) {
      setStatsError(err.message)
    } finally {
      setStatsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStats()
    const timer = setInterval(() => loadStats({ silent: true }), STATS_INTERVAL_MS)
    return () => clearInterval(timer)
  }, [loadStats])

  if (loading) {
    return (
      <div className="container py-3 py-md-4">
        <div className="d-flex justify-content-center align-items-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading dashboard...</span>
          </div>
        </div>
      </div>
    )
  }

  const online = serverReachable && Boolean(status?.online)
  const telemetry = status?.telemetry || null
  const summary = status?.farmerSummary || null
  const lastRecord = status?.lastRecord || null
  const farmerProfile = status?.farmerProfile || null
  const currentFarmerId = telemetry?.farmerId || status?.assignedFarmerId || null

  const mode = telemetry?.mode || null
  const hasWeight =
    online && telemetry?.netWeightKg !== null && telemetry?.netWeightKg !== undefined
  const estimate =
    hasWeight && telemetry?.pricePerKg !== null && telemetry?.pricePerKg !== undefined
      ? Math.round(Number(telemetry.netWeightKg) * Number(telemetry.pricePerKg) * 100) / 100
      : null
  const recentRegistrations = stats?.recentRegistrations || []

  return (
    <div className="container py-3 py-md-4">
      {!serverReachable && (
        <div className="alert alert-danger d-flex align-items-center gap-2" role="alert">
          <strong>Server unreachable.</strong>
          <span>Make sure the backend is running. Retrying automatically...</span>
        </div>
      )}

      <div className="row g-3">
        <div className="col-6 col-xl-3">
          <StatCard
            icon="users"
            label="Total Farmers"
            value={stats?.totalFarmers}
            hint={`${Number(stats?.activeFarmers || 0).toLocaleString('en-IN')} active`}
            loading={statsLoading && !stats}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            icon="device"
            label="Registered Devices"
            value={stats?.registeredDevices}
            hint={`${Number(stats?.assignedDevices || 0).toLocaleString('en-IN')} assigned`}
            loading={statsLoading && !stats}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            icon="activity"
            label="Active Devices"
            value={stats?.activeDevices}
            hint="Reporting telemetry now"
            loading={statsLoading && !stats}
          />
        </div>
        <div className="col-6 col-xl-3">
          <StatCard
            icon="link"
            label="Assigned Devices"
            value={stats?.assignedDevices}
            hint="Linked to a farmer"
            loading={statsLoading && !stats}
          />
        </div>
      </div>

      {statsError && !stats && (
        <div className="alert alert-warning d-flex flex-wrap align-items-center gap-2 mt-3" role="alert">
          <strong>Statistics unavailable.</strong>
          <span>{statsError}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-secondary ms-auto"
            onClick={() => loadStats()}
          >
            Retry
          </button>
        </div>
      )}

      <div className="row g-3 mt-0">
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
                  {currentFarmerId ? currentFarmerId : <span className="text-muted">—</span>}
                </div>
                {farmerProfile && (
                  <div className="aw-note">
                    {farmerProfile.fullName || 'Profile incomplete'}
                    {farmerProfile.village ? ` · ${farmerProfile.village}` : ''}
                  </div>
                )}
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
                <dt>Assigned Farmer</dt>
                <dd>{status?.assignedFarmerId || 'Not assigned'}</dd>
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
                ? `Cumulative totals from saved records for ${farmerProfile?.fullName || summary.farmerId}.`
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
        <div className="col-lg-7">
          <section className="aw-panel h-100">
            <div className="d-flex align-items-start justify-content-between gap-2 mb-2">
              <div>
                <h2 className="aw-section-title mb-1">Recent Registrations</h2>
                <p className="aw-note mb-0">Newest farmers added to the database.</p>
              </div>
              {onNavigate && (
                <button
                  type="button"
                  className="btn btn-sm btn-outline-success"
                  onClick={() => onNavigate('farmers')}
                >
                  View All Farmers
                </button>
              )}
            </div>

            {statsLoading && !stats ? (
              <LoadingBlock label="Loading registrations..." compact />
            ) : recentRegistrations.length === 0 ? (
              <EmptyState
                title="No farmers registered"
                message="Register the first farmer from the Farmers tab."
              />
            ) : (
              <ul className="aw-recent-list">
                {recentRegistrations.map((farmer) => (
                  <li key={farmer.farmerId}>
                    <div className="aw-recent-main">
                      <span className="aw-id-chip">{farmer.farmerId}</span>
                      <div>
                        <div className="fw-semibold">
                          {farmer.fullName || 'Unnamed farmer'}
                        </div>
                        <div className="aw-note">
                          {farmer.village || 'Village not provided'}
                        </div>
                      </div>
                    </div>
                    <div className="aw-recent-meta">
                      <span className="small text-muted">{formatDate(farmer.createdAt)}</span>
                      <StatusBadge status={farmer.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="col-lg-5">
          <section className="aw-panel h-100">
            <h2 className="aw-section-title mb-3">Last Successful Weighing</h2>
            {lastRecord ? (
              <div className="aw-last-record d-flex flex-column gap-2">
                <div className="d-flex flex-wrap align-items-center gap-2">
                  <span className="fw-semibold">{lastRecord.farmerId}</span>
                  <span>{formatWeight(lastRecord.weightKg)}</span>
                  <span>{formatINR(lastRecord.pricePerKg)} / kg</span>
                  <span className="text-success fw-semibold">
                    {formatINR(lastRecord.totalAmount)}
                  </span>
                </div>
                <div className="text-muted small">{formatDateTime(lastRecord.createdAt)}</div>
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

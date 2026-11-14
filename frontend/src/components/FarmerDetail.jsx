import { useEffect, useState } from 'react'
import { fetchFarmer, fetchFarmerRecords } from '../api/client.js'
import { formatWeight, formatINR, formatDate, formatTime } from '../utils/format.js'
import EmptyState from './EmptyState.jsx'
import Icon from './Icons.jsx'
import LoadingBlock from './LoadingBlock.jsx'
import StatusBadge from './StatusBadge.jsx'

const PAGE_SIZE = 15

function ProfileItem({ label, value, wide = false }) {
  return (
    <div className={wide ? 'col-12' : 'col-6 col-md-4'}>
      <div className="aw-mini-label">{label}</div>
      <div className="aw-profile-value">{value || <span className="aw-muted">—</span>}</div>
    </div>
  )
}

export default function FarmerDetail({ farmerId, onBack, onEdit, editBusy = false }) {
  const [farmer, setFarmer] = useState(null)
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [recordsError, setRecordsError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError(null)
      setRecordsError(null)
      try {
        const [profile, recs] = await Promise.all([
          fetchFarmer(farmerId),
          fetchFarmerRecords(farmerId, 1, PAGE_SIZE),
        ])
        if (cancelled) return
        setFarmer(profile)
        setRecords(recs.records)
        setPagination(recs.pagination)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [farmerId])

  async function loadMore() {
    if (!pagination || pagination.page >= pagination.totalPages) return
    setLoadingMore(true)
    try {
      const next = await fetchFarmerRecords(farmerId, pagination.page + 1, PAGE_SIZE)
      setRecords((prev) => [...prev, ...next.records])
      setPagination(next.pagination)
    } catch (err) {
      setRecordsError(err.message)
    } finally {
      setLoadingMore(false)
    }
  }

  const hasMore = pagination && pagination.page < pagination.totalPages
  const summary = farmer?.summary
  const profileIncomplete = farmer && (!farmer.fullName || !farmer.mobileNumber || !farmer.village)

  return (
    <div className="aw-farmer-detail">
      <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={onBack}>
        <Icon name="arrowLeft" size={15} className="me-1" />
        Back to Farmers
      </button>

      {error ? (
        <div className="aw-panel">
          <div className="alert alert-danger mb-3" role="alert">
            <strong>Could not load farmer.</strong> {error}
          </div>
          <button type="button" className="btn btn-outline-secondary" onClick={onBack}>
            Back to Farmers
          </button>
        </div>
      ) : loading ? (
        <div className="aw-panel">
          <LoadingBlock label="Loading farmer profile..." />
        </div>
      ) : (
        <>
          <section className="aw-panel aw-profile-panel">
            <div className="aw-profile-head">
              <div>
                <div className="d-flex align-items-center flex-wrap gap-2 mb-1">
                  <span className="aw-id-chip">{farmer.farmerId}</span>
                  <StatusBadge status={farmer.status} />
                  {farmer.assignedDeviceId && (
                    <span className="aw-badge aw-badge-device">
                      <Icon name="device" size={13} className="me-1" />
                      {farmer.assignedDeviceId}
                    </span>
                  )}
                </div>
                <h1 className="aw-page-title mb-0">
                  {farmer.fullName || 'Farmer profile incomplete'}
                </h1>
                <p className="aw-page-subtitle mb-0">
                  {farmer.village ? `${farmer.village} · ` : ''}Registered{' '}
                  {formatDate(farmer.createdAt)}
                </p>
              </div>
              {onEdit && (
                <button
                  type="button"
                  className="btn btn-outline-success"
                  onClick={onEdit}
                  disabled={editBusy}
                >
                  {editBusy ? (
                    <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
                  ) : (
                    <Icon name="edit" size={15} className="me-1" />
                  )}
                  Edit Profile
                </button>
              )}
            </div>

            {profileIncomplete && (
              <div className="aw-callout aw-callout-warning">
                <strong>Profile incomplete.</strong> This farmer was registered from the
                hardware before profile details were captured. Add the name, mobile number
                and village to complete the profile.
              </div>
            )}

            <div className="row g-3 mt-0">
              <ProfileItem label="Mobile Number" value={farmer.mobileNumber} />
              <ProfileItem label="Village" value={farmer.village} />
              <ProfileItem label="Aadhaar Number" value={farmer.aadhaarNumber} />
              <ProfileItem
                label="Land Area"
                value={farmer.landAreaAcres === null ? null : `${farmer.landAreaAcres} acres`}
              />
              <ProfileItem label="Crop Type" value={farmer.cropType} />
              <ProfileItem label="Assigned Device" value={farmer.assignedDeviceId} />
              <ProfileItem label="Address" value={farmer.address} wide />
            </div>
          </section>

          <section className="aw-panel mt-3">
            <h2 className="aw-section-title mb-3">Weighing Totals</h2>
            <div className="row g-3">
              <div className="col-6 col-md-3">
                <div className="aw-mini-label">Total Crates</div>
                <div className="aw-mini-value">{summary?.recordCount ?? 0}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="aw-mini-label">Total Weight</div>
                <div className="aw-mini-value">{formatWeight(summary?.totalWeightKg ?? 0)}</div>
              </div>
              <div className="col-6 col-md-3">
                <div className="aw-mini-label">Total Amount</div>
                <div className="aw-mini-value text-success">
                  {formatINR(summary?.totalAmount ?? 0)}
                </div>
              </div>
              <div className="col-6 col-md-3">
                <div className="aw-mini-label">Latest Price / kg</div>
                <div className="aw-mini-value">{formatINR(summary?.latestPricePerKg)}</div>
              </div>
            </div>
          </section>

          <section className="aw-panel p-0 overflow-hidden mt-3">
            <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
              <h2 className="aw-section-title mb-0">Weighing Records</h2>
              {pagination && (
                <span className="text-muted small">
                  {pagination.total} record{pagination.total === 1 ? '' : 's'}
                </span>
              )}
            </div>

            {recordsError ? (
              <div className="alert alert-danger m-3" role="alert">
                <strong>Could not load records.</strong> {recordsError}
              </div>
            ) : records.length === 0 ? (
              <EmptyState
                title="No weighing records yet"
                message="Records saved by the hardware for this farmer will appear here."
              />
            ) : (
              <>
                <div className="table-responsive">
                  <table className="table aw-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Record No.</th>
                        <th scope="col">Crate / Seq #</th>
                        <th scope="col" className="text-end">
                          Weight
                        </th>
                        <th scope="col" className="text-end">
                          Price / kg
                        </th>
                        <th scope="col" className="text-end">
                          Total Price
                        </th>
                        <th scope="col">Date</th>
                        <th scope="col">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {records.map((record) => (
                        <tr key={record.id}>
                          <td className="fw-semibold">{record.recordNo}</td>
                          <td>{record.crateNumber ?? record.recordNo}</td>
                          <td className="text-end">{formatWeight(record.weightKg)}</td>
                          <td className="text-end">{formatINR(record.pricePerKg)}</td>
                          <td className="text-end fw-semibold">{formatINR(record.totalAmount)}</td>
                          <td>{formatDate(record.createdAt)}</td>
                          <td>{formatTime(record.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="aw-note px-3 pt-2 mb-0">
                  &ldquo;Crate / Seq #&rdquo; is the weighing sequence number for this farmer.
                  The current hardware does not provide crate IDs.
                </p>
                {hasMore && (
                  <div className="p-3 text-center border-top">
                    <button
                      type="button"
                      className="btn btn-outline-success"
                      onClick={loadMore}
                      disabled={loadingMore}
                    >
                      {loadingMore ? (
                        <>
                          <span
                            className="spinner-border spinner-border-sm me-2"
                            role="status"
                            aria-hidden="true"
                          />
                          Loading...
                        </>
                      ) : (
                        `Load More (page ${pagination.page + 1} of ${pagination.totalPages})`
                      )}
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        </>
      )}
    </div>
  )
}

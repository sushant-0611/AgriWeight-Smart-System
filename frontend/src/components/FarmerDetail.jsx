import { useEffect, useState } from 'react'
import { fetchFarmerSummary, fetchFarmerRecords } from '../api/client.js'
import { formatWeight, formatINR, formatDate, formatTime } from '../utils/format.js'
import EmptyState from './EmptyState.jsx'

const PAGE_SIZE = 15

export default function FarmerDetail({ farmerId, onBack }) {
  const [summary, setSummary] = useState(null)
  const [records, setRecords] = useState([])
  const [pagination, setPagination] = useState(null)
  const [loading, setLoading] = useState(true)
  const [recordsError, setRecordsError] = useState(null)
  const [summaryError, setSummaryError] = useState(null)
  const [loadingMore, setLoadingMore] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setRecordsError(null)
      setSummaryError(null)
      try {
        const [sum, recs] = await Promise.all([
          fetchFarmerSummary(farmerId),
          fetchFarmerRecords(farmerId, 1, PAGE_SIZE),
        ])
        if (cancelled) return
        setSummary(sum)
        setRecords(recs.records)
        setPagination(recs.pagination)
      } catch (err) {
        if (!cancelled) setRecordsError(err.message)
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

  return (
    <div className="container py-3 py-md-4">
      <button type="button" className="btn btn-sm btn-outline-secondary mb-3" onClick={onBack}>
        &larr; Back to Farmers
      </button>

      <div className="aw-panel mb-3">
        <div className="d-flex align-items-center flex-wrap gap-2 mb-3">
          <h1 className="aw-page-title mb-0">{farmerId}</h1>
          {summary?.latestPricePerKg !== null && summary?.latestPricePerKg !== undefined && (
            <span className="badge rounded-pill bg-light text-dark border">
              Latest price: {formatINR(summary.latestPricePerKg)} / kg
            </span>
          )}
        </div>

        {summaryError ? (
          <div className="alert alert-danger mb-0" role="alert">{summaryError}</div>
        ) : !summary ? (
          <div className="spinner-border spinner-border-sm text-success" role="status">
            <span className="visually-hidden">Loading summary...</span>
          </div>
        ) : (
          <div className="row g-3">
            <div className="col-6 col-md-3">
              <div className="aw-mini-label">Total Crates</div>
              <div className="aw-mini-value">{summary.recordCount}</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="aw-mini-label">Total Weight</div>
              <div className="aw-mini-value">{formatWeight(summary.totalWeightKg)}</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="aw-mini-label">Total Amount</div>
              <div className="aw-mini-value text-success">{formatINR(summary.totalAmount)}</div>
            </div>
            <div className="col-6 col-md-3">
              <div className="aw-mini-label">Latest Price / kg</div>
              <div className="aw-mini-value">{formatINR(summary.latestPricePerKg)}</div>
            </div>
          </div>
        )}
      </div>

      <div className="aw-panel p-0 overflow-hidden">
        <div className="p-3 border-bottom d-flex align-items-center justify-content-between flex-wrap gap-2">
          <h2 className="aw-section-title mb-0">Weighing Records</h2>
          {pagination && (
            <span className="text-muted small">
              {pagination.total} record{pagination.total === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="d-flex justify-content-center py-5">
            <div className="spinner-border text-success" role="status">
              <span className="visually-hidden">Loading records...</span>
            </div>
          </div>
        ) : recordsError ? (
          <div className="alert alert-danger m-3" role="alert">
            <strong>Could not load records.</strong> {recordsError}
          </div>
        ) : records.length === 0 ? (
          <EmptyState
            title="No records for this farmer"
            message="Saved weighing records for this farmer will appear here."
          />
        ) : (
          <>
            <div className="table-responsive">
              <table className="table aw-table align-middle mb-0">
                <thead>
                  <tr>
                    <th scope="col">Record No.</th>
                    <th scope="col">Crate / Seq #</th>
                    <th scope="col" className="text-end">Weight</th>
                    <th scope="col" className="text-end">Price / kg</th>
                    <th scope="col" className="text-end">Total Price</th>
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
              &ldquo;Crate / Seq #&rdquo; is the weighing sequence number for this farmer. The
              current hardware does not provide crate IDs.
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
                      <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true" />
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
      </div>
    </div>
  )
}

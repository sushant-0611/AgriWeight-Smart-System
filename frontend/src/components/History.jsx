import { useEffect, useState } from 'react'
import { fetchFarmers } from '../api/client.js'
import { formatWeight, formatINR } from '../utils/format.js'
import FarmerDetail from './FarmerDetail.jsx'
import EmptyState from './EmptyState.jsx'

export default function History() {
  const [farmers, setFarmers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedFarmerId, setSelectedFarmerId] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const data = await fetchFarmers()
        if (!cancelled) {
          setFarmers(data)
          setError(null)
        }
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
  }, [])

  if (selectedFarmerId) {
    return (
      <FarmerDetail
        farmerId={selectedFarmerId}
        onBack={() => setSelectedFarmerId(null)}
      />
    )
  }

  return (
    <div className="container py-3 py-md-4">
      <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-3">
        <h1 className="aw-page-title mb-0">Farmer History</h1>
        <span className="text-muted small">
          {farmers.length} farmer{farmers.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="d-flex justify-content-center py-5">
          <div className="spinner-border text-success" role="status">
            <span className="visually-hidden">Loading farmers...</span>
          </div>
        </div>
      ) : error ? (
        <div className="alert alert-danger" role="alert">
          <strong>Could not load farmers.</strong> {error}
        </div>
      ) : farmers.length === 0 ? (
        <div className="aw-panel">
          <EmptyState
            title="No farmers yet"
            message="Farmers appear here automatically when the hardware saves a weighing record with a Farmer ID."
          />
        </div>
      ) : (
        <div className="aw-panel p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table aw-table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Farmer ID</th>
                  <th scope="col" className="text-end">Crates</th>
                  <th scope="col" className="text-end">Total Weight</th>
                  <th scope="col" className="text-end">Total Amount</th>
                  <th scope="col" className="text-end">Action</th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((farmer) => (
                  <tr key={farmer.farmerId}>
                    <td className="fw-semibold">{farmer.farmerId}</td>
                    <td className="text-end">{farmer.recordCount}</td>
                    <td className="text-end">{formatWeight(farmer.totalWeightKg)}</td>
                    <td className="text-end fw-semibold">{formatINR(farmer.totalAmount)}</td>
                    <td className="text-end">
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-success"
                        onClick={() => setSelectedFarmerId(farmer.farmerId)}
                      >
                        View Records
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

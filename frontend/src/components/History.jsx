import { useEffect, useState } from 'react'
import { fetchFarmers } from '../api/client.js'
import { formatWeight, formatINR } from '../utils/format.js'
import EmptyState from './EmptyState.jsx'
import FarmerDetail from './FarmerDetail.jsx'
import LoadingBlock from './LoadingBlock.jsx'

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
      <div className="container py-3 py-md-4">
        <FarmerDetail
          farmerId={selectedFarmerId}
          onBack={() => setSelectedFarmerId(null)}
        />
      </div>
    )
  }

  return (
    <div className="container py-3 py-md-4">
      <div className="aw-page-head">
        <div>
          <h1 className="aw-page-title mb-1">Farmer History</h1>
          <p className="aw-page-subtitle mb-0">
            Saved weighing totals for every registered farmer.
          </p>
        </div>
        <span className="text-muted small">
          {farmers.length} farmer{farmers.length === 1 ? '' : 's'}
        </span>
      </div>

      {loading ? (
        <div className="aw-panel">
          <LoadingBlock label="Loading farmer history..." />
        </div>
      ) : error ? (
        <div className="alert alert-danger" role="alert">
          <strong>Could not load farmers.</strong> {error}
        </div>
      ) : farmers.length === 0 ? (
        <div className="aw-panel">
          <EmptyState
            title="No farmers yet"
            message="Register farmers in the Farmers tab. Weighing records appear here after the hardware saves a weighing."
          />
        </div>
      ) : (
        <div className="aw-panel p-0 overflow-hidden">
          <div className="table-responsive">
            <table className="table aw-table align-middle mb-0">
              <thead>
                <tr>
                  <th scope="col">Farmer ID</th>
                  <th scope="col">Farmer Name</th>
                  <th scope="col">Village</th>
                  <th scope="col" className="text-end">
                    Crates
                  </th>
                  <th scope="col" className="text-end">
                    Total Weight
                  </th>
                  <th scope="col" className="text-end">
                    Total Amount
                  </th>
                  <th scope="col" className="text-end">
                    Action
                  </th>
                </tr>
              </thead>
              <tbody>
                {farmers.map((farmer) => (
                  <tr key={farmer.farmerId}>
                    <td>
                      <span className="aw-id-chip">{farmer.farmerId}</span>
                    </td>
                    <td className="fw-semibold">
                      {farmer.fullName || <span className="aw-muted">Not provided</span>}
                    </td>
                    <td>{farmer.village || <span className="aw-muted">—</span>}</td>
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

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  deleteFarmer,
  fetchFarmer,
  fetchFarmers,
} from '../api/client.js'
import { formatDate } from '../utils/format.js'
import ConfirmDialog from './ConfirmDialog.jsx'
import EmptyState from './EmptyState.jsx'
import FarmerDetail from './FarmerDetail.jsx'
import FarmerForm from './FarmerForm.jsx'
import Icon from './Icons.jsx'
import LoadingBlock from './LoadingBlock.jsx'
import Modal from './Modal.jsx'
import StatusBadge from './StatusBadge.jsx'
import { useToast } from './Toast.jsx'

function FarmerActions({ farmer, onView, onEdit, onDelete, openingEdit }) {
  return (
    <div className="aw-row-actions">
      <button
        type="button"
        className="aw-icon-btn"
        title="View farmer"
        aria-label={`View farmer ${farmer.farmerId}`}
        onClick={() => onView(farmer.farmerId)}
      >
        <Icon name="eye" size={16} />
      </button>
      <button
        type="button"
        className="aw-icon-btn"
        title="Edit farmer"
        aria-label={`Edit farmer ${farmer.farmerId}`}
        onClick={() => onEdit(farmer.farmerId)}
        disabled={openingEdit}
      >
        {openingEdit ? (
          <span className="spinner-border spinner-border-sm" aria-hidden="true" />
        ) : (
          <Icon name="edit" size={16} />
        )}
      </button>
      <button
        type="button"
        className="aw-icon-btn aw-icon-btn-danger"
        title="Delete farmer"
        aria-label={`Delete farmer ${farmer.farmerId}`}
        onClick={() => onDelete(farmer)}
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  )
}

export default function Farmers() {
  const toast = useToast()
  const [farmers, setFarmers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [query, setQuery] = useState('')
  const [villageFilter, setVillageFilter] = useState('')
  const [formState, setFormState] = useState(null)
  const [viewingFarmerId, setViewingFarmerId] = useState(null)
  const [detailVersion, setDetailVersion] = useState(0)
  const [deletingFarmer, setDeletingFarmer] = useState(null)
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [openingEditId, setOpeningEditId] = useState(null)

  const loadFarmers = useCallback(
    async ({ silent = false } = {}) => {
      if (!silent) setLoading(true)
      try {
        const data = await fetchFarmers()
        setFarmers(data)
        setError(null)
      } catch (err) {
        setError(err.message)
      } finally {
        if (!silent) setLoading(false)
      }
    },
    []
  )

  useEffect(() => {
    loadFarmers()
  }, [loadFarmers])

  const villages = useMemo(
    () =>
      [...new Set(farmers.map((farmer) => farmer.village).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b)
      ),
    [farmers]
  )

  // Reset the village filter when an edit removes the last farmer in that village,
  // otherwise the select falls back to "All villages" while still filtering.
  useEffect(() => {
    if (villageFilter && !villages.includes(villageFilter)) setVillageFilter('')
  }, [villages, villageFilter])

  const filteredFarmers = useMemo(() => {
    const needle = query.trim().toLowerCase()
    return farmers.filter((farmer) => {
      if (villageFilter && farmer.village !== villageFilter) return false
      if (!needle) return true
      return [farmer.farmerId, farmer.fullName, farmer.mobileNumber, farmer.village].some(
        (value) => String(value || '').toLowerCase().includes(needle)
      )
    })
  }, [farmers, query, villageFilter])

  async function openEdit(farmerId) {
    if (openingEditId) return
    setOpeningEditId(farmerId)
    try {
      const farmer = await fetchFarmer(farmerId)
      setFormState({ farmer })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setOpeningEditId(null)
    }
  }

  function handleSaved() {
    setFormState(null)
    setDetailVersion((version) => version + 1)
    loadFarmers({ silent: true })
  }

  async function confirmDelete() {
    if (!deletingFarmer || deleteBusy) return
    setDeleteBusy(true)
    try {
      const data = await deleteFarmer(deletingFarmer.farmerId)
      const retained = data.retainedWeighingRecords
        ? ` ${data.retainedWeighingRecords} weighing record${
            data.retainedWeighingRecords === 1 ? '' : 's'
          } kept for audit.`
        : ''
      toast.success(`${data.message}${retained}`)
      if (viewingFarmerId === deletingFarmer.farmerId) setViewingFarmerId(null)
      setDeletingFarmer(null)
      await loadFarmers({ silent: true })
    } catch (err) {
      toast.error(err.message)
    } finally {
      setDeleteBusy(false)
    }
  }

  const filtersActive = Boolean(query.trim() || villageFilter)

  return (
    <div className="container py-3 py-md-4">
      <div className="aw-page-head">
        <div>
          <h1 className="aw-page-title mb-1">Farmers</h1>
          <p className="aw-page-subtitle mb-0">
            Registered farmer profiles, contact details and hardware assignments.
          </p>
        </div>
        <button
          type="button"
          className="btn btn-success aw-btn-primary"
          onClick={() => setFormState({ farmer: null })}
        >
          <Icon name="plus" size={17} className="me-1" />
          Add New Farmer
        </button>
      </div>

      {error && (
        <div className="alert alert-danger d-flex flex-wrap align-items-center gap-2" role="alert">
          <strong>Could not load farmers.</strong>
          <span>{error}</span>
          <button
            type="button"
            className="btn btn-sm btn-outline-danger ms-auto"
            onClick={() => loadFarmers()}
          >
            Retry
          </button>
        </div>
      )}

      {viewingFarmerId ? (
        <FarmerDetail
          key={`${viewingFarmerId}-${detailVersion}`}
          farmerId={viewingFarmerId}
          onBack={() => setViewingFarmerId(null)}
          onEdit={() => openEdit(viewingFarmerId)}
          editBusy={openingEditId === viewingFarmerId}
        />
      ) : (
        <>
          <section className="aw-panel aw-toolbar-panel">
            <div className="aw-toolbar">
              <div className="aw-search">
                <span className="aw-search-icon" aria-hidden="true">
                  <Icon name="search" size={17} />
                </span>
                <input
                  type="search"
                  className="form-control"
                  placeholder="Search by name, Farmer ID or mobile number"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  aria-label="Search farmers"
                />
                {query && (
                  <button
                    type="button"
                    className="aw-search-clear"
                    onClick={() => setQuery('')}
                    aria-label="Clear search"
                  >
                    <Icon name="close" size={14} />
                  </button>
                )}
              </div>

              <select
                className="form-select aw-village-select"
                value={villageFilter}
                onChange={(event) => setVillageFilter(event.target.value)}
                aria-label="Filter by village"
              >
                <option value="">All villages</option>
                {villages.map((village) => (
                  <option key={village} value={village}>
                    {village}
                  </option>
                ))}
              </select>
            </div>

            <div className="aw-results-line">
              <span>
                Showing <strong>{filteredFarmers.length}</strong> of{' '}
                <strong>{farmers.length}</strong> farmer{farmers.length === 1 ? '' : 's'}
              </span>
              {filtersActive && (
                <button
                  type="button"
                  className="aw-link-btn"
                  onClick={() => {
                    setQuery('')
                    setVillageFilter('')
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
          </section>

          {loading ? (
            <div className="aw-panel">
              <LoadingBlock label="Loading farmers..." />
            </div>
          ) : farmers.length === 0 ? (
            <div className="aw-panel">
              <EmptyState
                title="No farmers registered yet"
                message="Add your first farmer to start recording weighings and assigning hardware."
              />
              <div className="text-center pb-3">
                <button
                  type="button"
                  className="btn btn-success aw-btn-primary"
                  onClick={() => setFormState({ farmer: null })}
                >
                  <Icon name="plus" size={17} className="me-1" />
                  Add New Farmer
                </button>
              </div>
            </div>
          ) : filteredFarmers.length === 0 ? (
            <div className="aw-panel">
              <EmptyState
                title="No matching farmers"
                message="Try a different name, Farmer ID, mobile number or village."
              />
              <div className="text-center pb-3">
                <button
                  type="button"
                  className="btn btn-outline-success"
                  onClick={() => {
                    setQuery('')
                    setVillageFilter('')
                  }}
                >
                  Clear filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <section className="aw-panel p-0 overflow-hidden d-none d-md-block">
                <div className="table-responsive">
                  <table className="table aw-table aw-farmers-table align-middle mb-0">
                    <thead>
                      <tr>
                        <th scope="col">Farmer ID</th>
                        <th scope="col">Full Name</th>
                        <th scope="col">Mobile</th>
                        <th scope="col">Village</th>
                        <th scope="col">Aadhaar</th>
                        <th scope="col">Registered</th>
                        <th scope="col">Status</th>
                        <th scope="col" className="text-end">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredFarmers.map((farmer) => (
                        <tr key={farmer.farmerId}>
                          <td>
                            <span className="aw-id-chip">{farmer.farmerId}</span>
                          </td>
                          <td>
                            {farmer.fullName ? (
                              <span className="fw-semibold">{farmer.fullName}</span>
                            ) : (
                              <span className="aw-muted">Not provided</span>
                            )}
                            {!farmer.fullName && (
                              <span className="aw-mini-badge">Profile incomplete</span>
                            )}
                          </td>
                          <td>{farmer.mobileNumber || <span className="aw-muted">—</span>}</td>
                          <td>{farmer.village || <span className="aw-muted">—</span>}</td>
                          <td className="aw-numeric">{farmer.aadhaarNumber || '—'}</td>
                          <td>{formatDate(farmer.createdAt)}</td>
                          <td>
                            <StatusBadge status={farmer.status} />
                          </td>
                          <td>
                            <div className="d-flex justify-content-end">
                              <FarmerActions
                                farmer={farmer}
                                openingEdit={openingEditId === farmer.farmerId}
                                onView={setViewingFarmerId}
                                onEdit={openEdit}
                                onDelete={setDeletingFarmer}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <div className="d-md-none aw-farmer-cards">
                {filteredFarmers.map((farmer) => (
                  <article className="aw-farmer-card" key={farmer.farmerId}>
                    <div className="d-flex align-items-start justify-content-between gap-2">
                      <div>
                        <span className="aw-id-chip">{farmer.farmerId}</span>
                        <h2 className="aw-farmer-card-name">
                          {farmer.fullName || 'Not provided'}
                        </h2>
                        {!farmer.fullName && (
                          <span className="aw-mini-badge">Profile incomplete</span>
                        )}
                      </div>
                      <StatusBadge status={farmer.status} />
                    </div>
                    <dl className="aw-farmer-card-grid">
                      <div>
                        <dt>Mobile</dt>
                        <dd>{farmer.mobileNumber || '—'}</dd>
                      </div>
                      <div>
                        <dt>Village</dt>
                        <dd>{farmer.village || '—'}</dd>
                      </div>
                      <div>
                        <dt>Aadhaar</dt>
                        <dd>{farmer.aadhaarNumber || '—'}</dd>
                      </div>
                      <div>
                        <dt>Registered</dt>
                        <dd>{formatDate(farmer.createdAt)}</dd>
                      </div>
                    </dl>
                    <FarmerActions
                      farmer={farmer}
                      openingEdit={openingEditId === farmer.farmerId}
                      onView={setViewingFarmerId}
                      onEdit={openEdit}
                      onDelete={setDeletingFarmer}
                    />
                  </article>
                ))}
              </div>
            </>
          )}
        </>
      )}

      {formState && (
        <Modal
          title={formState.farmer ? 'Edit Farmer' : 'Register New Farmer'}
          description={
            formState.farmer
              ? `Update the profile for Farmer ID ${formState.farmer.farmerId}.`
              : 'Create a farmer profile. The generated Farmer ID can be used on the hardware.'
          }
          size="lg"
          onClose={() => setFormState(null)}
        >
          <FarmerForm
            farmer={formState.farmer}
            onSaved={handleSaved}
            onCancel={() => setFormState(null)}
          />
        </Modal>
      )}

      {deletingFarmer && (
        <ConfirmDialog
          title="Delete farmer?"
          message={
            <>
              Delete <strong>{deletingFarmer.fullName || 'this farmer'}</strong> (Farmer ID{' '}
              <strong>{deletingFarmer.farmerId}</strong>)? This action cannot be undone.
            </>
          }
          note="Past weighing records are kept for audit. Any assigned hardware will be released."
          confirmLabel="Delete Farmer"
          busy={deleteBusy}
          onConfirm={confirmDelete}
          onClose={() => setDeletingFarmer(null)}
        />
      )}
    </div>
  )
}

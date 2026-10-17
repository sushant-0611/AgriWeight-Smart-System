export default function EmptyState({ title, message }) {
  return (
    <div className="text-center py-5 aw-empty">
      <div className="aw-empty-icon mb-2" aria-hidden="true">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <path d="M3 9h18M9 4v16" />
        </svg>
      </div>
      <div className="fw-semibold">{title}</div>
      {message && <div className="text-muted small mt-1">{message}</div>}
    </div>
  )
}

export default function LoadingBlock({ label = 'Loading...', compact = false }) {
  return (
    <div className={`aw-loading ${compact ? 'aw-loading-compact' : ''}`} role="status">
      <span className="spinner-border text-success" aria-hidden="true" />
      <span className="aw-loading-label">{label}</span>
    </div>
  )
}

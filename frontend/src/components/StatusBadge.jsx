export default function StatusBadge({ status }) {
  const inactive = status === 'inactive'
  return (
    <span className={`aw-badge ${inactive ? 'aw-badge-inactive' : 'aw-badge-active'}`}>
      {inactive ? 'Inactive' : 'Active'}
    </span>
  )
}

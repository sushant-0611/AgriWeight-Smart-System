const TIMEZONE = 'Asia/Kolkata'

export function formatWeight(kg) {
  if (kg === null || kg === undefined || Number.isNaN(Number(kg))) return '—'
  return `${Number(kg).toFixed(3)} kg`
}

export function formatINR(amount) {
  if (amount === null || amount === undefined || Number.isNaN(Number(amount))) return '—'
  return `₹${Number(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

export function formatDate(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: TIMEZONE,
  }).format(new Date(iso))
}

export function formatTime(iso) {
  if (!iso) return '—'
  return new Intl.DateTimeFormat('en-IN', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZone: TIMEZONE,
  }).format(new Date(iso))
}

export function formatDateTime(iso) {
  if (!iso) return '—'
  return `${formatDate(iso)}, ${formatTime(iso)}`
}

export function timeAgo(iso) {
  if (!iso) return '—'
  const diffMs = Date.now() - new Date(iso).getTime()
  if (diffMs < 0) return 'just now'
  const seconds = Math.floor(diffMs / 1000)
  if (seconds < 10) return 'just now'
  if (seconds < 60) return `${seconds} sec ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hr ago`
  const days = Math.floor(hours / 24)
  return `${days} day${days === 1 ? '' : 's'} ago`
}

export function badRequest(message) {
  const err = new Error(message)
  err.status = 400
  err.publicMessage = message
  return err
}

export function notFound(message) {
  const err = new Error(message)
  err.status = 404
  err.publicMessage = message
  return err
}

export const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next)

export function parsePageQuery(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1)
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 15))
  return { page, limit }
}

export function normalizeFarmerId(value) {
  return String(value || '').trim().toUpperCase()
}

export function normalizeMode(value) {
  const mode = String(value || '').trim().toUpperCase()
  return mode === 'AUTO' || mode === 'MANUAL' ? mode : null
}

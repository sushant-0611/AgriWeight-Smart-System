export function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: { message: `Route not found: ${req.method} ${req.originalUrl}` },
  })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, _next) {
  const status = Number(err.status) || 500
  if (status >= 500) {
    console.error(`[error] ${req.method} ${req.originalUrl}:`, err)
  }
  res.status(status).json({
    success: false,
    error: { message: err.publicMessage || 'Internal server error' },
  })
}

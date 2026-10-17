import { config } from '../config.js'

// Hardware endpoints require the shared secret in the x-api-key header.
export function deviceAuth(req, res, next) {
  if (!config.deviceApiKey) {
    return res.status(500).json({
      success: false,
      error: { message: 'Server misconfiguration: DEVICE_API_KEY is not set' },
    })
  }

  const key = req.get('x-api-key')
  if (!key || key !== config.deviceApiKey) {
    return res.status(401).json({
      success: false,
      error: { message: 'Invalid or missing API key' },
    })
  }

  next()
}

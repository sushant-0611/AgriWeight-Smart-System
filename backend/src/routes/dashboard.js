import { Router } from 'express'
import Farmer from '../models/Farmer.js'
import Device from '../models/Device.js'
import { asyncHandler } from '../utils/http.js'
import { isDeviceOnline, serializeFarmer } from '../utils/serializers.js'

const router = Router()

// GET /api/dashboard/stats — live counts for the dashboard. Every value is
// read from MongoDB; nothing is static.
router.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const now = new Date()
    const [totalFarmers, activeFarmers, devices, recent] = await Promise.all([
      Farmer.countDocuments({}),
      Farmer.countDocuments({ status: { $ne: 'inactive' } }),
      Device.find({}).select('last_seen_at assigned_farmer_id').lean(),
      Farmer.find({}).sort({ created_at: -1, _id: -1 }).limit(5).lean(),
    ])

    const registeredDevices = devices.length
    const activeDevices = devices.filter((device) =>
      isDeviceOnline(device.last_seen_at, now)
    ).length

    res.json({
      success: true,
      data: {
        totalFarmers,
        activeFarmers,
        registeredDevices,
        activeDevices,
        assignedDevices: devices.filter((device) => device.assigned_farmer_id).length,
        recentRegistrations: recent.map((farmer) => serializeFarmer(farmer)),
        generatedAt: now.toISOString(),
      },
    })
  })
)

export default router

import mongoose from 'mongoose'

const deviceSchema = new mongoose.Schema(
  {
    device_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 64,
    },
    last_seen_at: { type: Date, default: null },
    telemetry: {
      net_weight_kg: { type: Number, default: null },
      mode: { type: String, trim: true, maxlength: 10, default: null },
      farmer_id: {
        type: String,
        trim: true,
        uppercase: true,
        maxlength: 32,
        default: null,
      },
      price_per_kg: { type: Number, default: null },
      updated_at: { type: Date, default: null },
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export default mongoose.model('Device', deviceSchema)

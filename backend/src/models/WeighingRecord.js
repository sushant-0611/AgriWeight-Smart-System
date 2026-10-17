import mongoose from 'mongoose'

const weighingRecordSchema = new mongoose.Schema(
  {
    farmer_ref: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Farmer',
      required: true,
    },
    farmer_id: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
      index: true,
    },
    device_id: {
      type: String,
      required: true,
      trim: true,
      maxlength: 64,
      index: true,
    },
    weight_kg: { type: Number, required: true },
    price_per_kg: { type: Number, required: true },
    total_amount: { type: Number, required: true },
    mode: { type: String, trim: true, maxlength: 10, default: null },
    record_key: { type: String, trim: true, maxlength: 64, default: null },
    crate_number: { type: Number, default: null },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

// Idempotency: the device sends a unique record_key per save so that
// retries after a network error never create duplicate records.
weighingRecordSchema.index(
  { device_id: 1, record_key: 1 },
  { unique: true, sparse: true }
)

export default mongoose.model('WeighingRecord', weighingRecordSchema)

import mongoose from 'mongoose'

const farmerSchema = new mongoose.Schema(
  {
    farmer_id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 32,
    },
    full_name: {
      type: String,
      trim: true,
      default: null,
      maxlength: 120,
    },
    mobile_number: {
      type: String,
      trim: true,
      default: null,
      match: [/^[6-9][0-9]{9}$/, 'Mobile number must be 10 digits'],
    },
    village: {
      type: String,
      trim: true,
      default: null,
      maxlength: 80,
    },
    address: {
      type: String,
      trim: true,
      default: null,
      maxlength: 300,
    },
    aadhaar_number: {
      type: String,
      trim: true,
      default: null,
      match: [/^[0-9]{12}$/, 'Aadhaar number must be 12 digits'],
    },
    land_area_acres: {
      type: Number,
      default: null,
      min: 0,
      max: 100000,
    },
    crop_type: {
      type: String,
      trim: true,
      default: null,
      maxlength: 80,
    },
    status: {
      type: String,
      enum: ['active', 'inactive'],
      default: 'active',
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

// Aadhaar is optional; the partial index makes it unique only when present,
// so many farmers without an Aadhaar number remain valid.
farmerSchema.index(
  { aadhaar_number: 1 },
  { unique: true, partialFilterExpression: { aadhaar_number: { $type: 'string' } } }
)
farmerSchema.index({ full_name: 1 })
farmerSchema.index({ village: 1 })
farmerSchema.index({ mobile_number: 1 })

export default mongoose.model('Farmer', farmerSchema)

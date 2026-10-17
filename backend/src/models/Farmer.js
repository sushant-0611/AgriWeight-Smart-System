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
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } }
)

export default mongoose.model('Farmer', farmerSchema)

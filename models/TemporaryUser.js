import mongoose from 'mongoose'

const temporaryUserSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['customer', 'vendor'], default: 'customer' },
    storeName: { type: String, trim: true, default: '' },
    description: { type: String, trim: true, default: '' },
    lat: { type: Number, default: null },
    lng: { type: Number, default: null },
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    lastSentAt: { type: Date, default: null },
    resendCount: { type: Number, default: 0 },
    resendWindowStart: { type: Date, default: null },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true }
)

temporaryUserSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

const TemporaryUser = mongoose.model('TemporaryUser', temporaryUserSchema)

export default TemporaryUser

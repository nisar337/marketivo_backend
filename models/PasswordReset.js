import mongoose from 'mongoose'

const passwordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    otpHash: { type: String, required: true },
    otpExpiresAt: { type: Date, required: true },
    resetTokenHash: { type: String, default: null },
    resetTokenExpiresAt: { type: Date, default: null },
  },
  { timestamps: true }
)

passwordResetSchema.index({ otpExpiresAt: 1 }, { expireAfterSeconds: 0 })

const PasswordReset = mongoose.model('PasswordReset', passwordResetSchema)

export default PasswordReset

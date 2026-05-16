import mongoose from 'mongoose'

const vendorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    storeName: {
      type: String,
      required: [true, 'Store name is required'],
      trim: true,
      maxlength: 120,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      maxlength: 40,
      default: '',
    },
    website: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    businessAddress: {
      type: String,
      trim: true,
      maxlength: 500,
      default: '',
    },
    /** WGS84 — used with customer location for “nearby vendors”. Populated when address changes. */
    lat: {
      type: Number,
    },
    lng: {
      type: Number,
    },
    location: {
      type: String,
      trim: true,
      maxlength: 200,
      default: '',
    },
    logo: {
      type: String,
      default: '',
    },
    logoPublicId: {
      type: String,
      default: '',
      select: false,
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'suspended'],
      default: 'pending',
    },
  },
  { timestamps: true }
)

vendorSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.logoPublicId
    ret.verified = ret.status === 'approved'
    return ret
  },
})

const Vendor = mongoose.model('Vendor', vendorSchema)

export default Vendor

import mongoose from 'mongoose'

const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['user', 'assistant'],
      required: true,
    },
    content: {
      type: String,
      required: true,
    },
    quickLinks: {
      type: [
        {
          label: String,
          productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
          categorySlug: String,
        },
      ],
      default: [],
    },
  },
  { timestamps: true }
)

const chatSessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    messages: {
      type: [messageSchema],
      default: [],
    },
  },
  { timestamps: true }
)

chatSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 300 })

const ChatSession = mongoose.model('ChatSession', chatSessionSchema)

export default ChatSession

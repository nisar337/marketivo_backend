import mongoose from 'mongoose'

const connectDB = async () => {
  const uri = process.env.ATLASDB_URL || process.env.MONGODB_URI

  if (!uri) {
    throw new Error('Missing MONGODB_URI in environment configuration')
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    })
    console.log('MongoDB connected')
  } catch (error) {
    console.error('MongoDB connection error:', error.message)
    throw error
  }
}

export default connectDB

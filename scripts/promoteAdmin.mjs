import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/User.js'

const email = process.argv[2]?.trim().toLowerCase()
if (!email) {
  console.error('Usage: node scripts/promoteAdmin.mjs <user-email>')
  process.exit(1)
}

try {
  await connectDB()
  const user = await User.findOne({ email })
  if (!user) {
    console.error('No user found with that email.')
    process.exit(1)
  }
  user.role = 'admin'
  await user.save()
  console.log(`Updated ${user.email} to role "admin". Log in and open /admin.`)
} catch (e) {
  console.error(e.message || e)
  process.exit(1)
} finally {
  await mongoose.disconnect()
}

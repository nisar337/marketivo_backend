import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/User.js'

const name = process.argv[2]?.trim()
if (!name) {
  console.error('Usage: node scripts/promoteAdminByUsername.mjs <username>')
  process.exit(1)
}

try {
  await connectDB()
  const user = await User.findOne({ name })
  if (!user) {
    console.error('No user found with that username.')
    process.exit(1)
  }
  user.role = 'admin'
  await user.save()
  console.log(`Updated user "${user.name}" (${user.email}) to role "admin".`)
  console.log('You can now log in at /admin using this username or email.')
} catch (e) {
  console.error(e.message || e)
  process.exit(1)
} finally {
  await mongoose.disconnect()
}
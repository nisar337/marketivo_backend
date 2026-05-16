import 'dotenv/config'
import mongoose from 'mongoose'
import connectDB from '../config/db.js'
import User from '../models/User.js'

const email = process.argv[2]?.trim().toLowerCase()
const password = process.argv[3]
const name = (process.argv[4] || 'Admin').trim()

if (!email || !password) {
  console.error('Usage: node scripts/createAdminUser.mjs <email> <password> [displayName]')
  process.exit(1)
}

try {
  await connectDB()

  let user = await User.findOne({ email })
  if (user) {
    user.role = 'admin'
    user.name = name
    user.password = password
    await user.save()
    console.log(`Updated existing user to admin: ${email}`)
  } else {
    user = await User.create({
      name,
      email,
      password,
      role: 'admin',
    })
    console.log(`Created admin: ${email}`)
  }
  console.log('You can log in at the app with this email and password, then open /admin.')
} catch (e) {
  console.error(e.message || e)
  process.exit(1)
} finally {
  await mongoose.disconnect()
}

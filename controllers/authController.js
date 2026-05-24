import jwt from 'jsonwebtoken'
import crypto from 'crypto'
import User from '../models/User.js'
import Vendor from '../models/Vendor.js'
import TemporaryUser from '../models/TemporaryUser.js'
import PasswordReset from '../models/PasswordReset.js'
import { uploadAvatarToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js'
import { isValidLatLng } from '../utils/geo.js'
import { reverseGeocodeLabel } from '../utils/nominatim.js'
import { sendEmail, buildOtpEmail } from '../utils/email.js'

const userJwtSecret = process.env.USER_JWT_SECRET || process.env.JWT_SECRET
const adminJwtSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET

const generateToken = (id, role = 'customer') => {
  const secret = role === 'admin' ? adminJwtSecret : userJwtSecret
  return jwt.sign({ id, role }, secret, { expiresIn: '7d' })
}

const setAuthCookie = (res, token) => {
  res.cookie('marketivo_token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  })
}

const generateOtp = () => String(crypto.randomInt(100000, 999999))

const hashValue = (value) => crypto.createHash('sha256').update(value).digest('hex')

const normalizeEmail = (email) => String(email).toLowerCase().trim()

const toNumber = (value) => (typeof value === 'string' ? parseFloat(value) : value)

const sendOtpEmail = async (email, otp, purpose) => {
  const { subject, html, text } = buildOtpEmail({ otp, purpose })
  await sendEmail({ to: email, subject, html, text })
}

const buildAuthResponse = async (user) => {
  const token = generateToken(user._id, user.role)
  const userPayload = await buildAuthUserPayload(user)
  return { token, userPayload }
}

const createVendorProfile = async ({ userId, storeName, description, lat, lng }) => {
  let label = ''
  try {
    label = await reverseGeocodeLabel(lat, lng)
  } catch {
    label = `${Number(lat).toFixed(4)}, ${Number(lng).toFixed(4)}`
  }
  await Vendor.create({
    userId,
    storeName,
    description: description || '',
    lat,
    lng,
    location: label,
  })
}

function formatCustomerLocation(userDoc) {
  const loc = userDoc?.customerLocation
  if (
    !loc ||
    loc.lat == null ||
    loc.lng == null ||
    !Number.isFinite(loc.lat) ||
    !Number.isFinite(loc.lng)
  ) {
    return null
  }
  return {
    label: loc.label || '',
    lat: loc.lat,
    lng: loc.lng,
  }
}

export const registerRequest = async (req, res, next) => {
  try {
    const { name, email, password, role, storeName, description, lat, lng } = req.body

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const existingUser = await User.findOne({ email: normalizedEmail })
    if (existingUser) {
      return res.status(409).json({ message: 'A user with this email already exists.' })
    }

    const userRole = role === 'vendor' ? 'vendor' : 'customer'

    const parsedLat = toNumber(lat)
    const parsedLng = toNumber(lng)

    if (userRole === 'vendor') {
      if (!storeName) {
        return res.status(400).json({ message: 'Store name is required for vendor registration.' })
      }
      if (!isValidLatLng(parsedLat, parsedLng)) {
        return res.status(400).json({
          message: 'GPS location is required for vendor registration. Please share your location.',
        })
      }
    }

    const now = new Date()
    const otp = generateOtp()
    const otpHash = hashValue(otp)
    const otpExpiresAt = new Date(now.getTime() + 5 * 60 * 1000)

    const tempUser = await TemporaryUser.findOne({ email: normalizedEmail })
    if (tempUser?.lastSentAt && now.getTime() - tempUser.lastSentAt.getTime() < 60 * 1000) {
      return res.status(429).json({ message: 'Please wait before requesting another OTP.' })
    }

    const payload = {
      name: String(name).trim(),
      email: normalizedEmail,
      password,
      role: userRole,
      storeName: storeName || '',
      description: description || '',
      lat: parsedLat ?? null,
      lng: parsedLng ?? null,
      otpHash,
      otpExpiresAt,
      expiresAt: otpExpiresAt,
      lastSentAt: now,
      resendCount: 1,
      resendWindowStart: now,
    }

    await TemporaryUser.findOneAndUpdate({ email: normalizedEmail }, payload, { upsert: true, new: true })

    await sendOtpEmail(normalizedEmail, otp, 'Registration')

    res.json({ message: 'OTP sent to your email.' })
  } catch (error) {
    next(error)
  }
}

export const resendRegisterOtp = async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const tempUser = await TemporaryUser.findOne({ email: normalizedEmail })
    if (!tempUser) {
      return res.status(404).json({ message: 'No pending registration found for this email.' })
    }

    const now = new Date()
    if (tempUser.lastSentAt && now.getTime() - tempUser.lastSentAt.getTime() < 60 * 1000) {
      return res.status(429).json({ message: 'Please wait 60 seconds before requesting another OTP.' })
    }

    const windowStart = tempUser.resendWindowStart || now
    const withinWindow = now.getTime() - windowStart.getTime() < 60 * 60 * 1000
    const resendCount = withinWindow ? tempUser.resendCount : 0

    if (resendCount >= 5) {
      return res.status(429).json({ message: 'You have reached the maximum number of OTP requests. Try again later.' })
    }

    const otp = generateOtp()
    const otpHash = hashValue(otp)
    const otpExpiresAt = new Date(now.getTime() + 5 * 60 * 1000)

    tempUser.otpHash = otpHash
    tempUser.otpExpiresAt = otpExpiresAt
    tempUser.expiresAt = otpExpiresAt
    tempUser.lastSentAt = now
    tempUser.resendWindowStart = withinWindow ? windowStart : now
    tempUser.resendCount = resendCount + 1
    await tempUser.save()

    await sendOtpEmail(normalizedEmail, otp, 'Registration')

    res.json({ message: 'OTP resent successfully.' })
  } catch (error) {
    next(error)
  }
}

export const verifyRegistration = async (req, res, next) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const tempUser = await TemporaryUser.findOne({ email: normalizedEmail })
    if (!tempUser) {
      return res.status(404).json({ message: 'Registration request not found.' })
    }

    if (!tempUser.otpExpiresAt || tempUser.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' })
    }

    const otpHash = hashValue(String(otp))
    if (otpHash !== tempUser.otpHash) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' })
    }

    const user = await User.create({
      name: tempUser.name,
      email: tempUser.email,
      password: tempUser.password,
      role: tempUser.role,
    })

    if (tempUser.role === 'vendor') {
      await createVendorProfile({
        userId: user._id,
        storeName: tempUser.storeName,
        description: tempUser.description,
        lat: tempUser.lat,
        lng: tempUser.lng,
      })
    }

    await TemporaryUser.deleteOne({ _id: tempUser._id })

    const { token, userPayload } = await buildAuthResponse(user)
    setAuthCookie(res, token)

    res.status(201).json({
      message: 'Registration verified.',
      token,
      user: userPayload,
    })
  } catch (error) {
    next(error)
  }
}

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const user = await User.findOne({ email: normalizedEmail })
    if (!user) {
      return res.json({ message: 'If this email exists, an OTP has been sent.' })
    }

    const otp = generateOtp()
    const otpHash = hashValue(otp)
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000)

    await PasswordReset.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        email: normalizedEmail,
        otpHash,
        otpExpiresAt,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
      { upsert: true, new: true }
    )

    await sendOtpEmail(normalizedEmail, otp, 'Password Reset')

    res.json({ message: 'OTP sent to your email.' })
  } catch (error) {
    next(error)
  }
}

export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body
    if (!email || !otp) {
      return res.status(400).json({ message: 'Email and OTP are required.' })
    }

    const normalizedEmail = normalizeEmail(email)
    const reset = await PasswordReset.findOne({ email: normalizedEmail })
    if (!reset) {
      return res.status(404).json({ message: 'OTP request not found.' })
    }

    if (!reset.otpExpiresAt || reset.otpExpiresAt < new Date()) {
      return res.status(400).json({ message: 'OTP expired. Please request a new one.' })
    }

    if (hashValue(String(otp)) !== reset.otpHash) {
      return res.status(400).json({ message: 'Invalid OTP. Please try again.' })
    }

    const resetToken = crypto.randomBytes(32).toString('hex')
    reset.resetTokenHash = hashValue(resetToken)
    reset.resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000)
    await reset.save()

    res.json({ message: 'OTP verified.', resetToken })
  } catch (error) {
    next(error)
  }
}

export const resetPassword = async (req, res, next) => {
  try {
    const { resetToken, newPassword } = req.body
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required.' })
    }

    const reset = await PasswordReset.findOne({
      resetTokenHash: hashValue(String(resetToken)),
      resetTokenExpiresAt: { $gt: new Date() },
    })

    if (!reset) {
      return res.status(400).json({ message: 'Reset token is invalid or expired.' })
    }

    const user = await User.findById(reset.userId).select('+password')
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    user.password = newPassword
    await user.save()
    await PasswordReset.deleteOne({ _id: reset._id })

    res.json({ message: 'Password reset successfully.' })
  } catch (error) {
    next(error)
  }
}

async function buildAuthUserPayload(userDoc, preloadedVendor) {
  const payload = {
    id: userDoc._id,
    name: userDoc.name,
    email: userDoc.email,
    role: userDoc.role,
    avatarUrl: userDoc.avatarUrl || '',
    customerLocation: formatCustomerLocation(userDoc),
  }
  if (userDoc.role === 'vendor' || userDoc.role === 'admin') {
    payload.vendor =
      preloadedVendor !== undefined ? preloadedVendor : await Vendor.findOne({ userId: userDoc._id })
  }
  return payload
}

export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' })
    }

    const user = await User.findOne({ email }).select('+password')
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    if (user.role === 'admin') {
      return res.status(403).json({ message: 'Admin accounts must use the admin login portal.' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password.' })
    }

    const { token, userPayload } = await buildAuthResponse(user)

    setAuthCookie(res, token)

    res.json({
      message: 'Login successful.',
      token,
      user: userPayload,
    })
  } catch (error) {
    next(error)
  }
}

export const adminLogin = async (req, res, next) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      return res.status(400).json({ message: 'Email/username and password are required.' })
    }

    const isEmail = email.includes('@')
    const query = isEmail ? { email } : { name: email }
    const user = await User.findOne(query).select('+password')
    if (!user) {
      return res.status(401).json({ message: 'Invalid email/username or password.' })
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ message: 'This portal is for administrators only.' })
    }

    const isMatch = await user.comparePassword(password)
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email/username or password.' })
    }

    const { token, userPayload } = await buildAuthResponse(user)

    setAuthCookie(res, token)

    res.json({
      message: 'Admin login successful.',
      token,
      user: userPayload,
    })
  } catch (error) {
    next(error)
  }
}

export const getMe = async (req, res, next) => {
  try {
    const user = req.user
    const vendorProfile =
      user.role === 'vendor' || user.role === 'admin'
        ? await Vendor.findOne({ userId: user._id })
        : undefined

    const userPayload = await buildAuthUserPayload(user, vendorProfile)
    res.json({ user: userPayload })
  } catch (error) {
    next(error)
  }
}

export const updateCustomerLocation = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can save a shopping location.' })
    }

    const clear = req.body.clear === true || req.body.clear === 'true'
    const user = await User.findById(req.user._id)
    if (!user) {
      return res.status(404).json({ message: 'User not found.' })
    }

    if (clear) {
      user.set('customerLocation', { label: '', lat: null, lng: null })
      await user.save()
      return res.json({
        message: 'Shopping location cleared.',
        user: await buildAuthUserPayload(user),
      })
    }

    let { label, lat, lng } = req.body
    lat = typeof lat === 'string' ? parseFloat(lat) : lat
    lng = typeof lng === 'string' ? parseFloat(lng) : lng

    if (!isValidLatLng(lat, lng)) {
      return res.status(400).json({ message: 'Valid latitude and longitude are required.' })
    }

    label = String(label ?? '').trim().slice(0, 500)
    if (!label) {
      try {
        label = await reverseGeocodeLabel(lat, lng)
      } catch {
        label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      }
    }

    user.customerLocation = { label, lat, lng }
    await user.save()

    res.json({
      message: 'Shopping location saved.',
      user: await buildAuthUserPayload(user),
    })
  } catch (error) {
    next(error)
  }
}

export const uploadCustomerAvatar = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can upload a profile picture.' })
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'No image file received. Use field name "avatar".' })
    }

    const user = await User.findById(req.user._id).select('+avatarPublicId')

    try {
      const { url, publicId } = await uploadAvatarToCloudinary(req.file.buffer)

      if (user.avatarPublicId) {
        try {
          await deleteFromCloudinary(user.avatarPublicId)
        } catch {
          /* ignore cleanup errors */
        }
      }

      user.avatarUrl = url
      user.avatarPublicId = publicId
      await user.save()
    } catch (cloudErr) {
      console.error('Avatar upload:', cloudErr)
      return res.status(503).json({
        message:
          'Image upload is temporarily unavailable. Check that Cloudinary is configured on the server.',
      })
    }

    res.json({
      message: 'Profile picture updated.',
      user: await buildAuthUserPayload(user),
    })
  } catch (error) {
    next(error)
  }
}

export const deleteCustomerAvatar = async (req, res, next) => {
  try {
    if (req.user.role !== 'customer') {
      return res.status(403).json({ message: 'Only customers can remove a profile picture.' })
    }

    const user = await User.findById(req.user._id).select('+avatarPublicId')

    if (user.avatarPublicId) {
      try {
        await deleteFromCloudinary(user.avatarPublicId)
      } catch {
        /* ignore */
      }
    }

    user.avatarUrl = ''
    user.avatarPublicId = ''
    await user.save()

    res.json({
      message: 'Profile picture removed.',
      user: await buildAuthUserPayload(user),
    })
  } catch (error) {
    next(error)
  }
}

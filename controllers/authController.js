import jwt from 'jsonwebtoken'
import User from '../models/User.js'
import Vendor from '../models/Vendor.js'
import { uploadAvatarToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js'
import { isValidLatLng } from '../utils/geo.js'
import { reverseGeocodeLabel } from '../utils/nominatim.js'

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '7d' })
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

export const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body

    const existingUser = await User.findOne({ email })
    if (existingUser) {
      return res.status(409).json({ message: 'A user with this email already exists.' })
    }

    const userRole = role === 'vendor' ? 'vendor' : 'customer'

    const user = await User.create({ name, email, password, role: userRole })

    if (userRole === 'vendor') {
      const { storeName, description } = req.body
      let { lat, lng } = req.body
      lat = typeof lat === 'string' ? parseFloat(lat) : lat
      lng = typeof lng === 'string' ? parseFloat(lng) : lng

      if (!storeName) {
        await User.findByIdAndDelete(user._id)
        return res.status(400).json({ message: 'Store name is required for vendor registration.' })
      }
      if (!isValidLatLng(lat, lng)) {
        await User.findByIdAndDelete(user._id)
        return res.status(400).json({
          message: 'GPS location is required for vendor registration. Please share your location.',
        })
      }

      let label = ''
      try {
        label = await reverseGeocodeLabel(lat, lng)
      } catch {
        label = `${lat.toFixed(4)}, ${lng.toFixed(4)}`
      }

      await Vendor.create({
        userId: user._id,
        storeName,
        description: description || '',
        lat,
        lng,
        location: label,
      })
    }

    const token = generateToken(user._id)
    const userPayload = await buildAuthUserPayload(user)

    res.status(201).json({
      message: 'Registration successful.',
      token,
      user: userPayload,
    })
  } catch (error) {
    next(error)
  }
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

    const token = generateToken(user._id)
    const userPayload = await buildAuthUserPayload(user)

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

    const token = generateToken(user._id)
    const userPayload = await buildAuthUserPayload(user)

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

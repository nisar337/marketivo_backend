import Vendor from '../models/Vendor.js'
import { uploadVendorShopLogoToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js'
import { haversineKm, isValidLatLng } from '../utils/geo.js'
import { forwardGeocode } from '../utils/nominatim.js'

export const getNearbyVendors = async (req, res, next) => {
  try {
    const lat = typeof req.query.lat === 'string' ? parseFloat(req.query.lat) : req.query.lat
    const lng = typeof req.query.lng === 'string' ? parseFloat(req.query.lng) : req.query.lng
    let radiusKm = typeof req.query.radiusKm === 'string' ? parseFloat(req.query.radiusKm) : req.query.radiusKm
    if (!Number.isFinite(radiusKm) || radiusKm < 1) radiusKm = 25
    if (radiusKm > 200) radiusKm = 200

    if (!isValidLatLng(lat, lng)) {
      return res.status(400).json({ message: 'Query parameters lat and lng must be valid coordinates.' })
    }

    const vendors = await Vendor.find({
      status: 'approved',
      lat: { $exists: true, $ne: null },
      lng: { $exists: true, $ne: null },
    })
      .select('storeName description phone website businessAddress logo status userId lat lng')
      .lean()

    const withDist = vendors
      .map((v) => ({
        ...v,
        distanceKm: Math.round(haversineKm(lat, lng, v.lat, v.lng) * 10) / 10,
      }))
      .filter((v) => Number.isFinite(v.distanceKm) && v.distanceKm <= radiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)

    res.json({ vendors: withDist, radiusKm, origin: { lat, lng } })
  } catch (error) {
    next(error)
  }
}

export const getAllVendors = async (req, res, next) => {
  try {
    const vendors = await Vendor.find({ status: 'approved' })
      .select('storeName description phone website businessAddress logo status userId lat lng')
      .sort({ createdAt: -1 })

    res.json({ vendors })
  } catch (error) {
    next(error)
  }
}

export const getVendorById = async (req, res, next) => {
  try {
    const vendor = await Vendor.findOne({ userId: req.params.id, status: 'approved' })
      .select('storeName description phone website businessAddress logo status userId lat lng')

    if (!vendor) {
      return res.status(404).json({ message: 'Vendor not found.' })
    }

    res.json({ vendor })
  } catch (error) {
    next(error)
  }
}

export const uploadShopLogo = async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only vendors can update a shop logo.' })
    }
    if (!req.file?.buffer) {
      return res.status(400).json({ message: 'No image file received. Use field name "logo".' })
    }

    const vendor = await Vendor.findOne({ userId: req.user._id }).select('+logoPublicId')
    if (!vendor) {
      return res.status(404).json({ message: 'Shop profile not found. Register as a vendor first.' })
    }

    try {
      const { url, publicId } = await uploadVendorShopLogoToCloudinary(req.file.buffer)

      if (vendor.logoPublicId) {
        try {
          await deleteFromCloudinary(vendor.logoPublicId)
        } catch {
          /* ignore */
        }
      }

      vendor.logo = url
      vendor.logoPublicId = publicId
      await vendor.save()
    } catch (cloudErr) {
      console.error('Shop logo upload:', cloudErr)
      return res.status(503).json({
        message:
          'Image upload is temporarily unavailable. Check that Cloudinary is configured on the server.',
      })
    }

    res.json({
      message: 'Shop logo updated.',
      vendor: vendor.toJSON(),
    })
  } catch (error) {
    next(error)
  }
}

export const deleteShopLogo = async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only vendors can remove a shop logo.' })
    }

    const vendor = await Vendor.findOne({ userId: req.user._id }).select('+logoPublicId')
    if (!vendor) {
      return res.status(404).json({ message: 'Shop profile not found.' })
    }

    if (vendor.logoPublicId) {
      try {
        await deleteFromCloudinary(vendor.logoPublicId)
      } catch {
        /* ignore */
      }
    }

    vendor.logo = ''
    vendor.logoPublicId = ''
    await vendor.save()

    res.json({
      message: 'Shop logo removed.',
      vendor: vendor.toJSON(),
    })
  } catch (error) {
    next(error)
  }
}

export const updateVendorProfile = async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Only vendors can update shop profile.' })
    }

    const vendor = await Vendor.findOne({ userId: req.user._id })
    if (!vendor) {
      return res.status(404).json({ message: 'Shop profile not found.' })
    }

    const { storeName, description, phone, website, businessAddress } = req.body

    if (storeName !== undefined) {
      const name = String(storeName).trim()
      if (!name) {
        return res.status(400).json({ message: 'Store name cannot be empty.' })
      }
      vendor.storeName = name.slice(0, 120)
    }
    if (description !== undefined) {
      vendor.description = String(description ?? '').slice(0, 1000)
    }
    if (phone !== undefined) {
      vendor.phone = String(phone ?? '').trim().slice(0, 40)
    }
    if (website !== undefined) {
      vendor.website = String(website ?? '').trim().slice(0, 500)
    }
    let addressChanged = false

    if (businessAddress !== undefined) {
      vendor.businessAddress = String(businessAddress ?? '').trim().slice(0, 500)
      addressChanged = true
    }

    // Handle location field (maps to businessAddress for search/display)
    const { location } = req.body
    if (location !== undefined) {
      vendor.businessAddress = String(location ?? '').trim().slice(0, 500)
      addressChanged = true
    }

    if (addressChanged) {
      const addr = vendor.businessAddress?.trim()
      if (addr) {
        try {
          const g = await forwardGeocode(addr)
          if (g && isValidLatLng(g.lat, g.lng)) {
            vendor.lat = g.lat
            vendor.lng = g.lng
          }
        } catch {
          /* geocoding is best-effort */
        }
      } else {
        vendor.set('lat', undefined)
        vendor.set('lng', undefined)
      }
    }

    await vendor.save()

    res.json({
      message: 'Shop profile updated.',
      vendor: vendor.toJSON(),
    })
  } catch (error) {
    next(error)
  }
}

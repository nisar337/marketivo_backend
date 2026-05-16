import { searchPlaces, reverseGeocodeLabel } from '../utils/nominatim.js'
import { isValidLatLng } from '../utils/geo.js'

export const searchLocations = async (req, res, next) => {
  try {
    const q = String(req.query.q ?? '').trim()
    if (!q) {
      return res.json({ results: [] })
    }
    const results = await searchPlaces(q)
    res.json({ results })
  } catch (error) {
    next(error)
  }
}

export const reverseLocation = async (req, res, next) => {
  try {
    let lat = req.body.lat
    let lng = req.body.lng
    lat = typeof lat === 'string' ? parseFloat(lat) : lat
    lng = typeof lng === 'string' ? parseFloat(lng) : lng
    if (!isValidLatLng(lat, lng)) {
      return res.status(400).json({ message: 'Valid lat and lng are required.' })
    }
    const label = await reverseGeocodeLabel(lat, lng)
    res.json({
      location: {
        lat,
        lng,
        label,
      },
    })
  } catch (error) {
    next(error)
  }
}

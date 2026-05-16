/**
 * Forward geocoding via OpenStreetMap Nominatim.
 * @see https://operations.osmfoundation.org/policies/nominatim/
 */
const UA = 'Marketivo/1.0 (https://github.com; geocoding for local marketplace)'

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      'User-Agent': UA,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    throw new Error(`Nominatim HTTP ${res.status}`)
  }
  return res.json()
}

/**
 * @param {string} query
 * @returns {Promise<Array<{ label: string, lat: number, lng: number }>>}
 */
export async function searchPlaces(query) {
  const q = String(query ?? '').trim()
  if (!q || q.length < 2) {
    return []
  }
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(q.slice(0, 240))}`
  const data = await fetchJson(url)
  if (!Array.isArray(data)) return []
  return data
    .map((hit) => {
      const lat = parseFloat(hit.lat)
      const lng = parseFloat(hit.lon)
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
      return {
        label: String(hit.display_name || '').slice(0, 500),
        lat,
        lng,
      }
    })
    .filter(Boolean)
}

/**
 * Best-effort coords for a free-text address (first Nominatim hit).
 * @param {string} query
 * @returns {Promise<{ lat: number, lng: number, label: string } | null>}
 */
export async function forwardGeocode(query) {
  const list = await searchPlaces(query)
  if (!list.length) return null
  const top = list[0]
  return { lat: top.lat, lng: top.lng, label: top.label }
}

/**
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string>}
 */
export async function reverseGeocodeLabel(lat, lng) {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`
  const data = await fetchJson(url)
  const label = data?.display_name
  return typeof label === 'string' ? label.slice(0, 500) : ''
}

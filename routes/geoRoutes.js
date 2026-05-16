import { Router } from 'express'
import { searchLocations, reverseLocation } from '../controllers/geoController.js'

const router = Router()

router.get('/search', searchLocations)
router.post('/reverse', reverseLocation)

export default router

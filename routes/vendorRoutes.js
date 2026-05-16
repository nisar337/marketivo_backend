import { Router } from 'express'
import authMiddleware from '../middleware/authMiddleware.js'
import roleMiddleware from '../middleware/roleMiddleware.js'
import upload from '../middleware/upload.js'
import {
  getNearbyVendors,
  getAllVendors,
  getVendorById,
  uploadShopLogo,
  deleteShopLogo,
  updateVendorProfile,
} from '../controllers/vendorController.js'

const router = Router()

const handleUpload = (req, res, next) => {
  upload.single('logo')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ message: err.message || 'Invalid file upload.' })
    }
    next()
  })
}

router.get('/nearby', getNearbyVendors)
router.get('/', getAllVendors)
router.get('/:id', getVendorById)

router.post(
  '/me/shop-logo',
  authMiddleware,
  roleMiddleware('vendor', 'admin'),
  handleUpload,
  uploadShopLogo
)
router.delete('/me/shop-logo', authMiddleware, roleMiddleware('vendor', 'admin'), deleteShopLogo)
router.patch('/me', authMiddleware, roleMiddleware('vendor', 'admin'), updateVendorProfile)

export default router

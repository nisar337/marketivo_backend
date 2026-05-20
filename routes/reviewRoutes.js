import { Router } from 'express'
import {
  createReview,
  deleteReview,
  getProductReviews,
  getVendorReviews,
} from '../controllers/reviewController.js'
import authMiddleware from '../middleware/authMiddleware.js'
import roleMiddleware from '../middleware/roleMiddleware.js'

const router = Router()

router.get('/product/:productId', getProductReviews)
router.get('/vendor', authMiddleware, roleMiddleware('vendor', 'admin'), getVendorReviews)
router.post('/', authMiddleware, roleMiddleware('customer', 'admin'), createReview)
router.delete('/:id', authMiddleware, roleMiddleware('vendor', 'admin'), deleteReview)

export default router

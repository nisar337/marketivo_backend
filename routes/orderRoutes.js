import { Router } from 'express'
import {
  createOrder,
  getMyOrders,
  getVendorOrders,
  updateOrderStatus,
  deleteOrder,
} from '../controllers/orderController.js'
import authMiddleware from '../middleware/authMiddleware.js'
import roleMiddleware from '../middleware/roleMiddleware.js'

const router = Router()

router.post('/', authMiddleware, createOrder)
router.get('/mine', authMiddleware, getMyOrders)
router.get('/vendor', authMiddleware, roleMiddleware('vendor', 'admin'), getVendorOrders)
router.put('/:id/status', authMiddleware, roleMiddleware('vendor', 'admin'), updateOrderStatus)
router.delete('/:id', authMiddleware, roleMiddleware('vendor', 'admin'), deleteOrder)

export default router

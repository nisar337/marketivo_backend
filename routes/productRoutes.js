import { Router } from 'express'
import {
  createProduct,
  getProducts,
  getProductById,
  updateProduct,
  deleteProduct,
  getVendorProducts,
} from '../controllers/productController.js'
import authMiddleware from '../middleware/authMiddleware.js'
import optionalAuthMiddleware from '../middleware/optionalAuthMiddleware.js'
import roleMiddleware from '../middleware/roleMiddleware.js'
import upload from '../middleware/upload.js'

const router = Router()

router.get('/', getProducts)
router.get('/vendor', authMiddleware, getVendorProducts)
router.get('/mine', authMiddleware, roleMiddleware('vendor', 'admin'), getVendorProducts)
router.get('/:id', optionalAuthMiddleware, getProductById)

router.post(
  '/',
  authMiddleware,
  roleMiddleware('vendor', 'admin'),
  upload.array('images', 5),
  createProduct
)

router.put(
  '/:id',
  authMiddleware,
  roleMiddleware('vendor', 'admin'),
  upload.array('images', 5),
  updateProduct
)

router.delete(
  '/:id',
  authMiddleware,
  roleMiddleware('vendor', 'admin'),
  deleteProduct
)

export default router

import { Router } from 'express'
import authMiddleware from '../middleware/authMiddleware.js'
import roleMiddleware from '../middleware/roleMiddleware.js'
import { listUsers, listShops, updateShopStatus, deleteShop, getVendorProducts, deleteProduct, getAllOrders } from '../controllers/adminController.js'

const router = Router()

router.use(authMiddleware, roleMiddleware('admin'))

router.get('/users', listUsers)
router.get('/shops', listShops)
router.patch('/shops/:id/status', updateShopStatus)
router.delete('/shops/:id', deleteShop)
router.get('/shops/:id/products', getVendorProducts)
router.delete('/products/:id', deleteProduct)
router.get('/orders', getAllOrders)

export default router

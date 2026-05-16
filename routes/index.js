import { Router } from 'express'
import authRoutes from './authRoutes.js'
import productRoutes from './productRoutes.js'
import categoryRoutes from './categoryRoutes.js'
import orderRoutes from './orderRoutes.js'
import vendorRoutes from './vendorRoutes.js'
import adminRoutes from './adminRoutes.js'
import aiRoutes from './aiRoutes.js'
import geoRoutes from './geoRoutes.js'

const router = Router()

router.get('/', (_req, res) => {
  res.json({ message: 'Marketivo API v1' })
})

router.use('/auth', authRoutes)
router.use('/products', productRoutes)
router.use('/categories', categoryRoutes)
router.use('/orders', orderRoutes)
router.use('/vendors', vendorRoutes)
router.use('/admin', adminRoutes)
router.use('/ai', aiRoutes)
router.use('/geo', geoRoutes)

export default router

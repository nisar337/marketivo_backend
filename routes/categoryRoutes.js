import { Router } from 'express'
import { getCategories, createCategory } from '../controllers/categoryController.js'
import authMiddleware from '../middleware/authMiddleware.js'
import roleMiddleware from '../middleware/roleMiddleware.js'

const router = Router()

router.get('/', getCategories)
router.post('/', authMiddleware, roleMiddleware('admin'), createCategory)

export default router

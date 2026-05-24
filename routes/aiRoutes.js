import { Router } from 'express'
import { chat, getHistory, clearHistory } from '../controllers/aiController.js'
import optionalAuthMiddleware from '../middleware/optionalAuthMiddleware.js'

const router = Router()

router.post('/chat', optionalAuthMiddleware, chat)
router.get('/history', optionalAuthMiddleware, getHistory)
router.delete('/history', optionalAuthMiddleware, clearHistory)

export default router

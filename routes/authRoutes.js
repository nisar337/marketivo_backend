import { Router } from 'express'
import {
  registerRequest,
  resendRegisterOtp,
  verifyRegistration,
  login,
  adminLogin,
  forgotPassword,
  verifyOtp,
  resetPassword,
  getMe,
  updateCustomerLocation,
  uploadCustomerAvatar,
  deleteCustomerAvatar,
} from '../controllers/authController.js'
import authMiddleware from '../middleware/authMiddleware.js'
import upload from '../middleware/upload.js'

const router = Router()

router.post('/register-request', registerRequest)
router.post('/verify-registration', verifyRegistration)
router.post('/resend-register-otp', resendRegisterOtp)
router.post('/login', login)
router.post('/admin/login', adminLogin)
router.post('/forgot-password', forgotPassword)
router.post('/verify-otp', verifyOtp)
router.post('/reset-password', resetPassword)
router.get('/me', authMiddleware, getMe)
router.patch('/me/location', authMiddleware, updateCustomerLocation)

router.post(
  '/me/avatar',
  authMiddleware,
  (req, res, next) => {
    upload.single('avatar')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ message: err.message || 'Invalid file upload.' })
      }
      next()
    })
  },
  uploadCustomerAvatar
)
router.delete('/me/avatar', authMiddleware, deleteCustomerAvatar)

export default router

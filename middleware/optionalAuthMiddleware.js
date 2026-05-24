import jwt from 'jsonwebtoken'
import User from '../models/User.js'

/** Sets req.user when a valid Bearer token is present; otherwise req.user stays undefined. */
const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next()
    }

    const token = authHeader.split(' ')[1]
    const userSecret = process.env.USER_JWT_SECRET || process.env.JWT_SECRET
    const adminSecret = process.env.ADMIN_JWT_SECRET || process.env.JWT_SECRET
    let decoded
    try {
      decoded = jwt.verify(token, userSecret)
    } catch {
      decoded = jwt.verify(token, adminSecret)
    }
    const user = await User.findById(decoded.id)
    if (user) {
      req.user = user
    }
    next()
  } catch {
    next()
  }
}

export default optionalAuthMiddleware

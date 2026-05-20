import mongoose from 'mongoose'
import Review from '../models/Review.js'
import Product from '../models/Product.js'

export const createReview = async (req, res, next) => {
  try {
    const { productId, rating, comment } = req.body

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product id.' })
    }

    const product = await Product.findById(productId).select('vendorId')
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    const existing = await Review.findOne({ product: productId, user: req.user._id })
    if (existing) {
      return res.status(400).json({ message: 'You already reviewed this product.' })
    }

    const review = await Review.create({
      product: productId,
      user: req.user._id,
      vendorId: product.vendorId,
      rating: Number(rating),
      comment: comment?.trim() || '',
    })

    const populatedReview = await review.populate('user', 'name avatarUrl')

    res.status(201).json({ message: 'Review submitted.', review: populatedReview })
  } catch (error) {
    next(error)
  }
}

export const getProductReviews = async (req, res, next) => {
  try {
    const { productId } = req.params

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: 'Invalid product id.' })
    }

    const reviews = await Review.find({ product: productId })
      .populate('user', 'name avatarUrl')
      .sort({ createdAt: -1 })
      .lean()

    const reviewCount = reviews.length
    const averageRating = reviewCount
      ? reviews.reduce((sum, review) => sum + (review.rating || 0), 0) / reviewCount
      : 0

    res.json({ reviews, reviewCount, averageRating })
  } catch (error) {
    next(error)
  }
}

export const getVendorReviews = async (req, res, next) => {
  try {
    const vendorId = req.user.role === 'admin' && req.query.vendorId
      ? req.query.vendorId
      : req.user._id

    if (!mongoose.Types.ObjectId.isValid(vendorId)) {
      return res.status(400).json({ message: 'Invalid vendor id.' })
    }

    const reviews = await Review.find({ vendorId })
      .populate('user', 'name avatarUrl')
      .populate('product', 'name images')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ reviews })
  } catch (error) {
    next(error)
  }
}

export const deleteReview = async (req, res, next) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: 'Invalid review id.' })
    }

    const review = await Review.findById(id)
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' })
    }

    if (req.user.role !== 'admin' && review.vendorId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized to delete this review.' })
    }

    await review.deleteOne()

    res.json({ message: 'Review deleted.' })
  } catch (error) {
    next(error)
  }
}

import mongoose from 'mongoose'
import Product from '../models/Product.js'
import Vendor from '../models/Vendor.js'
import '../models/Category.js'
import { uploadToCloudinary, deleteFromCloudinary } from '../config/cloudinary.js'

export const createProduct = async (req, res, next) => {
  try {
    if (req.user.role === 'vendor') {
      const shop = await Vendor.findOne({ userId: req.user._id })
      if (!shop || shop.status !== 'approved') {
        return res.status(403).json({
          message: 'Your shop must be approved by an administrator before you can list products.',
        })
      }
    }

    const { name, description, price, discountPrice, stockQuantity, category } = req.body

    const images = []
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer)
        images.push(result)
      }
    }

    const product = await Product.create({
      name,
      description: description || '',
      price,
      discountPrice: discountPrice || null,
      stockQuantity: stockQuantity ?? 0,
      category: category || null,
      images,
      vendorId: req.user._id,
    })

    res.status(201).json({ message: 'Product created.', product })
  } catch (error) {
    next(error)
  }
}

export const getProducts = async (req, res, next) => {
  try {
    const { category, vendor, search, page = 1, limit = 20 } = req.query

    const filter = {}
    if (category) filter.category = category
    if (vendor) {
      const approvedShop = await Vendor.findOne({ userId: vendor, status: 'approved' })
      if (!approvedShop) {
        return res.json({
          products: [],
          page: Number(page),
          totalPages: 0,
          total: 0,
        })
      }
      filter.vendorId = vendor
    } else {
      const approvedVendorIds = await Vendor.find({ status: 'approved' }).distinct('userId')
      if (approvedVendorIds.length === 0) {
        return res.json({
          products: [],
          page: Number(page),
          totalPages: 0,
          total: 0,
        })
      }
      filter.vendorId = { $in: approvedVendorIds }
    }
    if (search) filter.name = { $regex: search, $options: 'i' }

    const skip = (Number(page) - 1) * Number(limit)

    const [products, total] = await Promise.all([
      Product.find(filter)
        .populate('category', 'name slug')
        .populate('vendorId', 'name')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit)),
      Product.countDocuments(filter),
    ])

    res.json({
      products,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      total,
    })
  } catch (error) {
    next(error)
  }
}

export const getProductById = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product id.' })
    }

    const product = await Product.findById(req.params.id)
      .populate('category', 'name slug')
      .populate('vendorId', 'name')

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    const vendorUserId =
      product.vendorId && typeof product.vendorId === 'object' && product.vendorId._id
        ? product.vendorId._id.toString()
        : String(product.vendorId)
    const shop = await Vendor.findOne({ userId: vendorUserId })
    const isOwner = req.user && req.user._id.toString() === vendorUserId
    const isAdmin = req.user && req.user.role === 'admin'
    if ((!shop || shop.status !== 'approved') && !isOwner && !isAdmin) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    res.json({ product })
  } catch (error) {
    next(error)
  }
}

export const updateProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product id.' })
    }

    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    const userId = req.user._id.toString()
    const productVendorId = product.vendorId.toString()
    if (productVendorId !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only update your own products.' })
    }

    const { name, description, price, discountPrice, stockQuantity, category } = req.body

    if (name !== undefined) product.name = name
    if (description !== undefined) product.description = description
    if (price !== undefined) product.price = Number(price)
    if (discountPrice !== undefined) product.discountPrice = discountPrice ? Number(discountPrice) : null
    if (stockQuantity !== undefined) product.stockQuantity = Number(stockQuantity)
    if (category !== undefined) product.category = category || null

    if (req.files && req.files.length > 0) {
      const newImages = []
      for (const file of req.files) {
        const result = await uploadToCloudinary(file.buffer)
        newImages.push(result)
      }
      product.images = [...product.images, ...newImages]
    }

    await product.save()

    res.json({ message: 'Product updated.', product })
  } catch (error) {
    console.error('Error updating product:', error)
    res.status(500).json({ message: 'Failed to update product', error: error.message })
  }
}

export const deleteProduct = async (req, res, next) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: 'Invalid product id.' })
    }

    const product = await Product.findById(req.params.id)

    if (!product) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    if (product.vendorId.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'You can only delete your own products.' })
    }

    for (const image of product.images) {
      await deleteFromCloudinary(image.publicId)
    }

    await product.deleteOne()

    res.json({ message: 'Product deleted.' })
  } catch (error) {
    next(error)
  }
}

export const getVendorProducts = async (req, res, next) => {
  try {
    if (req.user.role !== 'vendor' && req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied.' })
    }

    const products = await Product.find({ vendorId: req.user._id })
      .populate('category', 'name slug')
      .sort({ createdAt: -1 })

    res.json({ products })
  } catch (error) {
    next(error)
  }
}

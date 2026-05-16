import User from '../models/User.js'
import Vendor from '../models/Vendor.js'
import Product from '../models/Product.js'
import Order from '../models/Order.js'

const SHOP_STATUSES = ['pending', 'approved', 'suspended']

export const listUsers = async (req, res, next) => {
  try {
    const users = await User.find()
      .select('name email role avatarUrl createdAt')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ users })
  } catch (error) {
    next(error)
  }
}

export const listShops = async (req, res, next) => {
  try {
    const shops = await Vendor.find()
      .populate('userId', 'name email role createdAt avatarUrl')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ shops })
  } catch (error) {
    next(error)
  }
}

export const updateShopStatus = async (req, res, next) => {
  try {
    const { status } = req.body
    if (!SHOP_STATUSES.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Use pending, approved, or suspended.' })
    }

    const vendor = await Vendor.findById(req.params.id)
    if (!vendor) {
      return res.status(404).json({ message: 'Shop not found.' })
    }

    vendor.status = status
    await vendor.save()

    res.json({
      message: 'Shop status updated.',
      shop: vendor.toJSON(),
    })
  } catch (error) {
    next(error)
  }
}

export const deleteShop = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
    if (!vendor) {
      return res.status(404).json({ message: 'Shop not found.' })
    }

    await Product.deleteMany({ vendorId: vendor.userId })
    await Vendor.findByIdAndDelete(vendor._id)

    res.json({ message: 'Shop and associated products deleted.' })
  } catch (error) {
    next(error)
  }
}

export const getVendorProducts = async (req, res, next) => {
  try {
    const vendor = await Vendor.findById(req.params.id)
    if (!vendor) {
      return res.status(404).json({ message: 'Shop not found.' })
    }

    const products = await Product.find({ vendorId: vendor.userId })
      .populate('category', 'name')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ products })
  } catch (error) {
    next(error)
  }
}

export const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id)
    if (!product) {
      return res.status(404).json({ message: 'Product not found.' })
    }

    await Product.findByIdAndDelete(product._id)

    res.json({ message: 'Product deleted.' })
  } catch (error) {
    next(error)
  }
}

export const getAllOrders = async (req, res, next) => {
  try {
    const orders = await Order.find()
      .populate('customer', 'name email phone')
      .populate('orderItems.product', 'name images price')
      .sort({ createdAt: -1 })
      .lean()

    res.json({ orders })
  } catch (error) {
    next(error)
  }
}

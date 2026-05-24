import Order from '../models/Order.js'
import Product from '../models/Product.js'
import Vendor from '../models/Vendor.js'

export const createOrder = async (req, res, next) => {
  try {
    const { orderItems, shippingAddress } = req.body

    if (!orderItems || orderItems.length === 0) {
      return res.status(400).json({ message: 'Order must contain at least one item.' })
    }

    if (!shippingAddress || !shippingAddress.street || !shippingAddress.city) {
      return res.status(400).json({ message: 'Shipping address is required.' })
    }

    let totalPrice = 0
    const verifiedItems = []

    for (const item of orderItems) {
      const product = await Product.findById(item.product)

      if (!product) {
        return res.status(404).json({ message: `Product not found: ${item.product}` })
      }

      const shop = await Vendor.findOne({ userId: product.vendorId, status: 'approved' })
      if (!shop) {
        return res.status(400).json({
          message: `This product is not available for purchase: "${product.name}". The seller’s shop is not approved yet.`,
        })
      }

      if (product.stockQuantity < item.quantity) {
        return res.status(400).json({
          message: `Insufficient stock for "${product.name}". Available: ${product.stockQuantity}, Requested: ${item.quantity}`,
        })
      }

      const price = product.discountPrice || product.price
      totalPrice += price * item.quantity

      verifiedItems.push({
        product: product._id,
        quantity: item.quantity,
        price,
      })

      product.stockQuantity -= item.quantity
      product.soldCount = Math.max(0, (product.soldCount || 0) + item.quantity)
      await product.save()
    }

    const order = await Order.create({
      customer: req.user._id,
      orderItems: verifiedItems,
      shippingAddress,
      totalPrice,
      paymentMethod: 'Cash on Delivery',
    })

    res.status(201).json({ message: 'Order placed successfully.', order })
  } catch (error) {
    next(error)
  }
}

export const getMyOrders = async (req, res, next) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('orderItems.product', 'name images')
      .sort({ createdAt: -1 })

    res.json({ orders })
  } catch (error) {
    next(error)
  }
}

export const getVendorOrders = async (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    const vendorProducts = await Product.find({ vendorId: req.user._id }).select('_id').lean()

    if (vendorProducts.length === 0) {
      return res.json({ orders: [] })
    }

    const productIds = vendorProducts.map((p) => p._id)

    const orders = await Order.find({ 'orderItems.product': { $in: productIds } })
      .populate('customer', 'name email')
      .populate('orderItems.product', 'name images vendorId')
      .sort({ createdAt: -1 })
      .lean()

    const vendorOrders = orders.map((order) => {
      const relevantItems = order.orderItems.filter((item) => {
        const itemProductId = item.product?._id?.toString()
        return productIds.some((pid) => pid.toString() === itemProductId)
      })
      return {
        _id: order._id,
        customer: order.customer,
        items: relevantItems,
        shippingAddress: order.shippingAddress,
        status: order.status,
        createdAt: order.createdAt,
        itemTotal: relevantItems.reduce((sum, i) => sum + i.price * i.quantity, 0),
      }
    })

    res.json({ orders: vendorOrders })
  } catch (error) {
    console.error('Error in getVendorOrders:', error)
    res.status(500).json({ message: 'Failed to fetch orders', error: error.message })
  }
}

export const updateOrderStatus = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' })
    }

    order.status = req.body.status
    await order.save()

    res.json({ message: 'Order status updated.', order })
  } catch (error) {
    next(error)
  }
}

export const deleteOrder = async (req, res, next) => {
  try {
    const order = await Order.findById(req.params.id)

    if (!order) {
      return res.status(404).json({ message: 'Order not found.' })
    }

    await Order.findByIdAndDelete(order._id)

    res.json({ message: 'Order deleted successfully.' })
  } catch (error) {
    next(error)
  }
}

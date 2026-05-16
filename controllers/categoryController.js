import Category from '../models/Category.js'

const DEFAULT_CATEGORIES = [
  'Electronics',
  'Fashion',
  'Home & Garden',
  'Sports & Outdoors',
  'Books',
  'Health & Beauty',
  'Toys & Games',
  'Automotive',
]

export const getCategories = async (_req, res, next) => {
  try {
    let categories = await Category.find().sort({ name: 1 })

    if (categories.length === 0) {
      const docs = DEFAULT_CATEGORIES.map((name) => ({ name }))
      categories = await Category.insertMany(docs)
    }

    res.json({ categories })
  } catch (error) {
    next(error)
  }
}

export const createCategory = async (req, res, next) => {
  try {
    const { name, parentId } = req.body
    const category = await Category.create({ name, parentId: parentId || null })
    res.status(201).json({ message: 'Category created.', category })
  } catch (error) {
    next(error)
  }
}

import { GoogleGenerativeAI } from '@google/generative-ai'
import ChatSession from '../models/ChatSession.js'
import Product from '../models/Product.js'
import Category from '../models/Category.js'
import Vendor from '../models/Vendor.js'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)

const buildSystemPrompt = (products, categories) => {
  const categoryList = categories.map((c) => `- ${c.name} (slug: ${c.slug})`).join('\n')
  const productList = products
    .map((p) => {
      const price = p.discountPrice ?? p.price
      const catName = p.category?.name || 'Uncategorized'
      return `- ID: ${p._id} | Name: "${p.name}" | Price: $${price} | Category: ${catName} | In Stock: ${p.stockQuantity > 0 ? 'Yes' : 'No'}`
    })
    .join('\n')

  return `You are a helpful shopping assistant for Marketivo, an online marketplace.
Your job is to help customers find products, answer questions about items, and make personalized recommendations.

AVAILABLE CATEGORIES:
${categoryList || 'No categories available'}

AVAILABLE PRODUCTS:
${productList || 'No products available'}

GUIDELINES:
1. Be friendly, concise, and helpful.
2. When recommending products, always use the exact product ID and name from the list above.
3. If a product is out of stock, mention it and suggest alternatives.
4. If asked about products not in the list, politely say they are not currently available.
5. When you recommend a product, format it as: [PRODUCT:product_id:Product Name] so the system can create clickable links.
6. When suggesting a category, format it as: [CATEGORY:slug:Category Name] for clickable links.
7. Keep responses concise but informative.
8. If the user asks something unrelated to shopping, gently redirect them to shopping topics.`
}

const parseQuickLinks = (content, products, categories) => {
  const quickLinks = []

  const productMatches = content.matchAll(/\[PRODUCT:([a-f0-9]{24}):([^\]]+)\]/gi)
  for (const match of productMatches) {
    const productId = match[1]
    const label = match[2]
    const product = products.find((p) => p._id.toString() === productId)
    if (product) {
      quickLinks.push({ label, productId })
    }
  }

  const categoryMatches = content.matchAll(/\[CATEGORY:([a-z0-9-]+):([^\]]+)\]/gi)
  for (const match of categoryMatches) {
    const slug = match[1]
    const label = match[2]
    const category = categories.find((c) => c.slug === slug)
    if (category) {
      quickLinks.push({ label, categorySlug: slug })
    }
  }

  return quickLinks
}

const cleanContent = (content) => {
  return content
    .replace(/\[PRODUCT:[a-f0-9]{24}:([^\]]+)\]/gi, '**$1**')
    .replace(/\[CATEGORY:[a-z0-9-]+:([^\]]+)\]/gi, '**$1**')
}

export const chat = async (req, res, next) => {
  try {
    const { message } = req.body
    const userId = req.user._id

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ message: 'Message is required' })
    }

    const approvedVendorIds = await Vendor.find({ status: 'approved' }).distinct('userId')

    const productsPromise =
      approvedVendorIds.length === 0
        ? Promise.resolve([])
        : Product.find({ stockQuantity: { $gte: 0 }, vendorId: { $in: approvedVendorIds } })
            .populate('category', 'name slug')
            .select('name price discountPrice stockQuantity category')
            .limit(100)
            .lean()

    const [products, categories, session] = await Promise.all([
      productsPromise,
      Category.find().select('name slug').lean(),
      ChatSession.findOne({ userId }),
    ])

    let chatSession = session
    if (!chatSession) {
      chatSession = new ChatSession({ userId, messages: [] })
    }

    chatSession.messages.push({ role: 'user', content: message.trim() })

    const systemPrompt = buildSystemPrompt(products, categories)

    const recentMessages = chatSession.messages.slice(-10)
    const conversationContext = recentMessages
      .map((m) => `${m.role === 'user' ? 'Customer' : 'Assistant'}: ${m.content}`)
      .join('\n')

    const fullPrompt = `${systemPrompt}\n\nConversation so far:\n${conversationContext}`

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

    const result = await model.generateContent(fullPrompt)
    const response = await result.response
    const assistantContent = response.text() || "I'm sorry, I couldn't process that request."

    const quickLinks = parseQuickLinks(assistantContent, products, categories)
    const cleanedContent = cleanContent(assistantContent)

    chatSession.messages.push({
      role: 'assistant',
      content: cleanedContent,
      quickLinks,
    })

    await chatSession.save()

    res.json({
      message: cleanedContent,
      quickLinks,
    })
  } catch (error) {
    console.error('AI Chat Error:', error)
    if (error.status === 429 || error.message?.includes('quota')) {
      return res.status(503).json({ message: 'AI service is temporarily unavailable. Please try again later.' })
    }
    if (error.message?.includes('API_KEY')) {
      return res.status(500).json({ message: 'AI service configuration error.' })
    }
    next(error)
  }
}

export const getHistory = async (req, res, next) => {
  try {
    const userId = req.user._id
    const session = await ChatSession.findOne({ userId }).lean()

    if (!session) {
      return res.json({ messages: [] })
    }

    const messages = session.messages.map((m) => ({
      role: m.role,
      content: m.content,
      quickLinks: m.quickLinks || [],
      createdAt: m.createdAt,
    }))

    res.json({ messages })
  } catch (error) {
    next(error)
  }
}

export const clearHistory = async (req, res, next) => {
  try {
    const userId = req.user._id
    await ChatSession.findOneAndDelete({ userId })
    res.json({ message: 'Chat history cleared' })
  } catch (error) {
    next(error)
  }
}

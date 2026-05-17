import 'dotenv/config'
import cors from 'cors'
import express from 'express'

import connectDB from './config/db.js'
import apiRouter from './routes/index.js'

const app = express()
const PORT = process.env.PORT || 5000
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

const allowedOrigins = [
  CLIENT_URL,
  'http://localhost:5173',
  'http://localhost:5174',
  'https://marketivo-frontend.vercel.app',
  'https://project-marketivo.vercel.app',
]

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, curl, server-to-server)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
      return callback(null, true)
    }
    return callback(new Error(`Not allowed by CORS: ${origin}`))
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}

app.use(cors(corsOptions))
app.options('*', cors(corsOptions))
app.use(express.json())

app.get('/ping', (_req, res) => {
  res.json({ message: 'pong' })
})

app.use('/api', apiRouter)

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('ERROR:', err.message, err.stack)
  res.status(err.status || 500).json({ message: err.message || 'Internal Server Error' })
})

const startServer = async () => {
  try {
    await connectDB()
    app.listen(PORT, () => {
      console.log(`Marketivo API running on port ${PORT}`)
    })
  } catch (error) {
    console.error('Failed to start server:', error)
    process.exit(1)
  }
}

startServer()

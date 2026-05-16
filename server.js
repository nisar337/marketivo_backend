import 'dotenv/config'
import cors from 'cors'
import express from 'express'

import app from './app.js'
import connectDB from './config/db.js'
import apiRouter from './routes/index.js'

const PORT = process.env.PORT || 5000
const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173'

app.use(cors({
  origin: [CLIENT_URL, 'http://localhost:5173', 'http://localhost:5174',  'https://project-marketivo.vercel.app'],
  credentials: true,
}))
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

console.log('🚀 Starting debug server...')

const express = require('express')
const cors = require('cors')

const app = express()
const PORT = 3002

// Basic middleware
app.use(cors())
app.use(express.json())

// Simple test endpoint
app.get('/', (req, res) => {
    res.json({ message: 'Debug server is running!', timestamp: new Date().toISOString() })
})

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', message: 'Debug backend working' })
})

// Start server
app.listen(PORT, () => {
    console.log(`✅ Debug server running on port ${PORT}`)
    console.log(`📊 Test: http://localhost:${PORT}/health`)
})

// Handle graceful shutdown
process.on('SIGTERM', () => {
    console.log('🛑 SIGTERM received')
    process.exit(0)
})

process.on('SIGINT', () => {
    console.log('🛑 SIGINT received')
    process.exit(0)
})

console.log('📝 Server setup complete')

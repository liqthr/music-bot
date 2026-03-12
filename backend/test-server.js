const express = require('express');
const cors = require('cors');
const fs = require('fs-extra');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 3001;

// Simple in-memory store
const sessions = {};

// Middleware
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        message: 'Backend is running',
        timestamp: new Date().toISOString()
    });
});

// Create session
app.post('/session', (req, res) => {
    const sessionId = uuidv4();
    sessions[sessionId] = {
        lastActive: Date.now(),
        files: {},
        createdAt: new Date().toISOString()
    };
    console.log(`✅ Created session: ${sessionId}`);
    res.json({ sessionId });
});

// Simple test endpoint
app.get('/test', (req, res) => {
    res.json({ message: 'Backend is working!' });
});

app.listen(PORT, () => {
    console.log(`🚀 Test backend running on port ${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/health`);
});

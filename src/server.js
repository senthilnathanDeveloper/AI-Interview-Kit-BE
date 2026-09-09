require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const authRoutes = require('./routes/authRoutes');
const kitRoutes = require('./routes/kitRoutes');

const app = express();
const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/ai-interview-kit';

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kits', kitRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Connect to MongoDB & Start Server
mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log(`[Database] Connected to MongoDB at ${MONGODB_URI}`);
    app.listen(PORT, () => {
      console.log(`[Server] Backend API running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error(`[Database] Connection error:`, err);
    // Start HTTP server anyway to allow offline/CLI usage without blocking
    app.listen(PORT, () => {
      console.log(`[Server] Backend API running on port ${PORT} (MongoDB offline mode)`);
    });
  });

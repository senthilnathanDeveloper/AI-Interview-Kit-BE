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

// Middleware to ensure DB connection on serverless functions (Vercel)
let isConnected = false;
async function connectDb() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    return;
  }
  try {
    await mongoose.connect(MONGODB_URI);
    isConnected = true;
    console.log(`[Database] Connected to MongoDB`);
  } catch (err) {
    console.error(`[Database] Connection error:`, err.message);
  }
}

app.use(async (req, res, next) => {
  await connectDb();
  next();
});

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

// Root endpoint
app.get('/', (req, res) => {
  res.json({ message: 'AI Interview Prep Kit API is running on Vercel' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// Connect to MongoDB & Start Server if executed directly
if (process.env.NODE_ENV !== 'production' || require.main === module) {
  connectDb().then(() => {
    app.listen(PORT, () => {
      console.log(`[Server] Backend API running on port ${PORT}`);
    });
  });
}

module.exports = app;

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
    return true;
  }
  try {
    if (!process.env.MONGODB_URI) {
      console.warn(`[Database] MONGODB_URI is not set! Using default local URI.`);
    }
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000 // 5 seconds timeout instead of 10s
    });
    isConnected = true;
    console.log(`[Database] Connected to MongoDB`);
    return true;
  } catch (err) {
    console.error(`[Database] Connection error:`, err.message);
    return false;
  }
}

app.use(async (req, res, next) => {
  if (req.path === '/') {
    return next();
  }
  const connected = await connectDb();
  if (!connected && mongoose.connection.readyState !== 1 && req.path !== '/api/health') {
    return res.status(500).json({
      error: 'Database connection failed. Please ensure MONGODB_URI is configured in Vercel project settings and MongoDB Atlas IP access list includes 0.0.0.0/0.'
    });
  }
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/kits', kitRoutes);

// Health check endpoint
app.get('/api/health', async (req, res) => {
  let dbStatus = 'disconnected';
  let dbError = null;
  try {
    const isConn = await connectDb();
    if (isConn || mongoose.connection.readyState === 1) {
      dbStatus = 'connected';
    }
  } catch (err) {
    dbError = err.message;
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    error: dbError
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

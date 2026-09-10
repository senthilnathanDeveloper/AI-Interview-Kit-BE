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
let lastDbError = null;

async function connectDb() {
  if (isConnected || mongoose.connection.readyState === 1) {
    isConnected = true;
    lastDbError = null;
    return { success: true, error: null };
  }
  try {
    if (!process.env.MONGODB_URI) {
      const msg = 'MONGODB_URI environment variable is missing in Vercel settings. Falling back to local default which cannot run on Vercel cloud.';
      console.warn(`[Database] ${msg}`);
      lastDbError = msg;
      return { success: false, error: msg };
    }
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 5000
    });
    isConnected = true;
    lastDbError = null;
    console.log(`[Database] Connected to MongoDB`);
    return { success: true, error: null };
  } catch (err) {
    console.error(`[Database] Connection error:`, err.message);
    lastDbError = err.message;
    return { success: false, error: err.message };
  }
}

app.use(async (req, res, next) => {
  if (req.path === '/') {
    return next();
  }
  const connResult = await connectDb();
  if (!connResult.success && mongoose.connection.readyState !== 1 && req.path !== '/api/health') {
    return res.status(500).json({
      error: `Database connection failed: ${connResult.error || 'Check MONGODB_URI in Vercel settings.'}`
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
  const connResult = await connectDb();
  if (connResult.success || mongoose.connection.readyState === 1) {
    dbStatus = 'connected';
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    mongodb: dbStatus,
    error: connResult.error || lastDbError
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

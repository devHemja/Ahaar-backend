require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const connectDB = require('./config/db');

const authRoutes = require('./routes/auth.routes');
const ngoRoutes = require('./routes/ngo.routes');
const foodRoutes = require('./routes/food.routes');
const userRoutes = require('./routes/user.routes');
const notificationRoutes = require('./routes/notification.routes');
const app = express();
const server = http.createServer(app);

// ─── ASYNCHRONOUS INITIALIZATION ENGINE ──────────────────────────────────────
const startProductionServer = async () => {
  // 1. Core Persistent Database Connection
  await connectDB();


  // ─── MIDDLEWARE PIPELINES ──────────────────────────────────────────────────
  app.use(cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173', // Fallback to dev port if variable missing
    credentials: true,
  }));
  app.use(express.json());
  app.use(cookieParser());

  // ─── ENDPOINT ROUTING AGGREGATORS ──────────────────────────────────────────
  app.use('/api/auth', authRoutes);
  app.use('/api', ngoRoutes);
  app.use('/api', foodRoutes);
  app.use('/api', userRoutes);
  app.use('/api', notificationRoutes);


  app.get('/', (req, res) => {
    res.send('Ahaar Production-Ready MERN Engine is Running.');
  });

  // ─── REAL-TIME ENGINE INFRASTRUCTURE (SOCKET.IO) ───────────────────────────
  const io = new Server(server, {
    cors: {
      origin: process.env.CLIENT_URL || 'http://localhost:5173',
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`🌐 Real-time interface connected: ${socket.id}`);
    socket.on('disconnect', () => {
      console.log('🌐 Client disconnected from real-time interface.');
    });
  });

  // ─── BIND ENGINE LISTENERS ─────────────────────────────────────────────────
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => {
    console.log(`🚀 Production cluster worker active on node port ${PORT}`);
  });
};

// Start the core services execution path
startProductionServer().catch((error) => {
  console.error('❌ Critical Failure During Application Boot Sequence:', error.message);
  process.exit(1);
});
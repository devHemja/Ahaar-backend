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

const startProductionServer = async () => {
  try {
    await connectDB();

    // ==========================
    // CORS
    // ==========================
    const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:5173';

    const allowedOrigins = [
      CLIENT_URL,
      'http://localhost:5173',
    ].filter(Boolean);

    app.use(cors({
      origin: function (origin, callback) {
        // Allow Postman / mobile / server-to-server (no origin header)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error(`CORS: origin ${origin} not allowed`));
        }
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // ==========================
    // Middleware
    // ==========================
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(cookieParser());

    // ==========================
    // Routes
    // ==========================
    app.use('/api/auth', authRoutes);
    app.use('/api', ngoRoutes);
    app.use('/api', foodRoutes);
    app.use('/api', userRoutes);
    app.use('/api', notificationRoutes);

    app.get('/', (req, res) => {
      res.send('🚀 Ahaar Backend is Running Successfully');
    });

    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'OK', message: 'Server is healthy' });
    });

    // ==========================
    // Socket.IO
    // ==========================
    const io = new Server(server, {
      cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST'],
        credentials: true,
      },
    });

    io.on('connection', (socket) => {
      console.log(`🌐 Client Connected: ${socket.id}`);
      socket.on('disconnect', () => {
        console.log(`❌ Client Disconnected: ${socket.id}`);
      });
    });

    // ==========================
    // Start Server
    // ==========================
    const PORT = process.env.PORT || 5000;
    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startProductionServer();
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const authRoutes = require('./routes/auth.routes');
const connectDB=require('./config/db');


const app = express();
const server = http.createServer(app);

connectDB();

// Middleware
app.use(cors());
app.use(express.json());

//API routes
app.use('/api/auth', authRoutes);

// Basic Route
app.get('/', (req, res) => {
  res.send('Ahaar Backend Server is Running!');
});

// Real-time Socket.IO Connection Setup
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173", // Default Vite development port
    methods: ["GET", "POST"]
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.id}`);
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
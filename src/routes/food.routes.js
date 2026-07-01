const express = require('express');
const router = express.Router();
const { rateLimit } = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const { createClient } = require('redis');

const {
  createListing,
  getMyListings,
  getListingById,
  browseFood,
  claimFoodListing,
  updateListingStatus,
} = require('../controllers/foodController');
const { verifyToken, requireRole } = require('../middleware/VerifyToken');
const { upload } = require('../middleware/upload');

const isProduction = process.env.NODE_ENV === 'production';

const redisClient = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379',
  socket: {
    reconnectStrategy: (retries) => {
      if (retries > 5) {
        return isProduction ? new Error('Redis connection lost permanently.') : false;
      }
      return Math.min(retries * 500, 2000);
    }
  }
});

redisClient.on('connect', () => console.log('🚀 Redis Client Connected Successfully.'));
redisClient.on('error', (err) => console.error('❌ Redis Runtime Error:', err.message));

let useRedisStore = false;
(async () => {
  try {
    await redisClient.connect();
    useRedisStore = true;
  } catch (err) {
    if (isProduction) {
      console.error('❌ CRITICAL: Redis initialization failed in production.');
      process.exit(1);
    } else {
      console.warn('⚠️ WARNING: Redis not running locally. Rate limiter falling back to standard local memory storage.');
    }
  }
})();

const foodSubmitSpamThrottler = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: useRedisStore ? new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
  }) : undefined,
  message: {
    success: false,
    message: "Rate limit exceeded. Excessive food postings detected from this network window."
  }
});

// Order matters: '/food/mine' must be declared before '/food/:id'.
router.post('/food', verifyToken, requireRole('donor'), foodSubmitSpamThrottler, upload.single('photo'), createListing);
router.get('/food/mine', verifyToken, requireRole('donor'), getMyListings);
router.get('/food', verifyToken, requireRole('ngo'), browseFood);
router.get('/food/:id', verifyToken, getListingById);
router.put('/food/:id/claim', verifyToken, requireRole('ngo'), claimFoodListing);
router.put('/food/:id/status', verifyToken, requireRole('ngo'), updateListingStatus);

module.exports = router;

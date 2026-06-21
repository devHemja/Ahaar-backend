const express = require('express');
const router = express.Router();
// 🌟 Import the new claim controller function
const { createListing, claimFoodListing } = require('../controllers/foodController');
const { verifyToken } = require('../middleware/auth');

// POST http://localhost:5000/api/food
router.post('/food', verifyToken, createListing);

// 🌟 NEW PATHWAY: PUT http://localhost:5000/api/food/:id/claim
router.put('/food/:id/claim', verifyToken, claimFoodListing);

module.exports = router;
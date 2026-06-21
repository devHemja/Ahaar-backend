const express = require('express');
const router = express.Router();
const { getNearbyNGOs } = require('../controllers/ngoController');
const { verifyToken } = require('../middleware/auth');

// GET http://localhost:5000/api/ngos/nearby
router.get('/ngos/nearby', verifyToken, getNearbyNGOs);

module.exports = router;
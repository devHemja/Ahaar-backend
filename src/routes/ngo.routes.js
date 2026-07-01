const express = require('express');
const router = express.Router();

const { verifyToken, requireRole } = require('../middleware/VerifyToken');
const { getNearbyNGOs } = require('../controllers/ngoController');

// GET /api/ngos/nearby — verified NGOs within 10km of the logged-in donor
router.get('/ngos/nearby', verifyToken, requireRole('donor'), getNearbyNGOs);

module.exports = router;

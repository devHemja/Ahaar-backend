const express = require('express');
const router = express.Router();
const { register } = require('../controllers/authController'); // <-- Import the controller logic

// Route path: /api/auth/register
router.post('/register', register); // <-- Pass the register function here

module.exports = router;
const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/VerifyToken');
const { getMe, updateMe, getMyStats } = require('../controllers/userController');

router.get('/users/me', verifyToken, getMe);
router.put('/users/me', verifyToken, updateMe);
router.get('/users/me/stats', verifyToken, getMyStats);

module.exports = router;

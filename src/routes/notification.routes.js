const express = require('express');
const router = express.Router();

const { verifyToken } = require('../middleware/VerifyToken');
const { getMyNotifications, markAsRead, markAllAsRead } = require('../controllers/notificationController');

router.get('/notifications', verifyToken, getMyNotifications);
router.put('/notifications/read-all', verifyToken, markAllAsRead);
router.put('/notifications/:id/read', verifyToken, markAsRead);

module.exports = router;

const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { verifyToken } = require('../middleware/VerifyToken');

router.post('/register', authController.register);
router.post('/generate-otp', authController.generateOtp);
router.post('/verify-otp', authController.verifyOTP);
router.post('/login', authController.login);
router.post('/logout', authController.logout);
router.post('/forgot-password-send-otp', authController.forgotPassword);
router.post('/forgot-password-verify-otp', authController.verifyResetOTP);
router.post('/reset-password', authController.resetPassword);
router.post('/verify-ngo-registration', authController.verifyNgoRegistration);
router.put('/location', verifyToken, authController.updateLocation);

module.exports = router;
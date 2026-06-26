const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const verifyToken = require('../middleware/verifyToken');

// ─── Registration & Email Verification ────────────────────────────────────────
// POST /api/auth/register
// Body: { name, email, password, role }
// Triggered by: RegisterPage.jsx → handleSubmit
router.post('/register', authController.register);

// POST /api/auth/generate-otp
// Body: { email }
// Triggered by: VerifyOtpPage.jsx → handleGenerateOtp (Send OTP & Resend OTP buttons)
router.post('/generate-otp', authController.generateOtp);

// POST /api/auth/verify-otp
// Body: { email, otp }
// Triggered by: VerifyOtpPage.jsx → handleVerify
router.post('/verify-otp', authController.verifyOTP);

// ─── Login & Logout ───────────────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
// Triggered by: LoginPage.jsx → handleSubmit
router.post('/login', authController.login);

// POST /api/auth/logout
// Triggered by: Dashboard logout button (cookie-based, no body needed)
router.post('/logout', authController.logout);

// ─── Password Reset (3-step flow) ────────────────────────────────────────────
// POST /api/auth/forgot-password-send-otp
// Body: { email }
// Triggered by: ForgotPasswordPage.jsx → handleSendOtp (Step 1)
router.post('/forgot-password-send-otp', authController.forgotPassword);

// POST /api/auth/forgot-password-verify-otp
// Body: { email, otp }
// Triggered by: ForgotPasswordPage.jsx → handleVerifyOtp (Step 2)
router.post('/forgot-password-verify-otp', authController.verifyResetOTP);

// POST /api/auth/reset-password
// Body: { email, newPassword }  ← NOTE: frontend sends only email + newPassword (no otp in body)
// Triggered by: ResetPasswordPage.jsx → handleSubmit (Step 3)
router.post('/reset-password', authController.resetPassword);

// ─── Location Update (Protected) ─────────────────────────────────────────────
// PUT /api/auth/location
// Body: { longitude, latitude }
// Requires: valid JWT cookie
router.put('/location', verifyToken, authController.updateLocation);

module.exports = router;

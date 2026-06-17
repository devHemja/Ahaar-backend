const express = require('express');
const router = express.Router();
const { register, verifyOTP ,login, 
   forgotPassword, 
  verifyResetOTP, 
  resetPassword} = require('../controllers/authController'); // <-- Import the controller logic

// Route path: /api/auth/register
router.post('/register', register);
router.post('/verify-otp',verifyOTP); 
router.post('/login',login);
router.post('/forgot-password', forgotPassword);   
router.post('/verify-reset-otp', verifyResetOTP); 
router.post('/reset-password', resetPassword);   

module.exports = router;
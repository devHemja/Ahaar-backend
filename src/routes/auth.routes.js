const express = require('express');
const router = express.Router();
const { register, verifyOTP ,login, 
   forgotPassword, 
  verifyResetOTP, 
  resetPassword , logout ,updateLocation} = require('../controllers/authController'); // <-- Import the controller logic


const { verifyToken } = require('../middleware/auth');


// Route path: /api/auth/register
router.post('/auth/register', register);
router.post('/auth/verify-otp',verifyOTP); 
router.post('/auth/login',login);
router.post('/auth/forgot-password', forgotPassword);   
router.post('/auth/verify-reset-otp', verifyResetOTP); 
router.post('/auth/reset-password', resetPassword);   
router.post('/auth/logout', logout);
router.put('/auth/location' , verifyToken , updateLocation);

module.exports = router;
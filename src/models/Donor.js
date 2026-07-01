const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is Required'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Email is Required'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
    },
    role: {
      type: String,
      default: 'donor', // Lock role strictly to donor
    },
    isVerified: {
      type: Boolean,
      required: true,
      default: false,
    },
    emailOTP: {
      type: String,
      default: null,
    },
    otpExpiresAt: {
      type: Date,
      default: null,
    },
    address: {
      type: String, // Human-readable location, shown in the UI (e.g. "Connaught Place, New Delhi")
      trim: true,
      default: '',
    },
    location: {
  type: {
    type: String,
    enum: ['Point'],
    // No default — a doc with no coordinates yet must have NO location
    // object at all, not a partial one.
  },
  coordinates: {
    type: [Number],
    index: '2dsphere',
  },
},
    refreshToken: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Donor', donorSchema);
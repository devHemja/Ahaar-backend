const mongoose = require('mongoose');

const ngoSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  orgName: {
    type: String,
    required: true
  },
  regNumber: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  // 🌟 GeoJSON Point structure matching the User schema for geospatial queries
  location: {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point'
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      required: true
    }
  },
  isVerified: {
    type: Boolean,
    default: false // Requires admin approval before appearing in nearby feeds
  }
}, { timestamps: true });

// 🌟 CRITICAL: Create the 2dsphere index for native radius calculation queries
ngoSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('NGO', ngoSchema);
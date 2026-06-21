const mongoose = require('mongoose');

const foodListingSchema = new mongoose.Schema({
  donorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // Links to the donor account 
  },
  foodType: {
    type: String,
    required: true,
    enum: ['cooked', 'raw', 'packaged', 'other'] // Strict type categories 
  },
  quantity: {
    type: String,
    required: true // e.g., "20 plates" or "5 kg" 
  },
  description: {
    type: String // Optional extra pickup notes 
  },
  expiresAt: {
    type: Date,
    required: true // Estimated food validity 
  },
  photoUrl: {
    type: String // Cloudinary CDN attachment URL will sit here [cite: 60, 166]
  },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: {
      type: [Number], // [longitude, latitude] 
      required: true
    }
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'matched', 'in_transit', 'delivered', 'expired'], // Track state 
    default: 'pending'
  },
  acceptedNgoId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'NGO' // The claiming entity ID drops here once claimed 
  }
}, { timestamps: true });

// 🌟 Add the spatial index so NGOs can run geo queries on food items
foodListingSchema.index({ location: '2dsphere' });

module.exports = mongoose.model('FoodListing', foodListingSchema);
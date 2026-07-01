const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      index: true, // Owner of the notification (donor or NGO id)
    },
    type: {
      type: String,
      enum: ['request_accepted', 'delivered', 'food_alert'],
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    relatedListingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FoodListing',
    },
    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Notification', notificationSchema);

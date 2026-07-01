const Notification = require('../models/Notification');

// Internal helper used by other controllers to raise a notification.
// Never throws — a failed notification should never break the calling flow.
exports.createNotification = async ({ userId, type, message, relatedListingId }) => {
  try {
    await Notification.create({ userId, type, message, relatedListingId });
  } catch (err) {
    console.error('Failed to create notification:', err.message);
  }
};

// @desc     Get the logged-in user's notifications, most recent first
// @route    GET /api/notifications
// @access   Private
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user.userId })
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({ success: true, count: notifications.length, data: notifications });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Mark a single notification as read
// @route    PUT /api/notifications/:id/read
// @access   Private
exports.markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId },
      { $set: { isRead: true } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: 'Notification not found.' });
    }

    res.status(200).json({ success: true, data: notification });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Mark all of the logged-in user's notifications as read
// @route    PUT /api/notifications/read-all
// @access   Private
exports.markAllAsRead = async (req, res) => {
  try {
    await Notification.updateMany({ userId: req.user.userId, isRead: false }, { $set: { isRead: true } });
    res.status(200).json({ success: true, message: 'All notifications marked as read.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

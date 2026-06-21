const NGO = require('../models/NGO');
const User = require('../models/User');

// @desc    Get all verified NGOs within a 10km radius of the current user
// @route   GET /api/ngos/nearby
// @access  Private (Requires JWT verification via Cookie)
exports.getNearbyNGOs = async (req, res) => {
  try {
    // 1. Fetch the logged-in user to grab their location coordinates
    const currentUser = await User.findById(req.user.userId);
    
    if (!currentUser || !currentUser.location || !currentUser.location.coordinates) {
      return res.status(400).json({ 
        message: "Your location is not set. Please enable geolocation tracking first." 
      });
    }

    const [longitude, latitude] = currentUser.location.coordinates;

    // 2. Query the NGO collection using the 2dsphere index radius formula
    const nearbyNGOs = await NGO.find({
      location: {
        $nearSphere: {
          $geometry: {
            type: "Point",
            coordinates: [longitude, latitude] // Donor's location
          },
          $maxDistance: 10000 // 10,000 meters = 10 kilometers
        }
      },
      isVerified: true // Only return active, verified organizations
    });

    res.status(200).json({
      success: true,
      count: nearbyNGOs.length,
      data: nearbyNGOs
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
const NGO = require('../models/NGO');
const Donor = require('../models/Donor');

// @desc    Get all verified NGOs within 10km of the current donor, closest first
// @route   GET /api/ngos/nearby
// @access  Private (Donor only)
exports.getNearbyNGOs = async (req, res) => {
  try {
    // 1. Fetch the logged-in donor to grab their location coordinates
    const currentUser = await Donor.findById(req.user.userId);

    if (!currentUser || !currentUser.location || !currentUser.location.coordinates || currentUser.location.coordinates.length !== 2) {
      return res.status(400).json({
        message: "Your location is not set. Please enable geolocation tracking first."
      });
    }

    const [longitude, latitude] = currentUser.location.coordinates;

    // 2. $geoNear also returns the computed distance (meters) per document,
    //    which the frontend NGO cards need to render "x.x km away".
    const nearbyNGOs = await NGO.aggregate([
      {
        $geoNear: {
          near: { type: 'Point', coordinates: [longitude, latitude] },
          distanceField: 'distanceMeters',
          maxDistance: 10000, // 10km
          query: { isVerified: true },
          spherical: true,
        },
      },
      {
        $project: {
          orgName: 1,
          email: 1,
          category: 1,
          address: 1,
          phone: 1,
          location: 1,
          distanceKm: { $round: [{ $divide: ['$distanceMeters', 1000] }, 1] },
        },
      },
    ]);

    res.status(200).json({
      success: true,
      count: nearbyNGOs.length,
      data: nearbyNGOs,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

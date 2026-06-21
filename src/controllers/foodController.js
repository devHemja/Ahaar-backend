const FoodListing = require('../models/FoodListing');
const User = require('../models/User');
const NGO = require('../models/NGO'); // Import the NGO model

// @desc    Create a new surplus food listing
// @route   POST /api/food
// @access  Private (Donor only)
exports.createListing = async (req, res) => {
  try {
    const { foodType, quantity, description, expiresAt } = req.body;

    // 1. Basic validation [cite: 188]
    if (!foodType || !quantity || !expiresAt) {
      return res.status(400).json({ message: "Food type, quantity, and expiration time are required." });
    }

    // 2. Fetch the donor profile to copy their current location coordinates [cite: 228]
    const donor = await User.findById(req.user.userId);
    if (!donor || !donor.location || !donor.location.coordinates) {
      return res.status(400).json({ 
        message: "Donor location profile missing. Please sync your coordinates first before posting food." 
      });
    }

    // 3. Construct the listing with status set to pending [cite: 242]
    const newListing = await FoodListing.create({
      donorId: req.user.userId,
      foodType,
      quantity,
      description,
      expiresAt: new Date(expiresAt),
      location: donor.location, // Auto-clones donor's physical coordinates 
      status: 'pending' // Default setup state [cite: 242]
    });

    res.status(201).json({
      success: true,
      message: "Food listing published successfully!",
      listing: newListing
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    NGO claims/accepts a pending food listing
// @route   PUT /api/food/:id/claim
// @access  Private (NGO only)
exports.claimFoodListing = async (req, res) => {
  try {
    const listingId = req.params.id;

    // 1. Verify the logged-in user is an NGO profile
    const ngoProfile = await NGO.findOne({ userId: req.user.userId });
    if (!ngoProfile) {
      return res.status(403).json({ 
        message: "Access denied. Only registered NGOs can claim food listings." 
      });
    }

    // 2. Find the listing
    const listing = await FoodListing.findById(listingId);
    if (!listing) {
      return res.status(404).json({ message: "Food listing not found." });
    }

    // 3. Ensure nobody else has claimed it yet
    if (listing.status !== 'pending') {
      return res.status(400).json({ 
        message: `This listing cannot be claimed. Status is currently: ${listing.status}` 
      });
    }

    // 4. Update the state maps
    listing.status = 'matched';
    listing.acceptedNgoId = ngoProfile._id; // Attach this NGO's profile ID
    await listing.save();

    res.status(200).json({
      success: true,
      message: "Food listing claimed successfully! Pickup details locked in.",
      listing
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
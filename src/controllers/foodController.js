const FoodListing = require('../models/FoodListing');
const Donor = require('../models/Donor');
const NGO = require('../models/NGO');
const { uploadBufferToCloudinary } = require('../middleware/upload');
const { createNotification } = require('./notificationController');

// @desc     Create a new surplus food listing (optionally with a photo)
// @route    POST /api/food
// @access   Private (Donor only)
exports.createListing = async (req, res) => {
  try {
    const { foodType, quantity, description, expiresAt } = req.body;

    if (!foodType || !quantity || !expiresAt) {
      return res.status(400).json({ message: "Food type, quantity, and expiration time are required." });
    }

    const donor = await Donor.findById(req.user.userId);
    if (!donor || !donor.location || !donor.location.coordinates || donor.location.coordinates.length !== 2) {
      return res.status(400).json({
        message: "Donor location profile missing. Please sync coordinates via frontend first."
      });
    }

    let photoUrl;
    if (req.file) {
      try {
        const result = await uploadBufferToCloudinary(req.file.buffer);
        photoUrl = result.secure_url;
      } catch (uploadErr) {
        return res.status(502).json({ message: 'Photo upload failed. Please try again.', detail: uploadErr.message });
      }
    }

    const newListing = await FoodListing.create({
      donorId: req.user.userId,
      foodType,
      quantity,
      description,
      expiresAt: new Date(expiresAt),
      photoUrl,
      location: donor.location,
      status: 'pending'
    });

    // --- REPLACED KAFKA EVENT WITH DIRECT NOTIFICATION LOGIC ---
    // Synchronously find all NGOs within 25km of the donor's coordinates
    try {
      const nearbyNgos = await NGO.find({
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: newListing.location.coordinates },
            $maxDistance: 25000 // 25km radius
          }
        }
      });

      // Create a database notification for each nearby NGO
      const notificationPromises = nearbyNgos.map(ngo => 
        createNotification({
          userId: ngo._id,
          type: 'food_alert',
          message: `New surplus food available nearby: ${quantity} of ${foodType}.`,
          relatedListingId: newListing._id
        })
      );
      
      await Promise.all(notificationPromises);
    } catch (notificationErr) {
      console.error("Failed to send background notifications:", notificationErr.message);
      // We don't crash the request if notifications fail, the listing is still created
    }
    // ------------------------------------------------------------

    res.status(201).json({
      success: true,
      message: "Food listing published successfully! Nearby NGOs are being notified.",
      listing: newListing
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Get the logged-in donor's own listings (most recent first)
// @route    GET /api/food/mine
// @access   Private (Donor only)
exports.getMyListings = async (req, res) => {
  try {
    const listings = await FoodListing.find({ donorId: req.user.userId })
      .populate('acceptedNgoId', 'orgName address')
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: listings.length, data: listings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Get a single listing by id (donor who owns it, or the NGO who claimed it)
// @route    GET /api/food/:id
// @access   Private
exports.getListingById = async (req, res) => {
  try {
    const listing = await FoodListing.findById(req.params.id)
      .populate('donorId', 'name email')
      .populate('acceptedNgoId', 'orgName email');

    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    const isOwner = listing.donorId && listing.donorId._id.toString() === req.user.userId;
    const isClaimant = listing.acceptedNgoId && listing.acceptedNgoId._id.toString() === req.user.userId;

    if (!isOwner && !isClaimant) {
      return res.status(403).json({ message: 'You do not have access to this listing.' });
    }

    res.status(200).json({ success: true, data: listing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Browse all pending listings near the logged-in NGO (falls back to newest-first if no location)
// @route    GET /api/food
// @access   Private (NGO only)
exports.browseFood = async (req, res) => {
  try {
    const ngo = await NGO.findById(req.user.userId);
    if (!ngo) {
      return res.status(403).json({ message: 'Access denied. Not a registered NGO account.' });
    }

    let query;

    if (ngo.location && ngo.location.coordinates && ngo.location.coordinates.length === 2) {
      query = FoodListing.find({
        status: 'pending',
        location: {
          $nearSphere: {
            $geometry: { type: 'Point', coordinates: ngo.location.coordinates },
            $maxDistance: 10000 
          }
        }
      });
    } else {
      query = FoodListing.find({ status: 'pending' }).sort({ createdAt: -1 });
    }

    const listings = await query.populate('donorId', 'name');

    res.status(200).json({ success: true, count: listings.length, data: listings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     NGO claims/accepts a pending food listing atomically
// @route    PUT /api/food/:id/claim
// @access   Private (NGO only)
exports.claimFoodListing = async (req, res) => {
  try {
    const listingId = req.params.id;

    const ngoProfile = await NGO.findById(req.user.userId);
    if (!ngoProfile) {
      return res.status(403).json({
        message: "Access denied. Target profile is not a valid registered NGO entity."
      });
    }

    const lockedListing = await FoodListing.findOneAndUpdate(
      { _id: listingId, status: 'pending' },
      {
        $set: {
          status: 'matched',
          acceptedNgoId: ngoProfile._id
        }
      },
      { new: true }
    );

    if (!lockedListing) {
      return res.status(409).json({
        success: false,
        message: "Conflict Error: This food shipment has already been claimed by another NGO!"
      });
    }

    // --- REMOVED KAFKA EVENT FROM HERE ---
    // The publishEvent('claimed-listings', ...) step has been safely deleted.

    await createNotification({
      userId: lockedListing.donorId,
      type: 'request_accepted',
      message: `${ngoProfile.orgName} claimed your ${lockedListing.foodType} listing (${lockedListing.quantity}).`,
      relatedListingId: lockedListing._id,
    });

    res.status(200).json({
      success: true,
      message: "Food listing claimed successfully! Pickup details locked in.",
      listing: lockedListing
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Update a listing's delivery status (matched -> in_transit -> delivered)
// @route    PUT /api/food/:id/status
// @access   Private (the claiming NGO only)
exports.updateListingStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const allowed = ['in_transit', 'delivered'];

    if (!allowed.includes(status)) {
      return res.status(400).json({ message: `Status must be one of: ${allowed.join(', ')}` });
    }

    const listing = await FoodListing.findById(req.params.id);
    if (!listing) {
      return res.status(404).json({ message: 'Listing not found.' });
    }

    if (!listing.acceptedNgoId || listing.acceptedNgoId.toString() !== req.user.userId) {
      return res.status(403).json({ message: 'Only the NGO that claimed this listing can update its status.' });
    }

    listing.status = status;
    await listing.save();

    const ngo = await NGO.findById(req.user.userId);
    await createNotification({
      userId: listing.donorId,
      type: status === 'delivered' ? 'delivered' : 'food_alert',
      message: status === 'delivered'
        ? `${ngo?.orgName || 'The NGO'} confirmed delivery of your ${listing.quantity} donation.`
        : `${ngo?.orgName || 'The NGO'} is en route to pick up your ${listing.quantity} donation.`,
      relatedListingId: listing._id,
    });

    res.status(200).json({ success: true, message: 'Status updated.', listing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
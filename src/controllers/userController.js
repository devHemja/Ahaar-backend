const Donor = require('../models/Donor');
const NGO = require('../models/NGO');
const FoodListing = require('../models/FoodListing');

const findById = async (id) => {
  let user = await Donor.findById(id);
  if (user) return { user, role: 'donor' };

  user = await NGO.findById(id);
  if (user) return { user, role: 'ngo' };

  return { user: null, role: null };
};

const serializeUser = (user, role) => ({
  id: user._id,
  name: role === 'ngo' ? user.orgName : user.name,
  email: user.email,
  role,
  regNumber: role === 'ngo' ? user.regNumber : undefined,
  category: role === 'ngo' ? user.category : undefined,
  isVerified: user.isVerified,
  address: user.address,
  location: user.location,
  createdAt: user.createdAt,
});

// @desc     Get the logged-in user's profile
// @route    GET /api/users/me
// @access   Private
exports.getMe = async (req, res) => {
  try {
    const { user, role } = await findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    res.status(200).json({ success: true, user: serializeUser(user, role) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Update the logged-in user's profile (name/orgName only — email & role are immutable here)
// @route    PUT /api/users/me
// @access   Private
exports.updateMe = async (req, res) => {
  try {
    const { name, address } = req.body;
    const { user, role } = await findById(req.user.userId);
    if (!user) return res.status(404).json({ message: 'User not found.' });

    if (name && name.trim()) {
      if (role === 'ngo') user.orgName = name.trim();
      else user.name = name.trim();
    }
    if (typeof address === 'string') {
      user.address = address.trim();
    }

    await user.save();
    res.status(200).json({ success: true, message: 'Profile updated.', user: serializeUser(user, role) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc     Dashboard stats for the logged-in donor (meals rescued, donations, NGOs reached)
// @route    GET /api/users/me/stats
// @access   Private (Donor only)
exports.getMyStats = async (req, res) => {
  try {
    const { role } = await findById(req.user.userId);

    if (role !== 'donor') {
      return res.status(403).json({ message: 'Stats are only available for donor accounts.' });
    }

    const listings = await FoodListing.find({ donorId: req.user.userId });

    const totalDonations = listings.length;
    const delivered = listings.filter((l) => l.status === 'delivered');
    const ngosReached = new Set(
      listings.filter((l) => l.acceptedNgoId).map((l) => l.acceptedNgoId.toString())
    ).size;

    // Rough proxy for "meals rescued": sum of numeric quantities across delivered listings,
    // falling back to a flat count of 1 meal-equivalent per listing when the quantity text
    // doesn't contain a parseable number.
    const mealsRescued = delivered.reduce((sum, l) => {
      const match = l.quantity.match(/\d+/);
      return sum + (match ? parseInt(match[0], 10) : 1);
    }, 0);

    res.status(200).json({
      success: true,
      stats: { mealsRescued, totalDonations, ngosReached },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

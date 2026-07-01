const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');
const NGO = require('../models/NGO');

// Resolves pathing to your root backend folder .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Every NGO seeded here shares this password so you can log in and test
// the donor -> NGO flow locally. Change it immediately if this ever runs
// against anything but a local/dev database.
const SEED_PASSWORD = 'Password123!';

const SAMPLE_NGOS = [
  {
    orgName: 'Indore Food Care NGO',
    email: 'indorefoodcare@example.org',
    regNumber: 'NGO-IND-2026-991',
    category: 'Food Relief',
    phone: '+91 9876543210',
    address: 'Palasia Square, Indore, MP',
    location: { type: 'Point', coordinates: [75.8824, 22.7244] },
  },
  {
    orgName: 'Annapurna Community Kitchen',
    email: 'annapurna.kitchen@example.org',
    regNumber: 'NGO-IND-2026-992',
    category: 'Community Kitchen',
    phone: '+91 9876543211',
    address: 'Vijay Nagar, Indore, MP',
    location: { type: 'Point', coordinates: [75.8931, 22.7532] },
  },
  {
    orgName: 'Little Sprouts Child Nutrition',
    email: 'littlesprouts@example.org',
    regNumber: 'NGO-IND-2026-993',
    category: 'Child Nutrition',
    phone: '+91 9876543212',
    address: 'Rajwada, Indore, MP',
    location: { type: 'Point', coordinates: [75.8577, 22.7178] },
  },
];

const seedSampleNGOs = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error('MONGO_URI is undefined. Check your root .env file configuration.');
    }

    console.log('Connecting to:', process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);

    // Clear out old data completely
    await NGO.deleteMany({});
    console.log('Existing collection records cleared.');

    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(SEED_PASSWORD, salt);

    const docs = SAMPLE_NGOS.map((ngo) => ({
      ...ngo,
      password: hashedPassword,
      isVerified: true,
    }));

    await NGO.insertMany(docs);

    console.log(`Database seeded with ${docs.length} verified NGOs.`);
    console.log(`All seeded NGOs share the password: ${SEED_PASSWORD}`);
    process.exit(0);
  } catch (err) {
    console.error('❌ SEEDING CRASHED WITH ERROR:', err.message);
    process.exit(1);
  }
};

seedSampleNGOs();

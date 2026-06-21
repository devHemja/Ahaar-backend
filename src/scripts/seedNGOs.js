const mongoose = require('mongoose');
const path = require('path');
const NGO = require('../models/NGO');

// Resolves pathing to your root backend folder .env
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const seedSampleNGOs = async () => {
  try {
    if (!process.env.MONGO_URI) {
      throw new Error("MONGO_URI is undefined. Check your root .env file configuration.");
    }

    console.log("Connecting to:", process.env.MONGO_URI);
    await mongoose.connect(process.env.MONGO_URI);
    
    // Clear out old data completely
    await NGO.deleteMany({});
    console.log("Existing collection records cleared.");

    // Create the dummy data item
    const dummyNGO = {
      userId: new mongoose.Types.ObjectId(), 
      orgName: "Indore Food Care NGO",
      regNumber: "NGO-IND-2026-991",
      phone: "+91 9876543210",
      address: "Palasia Square, Indore, MP",
      location: { 
        type: "Point", 
        coordinates: [75.8824, 22.7244] // Longitude first [cite: 160, 162]
      }, 
      isVerified: true
    };

    // Use .save() explicitly to catch Mongoose schema validation blocks
    const newNgo = new NGO(dummyNGO);
    await newNgo.save();

    console.log("Database seeded successfully with clean geospatial documents!");
    process.exit(0);
  } catch (err) {
    // 🌟 THIS WILL TELL US EXACTLY WHAT SCHEMA PROPERTY BROKE VALIDATION
    console.error("❌ SEEDING CRASHED WITH ERROR:", err.message);
    process.exit(1);
  }
};

seedSampleNGOs();
const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);

    // 🌟 FORCE GEOSPATIAL INDEX SYNC ON BOOT
    const db = mongoose.connection.db;
    await db.collection('users').createIndex({ "location.coordinates": "2dsphere" });
    await db.collection('ngos').createIndex({ "location.coordinates": "2dsphere" });
    await db.collection('foodlistings').createIndex({ "location.coordinates": "2dsphere" });
    console.log('Geospatial 2dsphere indexes synced successfully!');

  } catch (error) {
    console.error(`Database connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
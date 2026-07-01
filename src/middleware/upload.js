const multer = require('multer');
const { Readable } = require('stream');
const cloudinary = require('../config/cloudinary');

// Keep the file in memory only; we stream it straight to Cloudinary and
// never touch disk. Caps uploads at 5MB and only accepts image mimetypes.
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter,
});

// Streams an in-memory file buffer up to Cloudinary and resolves with the
// resulting secure URL. Used by controllers after `upload.single(...)` runs.
const uploadBufferToCloudinary = (buffer, folder = 'ahaar/food-listings') => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder, resource_type: 'image' },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
};

module.exports = { upload, uploadBufferToCloudinary };

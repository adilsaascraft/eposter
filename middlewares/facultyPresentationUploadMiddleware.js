
import multer from "multer";
import path from "node:path";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const ALLOWED_FILES = {
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx":
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};

// ========================================
// File Filter
// ========================================

const facultyPresentationFileFilter = (req, file, cb) => {
  const extension = path.extname(file.originalname).toLowerCase();
  const expectedMimeType = ALLOWED_FILES[extension];

  if (!expectedMimeType || file.mimetype !== expectedMimeType) {
    const error = new Error(
      "Only PowerPoint PPT and PPTX files are allowed."
    );

    error.statusCode = 400;
    return cb(error, false);
  }

  cb(null, true);
};

// ========================================
// Multer Configuration
// ========================================

const uploader = multer({
  storage: multer.memoryStorage(),

  limits: {
    fileSize: MAX_FILE_SIZE,
    files: 1,
    fields: 10,
    parts: 11,
    fieldSize: 64 * 1024,
  },

  fileFilter: facultyPresentationFileFilter,
});

// ========================================
// Actual File Signature Validation
// ========================================

const validatePowerPointSignature = (file) => {
  const buffer = file.buffer;

  if (!buffer || buffer.length < 8) {
    return false;
  }

  const extension = path.extname(file.originalname).toLowerCase();

  // Legacy PPT: Microsoft Compound File Binary signature
  if (extension === ".ppt") {
    const pptSignature = Buffer.from([
      0xd0, 0xcf, 0x11, 0xe0,
      0xa1, 0xb1, 0x1a, 0xe1,
    ]);

    return buffer.subarray(0, 8).equals(pptSignature);
  }

  // PPTX: ZIP archive containing PowerPoint structure
  if (extension === ".pptx") {
    const isZip =
      buffer[0] === 0x50 &&
      buffer[1] === 0x4b &&
      [0x03, 0x05, 0x07].includes(buffer[2]) &&
      [0x04, 0x06, 0x08].includes(buffer[3]);

    if (!isZip) return false;

    const hasContentTypes = buffer.includes(
      Buffer.from("[Content_Types].xml")
    );

    const hasPresentation = buffer.includes(
      Buffer.from("ppt/presentation.xml")
    );

    return hasContentTypes && hasPresentation;
  }

  return false;
};

// ========================================
// Faculty Presentation Upload Middleware
// ========================================

const uploadSinglePresentation = uploader.single("uploadPoster");

export const uploadFacultyPresentation = (req, res, next) => {
  uploadSinglePresentation(req, res, (error) => {
    if (error) {
      return next(error);
    }

    if (!req.file) {
      const missingFileError = new Error(
        "Please upload your Faculty Presentation."
      );

      missingFileError.statusCode = 400;

      return next(missingFileError);
    }

    if (!validatePowerPointSignature(req.file)) {
      const invalidFileError = new Error(
        "Invalid PowerPoint file. Please upload a valid PPT or PPTX presentation."
      );

      invalidFileError.statusCode = 400;

      return next(invalidFileError);
    }

    next();
  });
};

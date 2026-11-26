
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import FacultyPresentation from "../models/facultyPresentation.model.js";
import s3 from "../config/s3.js";
import sendEposterEmail from "../utils/sendEmail.js";
import { sendEposterWhatsApp } from "../utils/aisensyWhatsApp.js";

// ZeptoMail Faculty Presentation template key
// Configure this separately in your environment variables.
const ZEPTO_FACULTY_TEMPLATE_KEY = "2518b.554b0da719bc314.k1.508f4630-e96d-11f1-a53e-cabf48e1bf81.1a216d0d213";

// ========================================
// Helpers
// ========================================

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

const getPublicS3Url = (bucketName, region, key) => {
  const encodedKey = key
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `https://${bucketName}.s3.${region}.amazonaws.com/${encodedKey}`;
};

const updateNotificationStatus = async (
  facultyPresentationId,
  notificationType,
  status,
  error = null
) => {
  const update = {
    [`${notificationType}.status`]: status,
    [`${notificationType}.error`]: error,
    [`${notificationType}.sentAt`]:
      status === "SENT" ? new Date() : null,
  };

  try {
    await FacultyPresentation.updateOne(
      { _id: facultyPresentationId },
      { $set: update }
    );
  } catch (updateError) {
    console.error(
      `Failed to update Faculty Presentation ${notificationType} status:`,
      updateError
    );
  }
};

// ========================================
// POST: Create Faculty Presentation
// ========================================

export const createFacultyPresentation = async (req, res, next) => {
  let uploadedS3Key = null;
  let databaseCreated = false;

  try {
    const bucketName = process.env.AWS_BUCKET_NAME;
    const region =
      process.env.AWS_REGION || process.env.AWS_DEFAULT_REGION;

    if (!bucketName || !region) {
      throw new Error("AWS S3 bucket configuration is missing.");
    }

    if (!ZEPTO_FACULTY_TEMPLATE_KEY) {
      throw new Error(
        "ZeptoMail Faculty Presentation template key is not configured."
      );
    }

    // ========================================
    // 1. Validate Form Fields
    // ========================================

    const {
      presenterName,
      email,
      mobile,
      coAuthor,
      abstractNumber,
      posterType,
      posterTitle,
    } = req.body;

    const requiredFields = {
      presenterName,
      email,
      mobile,
      abstractNumber,
      posterType,
      posterTitle,
    };

    for (const [field, value] of Object.entries(requiredFields)) {
      if (typeof value !== "string" || !value.trim()) {
        throw createValidationError(`${field} is required.`);
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      throw createValidationError(
        "Please provide a valid email address."
      );
    }

    if (!req.file?.buffer) {
      throw createValidationError(
        "Please upload your Faculty Presentation."
      );
    }

    // ========================================
    // 2. Prepare S3 Upload
    // ========================================

    const extension = path
      .extname(req.file.originalname)
      .toLowerCase();

    const safePresenterName = presenterName
      .trim()
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 80);

    const fileKey = `faculty-presentations/${safePresenterName}_${randomUUID()}${extension}`;

    const originalName = path
      .basename(req.file.originalname)
      .replace(/[^\w.\- ]/g, "_")
      .slice(0, 200);

    // Public S3 URL

    const uploadPosterUrl = getPublicS3Url(
      bucketName,
      region,
      fileKey
    );

    // ========================================
    // 3. Upload Presentation to S3
    // ========================================

    await s3.send(
      new PutObjectCommand({
        Bucket: bucketName,
        Key: fileKey,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
        ContentLength: req.file.size,
        ServerSideEncryption: "AES256",
      })
    );

    uploadedS3Key = fileKey;

    // ========================================
    // 4. Create MongoDB Record
    // ========================================

    const facultyPresentation = await FacultyPresentation.create({
      presenterName: presenterName.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      coAuthor:
        typeof coAuthor === "string" ? coAuthor.trim() : "",
      abstractNumber: abstractNumber.trim(),
      posterType: posterType.trim(),
      posterTitle: posterTitle.trim(),

      uploadPoster: {
        key: fileKey,
        originalName,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },

      isActive: true,
      isPublished: true,
    });

    databaseCreated = true;

    // ========================================
    // 5. Send Confirmation Email
    // ========================================

    try {
      await sendEposterEmail({
        to: facultyPresentation.email,
        name: facultyPresentation.presenterName,
        posterTitle: facultyPresentation.posterTitle,
        uploadPosterUrl,
        templateKey: ZEPTO_FACULTY_TEMPLATE_KEY,
      });

      await updateNotificationStatus(
        facultyPresentation._id,
        "emailNotification",
        "SENT"
      );
    } catch (emailError) {
      console.error(
        "Faculty Presentation confirmation email failed:",
        emailError
      );

      await updateNotificationStatus(
        facultyPresentation._id,
        "emailNotification",
        "FAILED",
        String(
          emailError.message || "Email delivery failed"
        ).slice(0, 1000)
      );
    }

    // ========================================
    // 6. Send WhatsApp Confirmation
    // ========================================

    try {
      await sendEposterWhatsApp({
        phone: facultyPresentation.mobile,
        name: facultyPresentation.presenterName,
      });

      await updateNotificationStatus(
        facultyPresentation._id,
        "whatsappNotification",
        "SENT"
      );
    } catch (whatsappError) {
      console.error(
        "Faculty Presentation WhatsApp notification failed:",
        whatsappError
      );

      await updateNotificationStatus(
        facultyPresentation._id,
        "whatsappNotification",
        "FAILED",
        String(
          whatsappError.message || "WhatsApp delivery failed"
        ).slice(0, 1000)
      );
    }

    // ========================================
    // 7. Return Successful Response
    // ========================================

    const savedFacultyPresentation =
      await FacultyPresentation.findById(facultyPresentation._id)
        .select(
          "presenterName email mobile coAuthor abstractNumber posterType posterTitle uploadPoster isPublished emailNotification whatsappNotification createdAt"
        )
        .lean();

    if (!savedFacultyPresentation) {
      throw new Error(
        "Unable to retrieve submitted Faculty Presentation."
      );
    }

    return res.status(201).json({
      success: true,
      message:
        "Your Faculty Presentation has been submitted successfully.",

      data: {
        ...savedFacultyPresentation,

        uploadPoster: {
          ...savedFacultyPresentation.uploadPoster,
          url: uploadPosterUrl,
        },
      },
    });
  } catch (error) {
    // ========================================
    // 8. Rollback S3 Only If DB Creation Failed
    // ========================================

    if (uploadedS3Key && !databaseCreated) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: uploadedS3Key,
          })
        );
      } catch (deleteError) {
        console.error(
          "Failed to rollback uploaded Faculty Presentation from S3:",
          deleteError
        );
      }
    }

    next(error);
  }
};

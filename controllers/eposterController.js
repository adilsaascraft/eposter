
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  PutObjectCommand,
  DeleteObjectCommand,
} from "@aws-sdk/client-s3";

import Eposter from "../models/eposter.model.js";
import s3 from "../config/s3.js";
import sendEposterEmail from "../utils/sendEmail.js";
import { sendEposterWhatsApp } from "../utils/aisensyWhatsApp.js";

// Replace this with your actual ZeptoMail template key.
const ZEPTO_EPOSTER_TEMPLATE_KEY = "2518b.554b0da719bc314.k1.0dd1d000-ddb1-11f1-99e7-d2cf08f4ca8c.1a1c9e81900";

const createValidationError = (message) => {
  const error = new Error(message);
  error.statusCode = 400;
  return error;
};

// ========================================
// Notification Status Helpers
// ========================================

const updateNotificationStatus = async (
  eposterId,
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
    await Eposter.updateOne(
      { _id: eposterId },
      { $set: update }
    );
  } catch (updateError) {
    // Notification tracking failure must not reverse submission.
    console.error(
      `Failed to update ${notificationType} status:`,
      updateError
    );
  }
};

// ========================================
// POST: Create EPoster Submission
// ========================================

export const createEposter = async (req, res, next) => {
  let uploadedS3Key = null;

  try {
    const bucketName = process.env.AWS_BUCKET_NAME;

    if (!bucketName) {
      throw new Error("AWS S3 bucket configuration is missing.");
    }

    if (!ZEPTO_EPOSTER_TEMPLATE_KEY ||
        ZEPTO_EPOSTER_TEMPLATE_KEY === "YOUR_ZEPTOMAIL_TEMPLATE_KEY") {
      throw new Error("ZeptoMail EPoster template key is not configured.");
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
        throw createValidationError(
          `${field} is required.`
        );
      }
    }

    const normalizedEmail = email.trim().toLowerCase();

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      throw createValidationError("Please provide a valid email address.");
    }

    if (!req.file?.buffer) {
      throw createValidationError("Please upload your E-Poster.");
    }

    // ========================================
    // 2. Prepare S3 Upload
    // ========================================

    const extension = path.extname(req.file.originalname).toLowerCase();

    const fileKey = `eposters/${randomUUID()}${extension}`;

    const originalName = path
      .basename(req.file.originalname)
      .replace(/[^\w.\- ]/g, "_")
      .slice(0, 200);

    // ========================================
    // 3. Upload Poster to Private S3
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

    const eposter = await Eposter.create({
      presenterName: presenterName.trim(),
      email: normalizedEmail,
      mobile: mobile.trim(),
      coAuthor: typeof coAuthor === "string" ? coAuthor.trim() : "",
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

    // Database creation succeeded.
    // From this point, notification failures must not fail submission.

    // ========================================
    // 5. Send Confirmation Email
    // ========================================

    try {
     await sendEposterEmail({
  to: eposter.email,
  name: eposter.presenterName,
  posterTitle: eposter.posterTitle,
  templateKey: ZEPTO_EPOSTER_TEMPLATE_KEY,
});

      await updateNotificationStatus(
        eposter._id,
        "emailNotification",
        "SENT"
      );
    } catch (emailError) {
      console.error("EPoster confirmation email failed:", emailError);

      await updateNotificationStatus(
        eposter._id,
        "emailNotification",
        "FAILED",
        String(emailError.message || "Email delivery failed").slice(0, 1000)
      );
    }

    // ========================================
    // 6. Send WhatsApp Confirmation
    // ========================================

    try {
      await sendEposterWhatsApp({
        phone: eposter.mobile,
        name: eposter.presenterName,
      });

      await updateNotificationStatus(
        eposter._id,
        "whatsappNotification",
        "SENT"
      );
    } catch (whatsappError) {
      console.error("EPoster WhatsApp notification failed:", whatsappError);

      await updateNotificationStatus(
        eposter._id,
        "whatsappNotification",
        "FAILED",
        String(whatsappError.message || "WhatsApp delivery failed").slice(0, 1000)
      );
    }

    // ========================================
    // 7. Return Successful Response
    // ========================================

    const savedEposter = await Eposter.findById(eposter._id)
      .select(
        "presenterName abstractNumber posterTitle isPublished emailNotification whatsappNotification createdAt"
      )
      .lean();

    return res.status(201).json({
      success: true,
      message: "Your E-Poster has been submitted successfully.",
      data: savedEposter,
    });
  } catch (error) {
    // ========================================
    // 8. Rollback S3 if Database Creation Fails
    // ========================================

    if (uploadedS3Key) {
      try {
        await s3.send(
          new DeleteObjectCommand({
            Bucket: process.env.AWS_BUCKET_NAME,
            Key: uploadedS3Key,
          })
        );
      } catch (deleteError) {
        console.error(
          "Failed to rollback uploaded EPoster from S3:",
          deleteError
        );
      }
    }

    next(error);
  }
};

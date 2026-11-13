
import mongoose from "mongoose";

const oralSchema = new mongoose.Schema(
  {
    // ========================================
    // Presenter Information
    // ========================================

    presenterName: {
      type: String,
      required: [true, "Presenter name is required"],
      trim: true,
      maxlength: 150,
    },

    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: 254,
    },

    mobile: {
      type: String,
      required: [true, "Mobile number is required"],
      trim: true,
      maxlength: 20,
    },

    coAuthor: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    // ========================================
    // Poster Information
    // ========================================

    abstractNumber: {
      type: String,
      required: [true, "Abstract number is required"],
      trim: true,
      minlength: [3, "Abstract number must be at least 3 characters"],
      maxlength: [100, "Abstract number cannot exceed 100 characters"],
    },

    posterType: {
      type: String,
      required: [true, "Poster type is required"],
      trim: true,
      maxlength: 100,
    },

    posterTitle: {
      type: String,
      required: [true, "Poster title is required"],
      trim: true,
      maxlength: 500,
    },

    // ========================================
    // Uploaded PowerPoint File
    // ========================================

    uploadPoster: {
      key: {
        type: String,
        required: true,
      },
      originalName: {
        type: String,
        required: true,
      },
      mimeType: {
        type: String,
        required: true,
      },
      size: {
        type: Number,
        required: true,
      },
    },

    // ========================================
    // Notification Tracking
    // ========================================

    emailNotification: {
      status: {
        type: String,
        enum: ["PENDING", "SENT", "FAILED"],
        default: "PENDING",
      },
      sentAt: {
        type: Date,
        default: null,
      },
      error: {
        type: String,
        default: null,
      },
    },

    whatsappNotification: {
      status: {
        type: String,
        enum: ["PENDING", "SENT", "FAILED"],
        default: "PENDING",
      },
      sentAt: {
        type: Date,
        default: null,
      },
      error: {
        type: String,
        default: null,
      },
    },

    // ========================================
    // Admin Management
    // ========================================

    isActive: {
      type: Boolean,
      default: true,
    },

    // ========================================
    // LCD Display Management
    // ========================================

    isPublished: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// ========================================
// Database Indexes (Non-Unique)
// ========================================

oralSchema.index({ presenterName: 1 });
oralSchema.index({ email: 1 });
oralSchema.index({ mobile: 1 });
oralSchema.index({ abstractNumber: 1 });

oralSchema.index({
  isActive: 1,
  isPublished: 1,
  createdAt: -1,
});

// ========================================
// Model Export
// ========================================

const Oral = mongoose.model("Oral", oralSchema);

export default Oral;

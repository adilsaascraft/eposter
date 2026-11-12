
import "./config/dns.js";
import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import morgan from "morgan";
import multer from "multer";

import connectDB from "./config/db.js";

import eposterRoutes from "./routes/eposterRoutes.js";

const app = express();

// ==============================
// CORS Configuration
// ==============================

const allowedOrigins = [
  "http://localhost:3000",
  process.env.USER_FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
]
  .filter(Boolean)
  .flatMap((origin) => origin.split(",").map((item) => item.trim()));

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests without an Origin header (Postman/server-to-server).
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("Origin not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  }),
);

// ==============================
// Global Middleware
// ==============================

app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(cookieParser());
app.use(morgan("dev"));

// ==============================
// Health Check
// ==============================

app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "EPoster Backend API is running.",
    environment: process.env.NODE_ENV || "development",
  });
});

// ==============================
// API Routes
// ==============================

// We'll register EPoster routes here once created.
app.use("/api/eposters", eposterRoutes);

// ==============================
// 404 Handler
// ==============================

app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// ==============================
// Global Error Handler
// ==============================

app.use((err, req, res, next) => {
  console.error("API Error:", err);

  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        message: "Poster file must not exceed 10 MB.",
      });
    }

    return res.status(400).json({
      success: false,
      message: err.message,
    });
  }

  if (err.message === "Origin not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Cross-origin request not allowed.",
    });
  }

  return res.status(err.statusCode || 500).json({
    success: false,
    message:
      err.statusCode && err.statusCode < 500
        ? err.message
        : "Internal server error.",
  });
});

// ==============================
// Start Server
// ==============================

const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();

    app.listen(PORT, "0.0.0.0", () => {
      console.log(`EPoster API running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    console.error("Failed to start EPoster server:", error);
    process.exit(1);
  }
};

startServer();

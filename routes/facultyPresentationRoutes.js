
import express from "express";

import {
  createFacultyPresentation,
} from "../controllers/facultyPresentation.controller.js";

import {
  uploadFacultyPresentation,
} from "../middlewares/facultyPresentationUploadMiddleware.js";

const router = express.Router();

// POST /api/faculty-presentations
router.post(
  "/",
  uploadFacultyPresentation,
  createFacultyPresentation
);

export default router;

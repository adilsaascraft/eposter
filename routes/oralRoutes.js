
import express from "express";

import { createOral } from "../controllers/oralController.js";
import { uploadOral } from "../middlewares/oralUploadMiddleware.js";

const router = express.Router();

// POST /api/orals
router.post("/", uploadOral, createOral);

export default router;

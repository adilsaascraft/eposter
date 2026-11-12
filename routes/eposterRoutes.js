
import express from "express";

import { createEposter } from "../controllers/eposterController.js";
import { uploadEposter } from "../middlewares/uploadMiddleware.js";

const router = express.Router();

// POST /api/eposters
router.post("/", uploadEposter, createEposter);

export default router;

// routes/massUploadSolutions.js
// POST /api/mass-upload-solutions (DEPRECATED)

import express from "express";

const router = express.Router();

router.post("/mass-upload-solutions", (_req, res) => {
  return res.status(410).json({
    error: "POST /api/mass-upload-solutions is deprecated. Use the unified Question Bank ZIP import at POST /api/questions/admin/image-zip.",
  });
});

export default router;

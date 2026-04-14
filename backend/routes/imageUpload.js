import express from "express";
import upload from "../middleware/upload.js";
import auth from "../middleware/auth.js";
import { bulkUpload, uploadImageQuestion } from "../controllers/imageQuestionController.js";

const router = express.Router();

router.post(
  "/image-question",
  auth,
  upload.fields([{ name: "questionImage", maxCount: 1 }]),
  uploadImageQuestion
);

router.post(
  "/bulk-image",
  auth,
  upload.array("images", 20),
  bulkUpload
);

export default router;
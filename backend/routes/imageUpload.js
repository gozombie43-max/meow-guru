import express from "express";
import upload from "../middleware/upload.js";
import auth from "../middleware/auth.js";
import {
  bulkUpload,
  uploadImageQuestion,
  uploadSolutionImage,
  serveImage,
} from "../controllers/imageQuestionController.js";

const router = express.Router();

router.get(
  "/image/:id",
  serveImage
);

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

router.post(
  "/solution-image",
  auth,
  upload.single("image"),
  uploadSolutionImage
);

export default router;

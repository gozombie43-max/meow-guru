// routes/uploadNoteImage.js

import express from "express";
import multer from "multer";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB
  },
});

const NOTE_IMAGE_PREFIX = "notes/images";

const IMAGE_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

const imageIdFromKey = (key) =>
  Buffer
    .from(key, "utf8")
    .toString("base64url");

const buildImageUrl = (key) =>
  `/api/upload/image/${imageIdFromKey(key)}`;

const extensionFromMime = (mimeType) => {
  switch (mimeType) {
    case "image/jpeg":
      return "jpg";

    case "image/png":
      return "png";

    case "image/webp":
      return "webp";

    case "image/gif":
      return "gif";

    default:
      return null;
  }
};

router.post(
  "/",
  upload.single("image"),
  async (req, res) => {
    if (!req.file) {
      return res
        .status(400)
        .json({
          error: "No file provided",
        });
    }

    if (
      !ALLOWED_IMAGE_TYPES.has(
        req.file.mimetype
      )
    ) {
      return res
        .status(400)
        .json({
          error:
            "Only JPG, PNG, WebP, and GIF images are allowed",
        });
    }

    try {
      const extension =
        extensionFromMime(
          req.file.mimetype
        );

      const key =
        `${NOTE_IMAGE_PREFIX}/${uuidv4()}.${extension}`;

      await b2Client.send(
        new PutObjectCommand({
          Bucket: B2_BUCKET,
          Key: key,

          Body: req.file.buffer,
          ContentLength:
            req.file.buffer.length,

          ContentType:
            req.file.mimetype,

          CacheControl:
            IMAGE_CACHE_CONTROL,
        })
      );

      const url =
        buildImageUrl(key);

      return res.json({
        url,
        key,
      });

    } catch (err) {
      console.error(
        "Note image upload error:",
        err
      );

      return res
        .status(500)
        .json({
          error:
            "Image upload failed",
        });
    }
  }
);

export default router;
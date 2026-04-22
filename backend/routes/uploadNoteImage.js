// routes/uploadNoteImage.js
import express from "express";
import multer from "multer";
import { BlobServiceClient } from "@azure/storage-blob";
import { v4 as uuidv4 } from "uuid";

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
});

const blobClient = BlobServiceClient.fromConnectionString(
  process.env.AZURE_STORAGE_CONNECTION_STRING
);

router.post("/", upload.single("image"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file provided" });
  }

  try {
    const container = blobClient.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_NOTES
    );

    const ext       = req.file.originalname.split(".").pop();
    const blobName  = `${uuidv4()}.${ext}`;
    const blockBlob = container.getBlockBlobClient(blobName);

    await blockBlob.uploadData(req.file.buffer, {
      blobHTTPHeaders: { blobContentType: req.file.mimetype },
    });

    res.json({ url: blockBlob.url });
  } catch (err) {
    console.error("Note image upload error:", err);
    res.status(500).json({ error: "Image upload failed" });
  }
});

export default router;
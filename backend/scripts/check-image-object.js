import "dotenv/config";

import { BlobServiceClient } from "@azure/storage-blob";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

const blobName =
  "visual_1776252864088_9d03bca4/question.webp";

const b2Key =
  `question-images/${blobName}`;

async function run() {
  // Azure
  const azure =
    BlobServiceClient.fromConnectionString(
      process.env.AZURE_STORAGE_CONNECTION_STRING
    );

  const container =
    azure.getContainerClient(
      process.env.AZURE_STORAGE_CONTAINER_QUESTIONS
    );

  const azureExists =
    await container
      .getBlobClient(blobName)
      .exists();

  console.log("");
  console.log("Azure exact object:");
  console.log(azureExists ? "✅ EXISTS" : "❌ NOT FOUND");

  // B2
  const result = await b2Client.send(
    new ListObjectsV2Command({
      Bucket: B2_BUCKET,
      Prefix:
        "question-images/visual_1776252864088_9d03bca4/",
      MaxKeys: 20,
    })
  );

  const objects =
    result.Contents || [];

  console.log("");
  console.log("B2 matching objects:");

  if (!objects.length) {
    console.log("❌ NONE FOUND");
  } else {
    for (const object of objects) {
      console.log(
        `${object.Key} (${object.Size} bytes)`
      );
    }
  }

  const exactB2 =
    objects.some(
      (object) =>
        object.Key === b2Key
    );

  console.log("");
  console.log(
    "B2 exact object:",
    exactB2
      ? "✅ EXISTS"
      : "❌ NOT FOUND"
  );
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
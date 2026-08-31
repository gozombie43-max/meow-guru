import "dotenv/config";

import {
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

const PREFIX = "quiz-pdfs/";

async function run() {
  const result = await b2Client.send(
    new ListObjectsV2Command({
      Bucket: B2_BUCKET,
      Prefix: PREFIX,
      MaxKeys: 5,
    })
  );

  const files = (result.Contents || [])
    .filter(
      (item) =>
        item.Key &&
        !item.Key.endsWith("/")
    );

  if (!files.length) {
    console.log("❌ No PDFs found");
    return;
  }

  for (const file of files) {
    const logicalPath =
      file.Key.slice(PREFIX.length);

    const id =
      `pdf-${Buffer
        .from(logicalPath, "utf8")
        .toString("base64url")}`;

    console.log("");
    console.log("B2 key:");
    console.log(file.Key);

    console.log("PDF ID:");
    console.log(id);

    console.log(
      "Stream endpoint:"
    );

    console.log(
      `http://localhost:10000/api/pdfs/stream/${id}`
    );

    break;
  }
}

run().catch(console.error);
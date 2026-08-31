import "dotenv/config";

import {
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

const key =
  "question-images/mirror_water_099/question.webp";

async function run() {
  console.log("Testing:", key);

  const result = await b2Client.send(
    new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    })
  );

  console.log("");
  console.log("✅ GET OBJECT SUCCESS");
  console.log(
    "Content-Type   :",
    result.ContentType
  );
  console.log(
    "Content-Length :",
    result.ContentLength
  );

  /*
   * Consume stream so connection closes properly.
   */
  if (result.Body) {
    await result.Body.transformToByteArray();
  }

  console.log(
    "✅ B2 IMAGE READ VERIFIED"
  );
}

run().catch((error) => {
  console.error("");
  console.error(
    "❌ B2 GET OBJECT FAILED"
  );
  console.error(
    "Status:",
    error?.$metadata?.httpStatusCode
  );
  console.error(
    "Name:",
    error?.name
  );
  console.error(
    "Message:",
    error?.message
  );

  process.exit(1);
});
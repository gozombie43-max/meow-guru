import "dotenv/config";

import {
  ListObjectsV2Command,
  GetObjectCommand,
} from "@aws-sdk/client-s3";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

import {
  getSignedUrl,
} from "@aws-sdk/s3-request-presigner";

async function run() {
  const list = await b2Client.send(
    new ListObjectsV2Command({
      Bucket: B2_BUCKET,
      Prefix: "quiz-pdfs/",
      MaxKeys: 1,
    })
  );

  const object = list.Contents?.[0];

  if (!object?.Key) {
    console.log("❌ No quiz PDF found");
    return;
  }

  const key = object.Key;

  console.log("");
  console.log("Exact B2 key:");
  console.log(JSON.stringify(key));

  console.log("");
  console.log("Listed size:");
  console.log(object.Size);

  console.log("");
  console.log("Testing direct GetObject...");

  const response = await b2Client.send(
    new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    })
  );

  console.log("✅ DIRECT GET SUCCESS");
  console.log(
    "Content-Type:",
    response.ContentType
  );
  console.log(
    "Content-Length:",
    response.ContentLength
  );

  /*
   * Don't download the entire PDF.
   * Close the response stream.
   */
  response.Body?.destroy?.();

  const signedUrl = await getSignedUrl(
    b2Client,
    new GetObjectCommand({
      Bucket: B2_BUCKET,
      Key: key,
    }),
    {
      expiresIn: 3600,
    }
  );

  console.log("");
  console.log("Signed URL:");
  console.log(signedUrl);

  console.log("");
  console.log("Testing signed URL...");

  const httpResponse = await fetch(signedUrl, {
    headers: {
      Range: "bytes=0-0",
    },
  });

  console.log(
    "Signed URL HTTP status:",
    httpResponse.status
  );

  console.log(
    "Signed URL Content-Type:",
    httpResponse.headers.get("content-type")
  );

  await httpResponse.body?.cancel();

  if (
    httpResponse.status === 200 ||
    httpResponse.status === 206
  ) {
    console.log(
      "✅ SIGNED PDF URL VERIFIED"
    );
  } else {
    console.log(
      "❌ SIGNED PDF URL FAILED"
    );
  }
}

run().catch((error) => {
  console.error("");
  console.error("❌ TEST FAILED");
  console.error("Status:", error?.$metadata?.httpStatusCode);
  console.error("Name:", error?.name);
  console.error("Message:", error?.message);
  console.error("Code:", error?.Code);
});

import "dotenv/config";

import {
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

const API =
  "http://localhost:10000/api/pdfs/stream";

async function run() {
  // Get one exact B2 PDF key
  const list = await b2Client.send(
    new ListObjectsV2Command({
      Bucket: B2_BUCKET,
      Prefix: "quiz-pdfs/",
      MaxKeys: 1,
    })
  );

  const exactKey =
    list.Contents?.[0]?.Key;

  if (!exactKey) {
    throw new Error("No PDF found in B2");
  }

  const logicalPath =
    exactKey.slice("quiz-pdfs/".length);

  const id =
    `pdf-${Buffer
      .from(logicalPath, "utf8")
      .toString("base64url")}`;

  console.log("Exact B2 key:");
  console.log(JSON.stringify(exactKey));

  console.log("\nLogical path:");
  console.log(JSON.stringify(logicalPath));

  // Ask your real backend for signed URL
  const apiResponse = await fetch(
    `${API}/${encodeURIComponent(id)}`
  );

  console.log(
    "\nBackend status:",
    apiResponse.status
  );

  const body = await apiResponse.json();

  if (!body.url) {
    console.log(body);
    return;
  }

  const signed = new URL(body.url);

  const routeKey =
    decodeURIComponent(
      signed.pathname.replace(/^\/+/, "")
    );

  // virtual-hosted B2 URL pathname normally starts
  // directly with quiz-pdfs/...
  console.log("\nRoute-generated key:");
  console.log(JSON.stringify(routeKey));

  console.log(
    "\nKeys identical:",
    routeKey === exactKey
      ? "✅ YES"
      : "❌ NO"
  );

  // Test route-generated signed URL directly
  const fileResponse = await fetch(
    body.url,
    {
      headers: {
        Range: "bytes=0-0",
      },
    }
  );

  console.log(
    "\nRoute signed URL status:",
    fileResponse.status
  );

  console.log(
    "Content-Type:",
    fileResponse.headers.get(
      "content-type"
    )
  );

  await fileResponse.body?.cancel();

  if (
    routeKey === exactKey &&
    (fileResponse.status === 200 ||
      fileResponse.status === 206)
  ) {
    console.log(
      "\n✅ PDF STREAM ROUTE VERIFIED"
    );
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
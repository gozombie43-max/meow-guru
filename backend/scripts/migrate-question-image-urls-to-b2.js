import "dotenv/config";

import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { MongoClient } from "mongodb";
import pLimit from "p-limit";

import { b2Client, B2_BUCKET } from "../config/b2.js";

const APPLY = process.argv.includes("--apply");
const AZURE_HOST_SUFFIX = ".blob.core.windows.net";
const AZURE_CONTAINER = "questions";
const B2_PREFIX = "question-images";
const VERIFY_CONCURRENCY = 10;
const WRITE_BATCH_SIZE = 100;

const imageIdFromKey = (key) =>
  Buffer.from(key, "utf8").toString("base64url");

const buildImageUrl = (key) =>
  `/api/upload/image/${imageIdFromKey(key)}`;

function b2KeyFromAzureUrl(value) {
  let url;

  try {
    url = new URL(value);
  } catch {
    return null;
  }

  if (
    url.protocol !== "https:" ||
    !url.hostname.toLowerCase().endsWith(AZURE_HOST_SUFFIX)
  ) {
    return null;
  }

  const pathParts = url.pathname.split("/").filter(Boolean);
  const [container, ...blobParts] = pathParts;

  if (container !== AZURE_CONTAINER || blobParts.length === 0) {
    return null;
  }

  try {
    const blobName = blobParts.map(decodeURIComponent).join("/");
    return `${B2_PREFIX}/${blobName}`;
  } catch {
    return null;
  }
}

async function verifyB2Object(key) {
  try {
    await b2Client.send(
      new HeadObjectCommand({
        Bucket: B2_BUCKET,
        Key: key,
      })
    );

    return null;
  } catch (error) {
    return {
      key,
      status: error?.$metadata?.httpStatusCode ?? null,
      error: error?.name || error?.message || "Unknown B2 error",
    };
  }
}

async function run() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();
    await client.db("admin").command({ ping: 1 });

    const questions = client.db("quizDB").collection("questions");
    const candidates = await questions
      .find(
        {
          questionImage: {
            $type: "string",
            $regex: /^https:\/\/[^/]+\.blob\.core\.windows\.net\/questions\//i,
          },
        },
        {
          projection: {
            _id: 1,
            id: 1,
            questionImage: 1,
          },
        }
      )
      .toArray();

    const migrations = [];
    const invalid = [];

    for (const document of candidates) {
      const key = b2KeyFromAzureUrl(document.questionImage);

      if (!key) {
        invalid.push({
          id: document.id ?? String(document._id),
          questionImage: document.questionImage,
        });
        continue;
      }

      migrations.push({
        _id: document._id,
        id: document.id ?? String(document._id),
        oldUrl: document.questionImage,
        key,
        newUrl: buildImageUrl(key),
      });
    }

    const limit = pLimit(VERIFY_CONCURRENCY);
    const verificationResults = await Promise.all(
      migrations.map((migration) =>
        limit(() => verifyB2Object(migration.key))
      )
    );
    const missing = verificationResults.filter(Boolean);
    const verifiedMigrations = migrations.filter(
      (_migration, index) => verificationResults[index] === null
    );

    console.log(`Mode                 : ${APPLY ? "APPLY" : "DRY RUN"}`);
    console.log(`Azure URL candidates : ${candidates.length}`);
    console.log(`Valid mappings       : ${migrations.length}`);
    console.log(`Verified in B2       : ${verifiedMigrations.length}`);
    console.log(`Invalid URLs         : ${invalid.length}`);
    console.log(`Missing in B2        : ${missing.length}`);

    if (invalid.length > 0) {
      console.error("Invalid Azure URLs:");
      console.error(JSON.stringify(invalid, null, 2));
    }

    if (missing.length > 0) {
      console.error("B2 verification failures:");
      console.error(JSON.stringify(missing, null, 2));
    }

    if (!APPLY) {
      console.log("No MongoDB documents changed. Rerun with --apply to migrate.");
      return;
    }

    let matched = 0;
    let modified = 0;

    for (
      let index = 0;
      index < verifiedMigrations.length;
      index += WRITE_BATCH_SIZE
    ) {
      const batch = verifiedMigrations.slice(index, index + WRITE_BATCH_SIZE);
      const result = await questions.bulkWrite(
        batch.map((migration) => ({
          updateOne: {
            filter: {
              _id: migration._id,
              questionImage: migration.oldUrl,
            },
            update: {
              $set: {
                questionImage: migration.newUrl,
                questionImageKey: migration.key,
              },
            },
          },
        })),
        { ordered: true }
      );

      matched += result.matchedCount;
      modified += result.modifiedCount;
    }

    const remainingAzureUrls = await questions.countDocuments({
      questionImage: {
        $type: "string",
        $regex: /^https:\/\/[^/]+\.blob\.core\.windows\.net\/questions\//i,
      },
    });
    const migratedUrls = await questions.countDocuments({
      questionImage: /^\/api\/upload\/image\//,
      questionImageKey: /^question-images\//,
    });

    console.log(`Matched documents    : ${matched}`);
    console.log(`Modified documents   : ${modified}`);
    console.log(`Remaining Azure URLs : ${remainingAzureUrls}`);
    console.log(`Stable B2 URLs       : ${migratedUrls}`);

    if (
      matched !== verifiedMigrations.length ||
      modified !== verifiedMigrations.length ||
      remainingAzureUrls !== invalid.length + missing.length
    ) {
      throw new Error("Post-migration verification failed");
    }

    if (remainingAzureUrls > 0) {
      console.log(
        "Verified question image URLs migrated; unresolved documents were left unchanged."
      );
    } else {
      console.log("Question image URL migration completed successfully.");
    }
  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error("Question image URL migration failed:");
  console.error(error.message);
  process.exitCode = 1;
});

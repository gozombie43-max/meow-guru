import "dotenv/config";

import { MongoClient } from "mongodb";
import { HeadObjectCommand } from "@aws-sdk/client-s3";
import pLimit from "p-limit";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

const limit = pLimit(10);

async function checkObject(doc) {
  const key = doc.questionImageKey;

  if (
    !key ||
    !key.startsWith("question-images/")
  ) {
    return {
      id: doc.id,
      key,
      error: "Missing questionImageKey",
    };
  }

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
      id: doc.id,
      key,
      status:
        error?.$metadata?.httpStatusCode ??
        null,
      error:
        error?.name ||
        error?.message ||
        "Unknown error",
    };
  }
}

async function run() {
  const client = new MongoClient(
    process.env.MONGODB_URI
  );

  try {
    await client.connect();

    const questions = client
      .db("quizDB")
      .collection("questions");

    const docs = await questions
      .find(
        {
          questionImage:
            /\/api\/upload\/image\//,
        },
        {
          projection: {
            _id: 0,
            id: 1,
            questionImage: 1,
            questionImageKey: 1,
          },
        }
      )
      .toArray();

    console.log(
      `B2-backed MongoDB images : ${docs.length}`
    );

    const results = await Promise.all(
      docs.map((doc) =>
        limit(() => checkObject(doc))
      )
    );

    const failures =
      results.filter(Boolean);

    console.log(
      `Verified in B2          : ${
        docs.length - failures.length
      }`
    );

    console.log(
      `Missing / failed        : ${failures.length}`
    );

    if (failures.length) {
      console.log("");
      console.log(
        JSON.stringify(
          failures,
          null,
          2
        )
      );
    } else {
      console.log("");
      console.log(
        "✅ ALL MONGODB B2 IMAGES VERIFIED"
      );
    }

  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
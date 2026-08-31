import "dotenv/config";

import { MongoClient } from "mongodb";
import { ListObjectsV2Command } from "@aws-sdk/client-s3";

import {
  b2Client,
  B2_BUCKET,
} from "../config/b2.js";

const PREFIX = "question-images/";

async function listAllB2Keys() {
  const keys = [];
  let continuationToken;

  do {
    const response = await b2Client.send(
      new ListObjectsV2Command({
        Bucket: B2_BUCKET,
        Prefix: PREFIX,
        ContinuationToken: continuationToken,
        MaxKeys: 1000,
      })
    );

    for (const object of response.Contents || []) {
      if (object.Key) {
        keys.push(object.Key);
      }
    }

    continuationToken =
      response.IsTruncated
        ? response.NextContinuationToken
        : undefined;

  } while (continuationToken);

  return keys;
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
          questionImageKey: {
            $type: "string",
            $regex: /^question-images\//,
          },
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

    console.log("Loading B2 object listing...");

    const b2Keys = await listAllB2Keys();
    const b2Set = new Set(b2Keys);

    const present = [];
    const missing = [];

    for (const doc of docs) {
      if (b2Set.has(doc.questionImageKey)) {
        present.push(doc);
      } else {
        missing.push(doc);
      }
    }

    const mongoKeySet = new Set(
      docs.map((doc) => doc.questionImageKey)
    );

    const unreferenced = b2Keys.filter(
      (key) => !mongoKeySet.has(key)
    );

    console.log("");
    console.log(
      "======================================"
    );
    console.log(
      "MONGODB ↔ B2 IMAGE KEY COMPARISON"
    );
    console.log(
      "======================================"
    );

    console.log(
      `Mongo B2 image records : ${docs.length}`
    );

    console.log(
      `B2 question objects    : ${b2Keys.length}`
    );

    console.log(
      `Exact matches          : ${present.length}`
    );

    console.log(
      `Mongo keys missing B2  : ${missing.length}`
    );

    console.log(
      `B2 objects unreferenced: ${unreferenced.length}`
    );

    console.log(
      "======================================"
    );

    if (missing.length > 0) {
      console.log("");
      console.log(
        "--- Missing Mongo keys ---"
      );

      for (const doc of missing.slice(0, 20)) {
        console.log("");
        console.log(`ID  : ${doc.id}`);
        console.log(
          `Key : ${doc.questionImageKey}`
        );

        const id = String(
          doc.id || ""
        ).toLowerCase();

        const candidates = id
          ? b2Keys.filter((key) =>
              key
                .toLowerCase()
                .includes(id)
            )
          : [];

        if (candidates.length) {
          console.log(
            "Possible B2 matches:"
          );

          for (
            const key
            of candidates.slice(0, 10)
          ) {
            console.log(
              `  -> ${key}`
            );
          }
        }
      }
    }

    if (missing.length === 0) {
      console.log("");
      console.log(
        "✅ ALL MONGODB IMAGE KEYS EXIST IN B2"
      );
    }

  } finally {
    await client.close();
  }
}

run().catch((error) => {
  console.error(
    "Comparison failed:"
  );
  console.error(error);
  process.exit(1);
});
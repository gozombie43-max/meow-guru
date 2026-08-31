import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);

async function fix() {
  try {
    await client.connect();

    const collection = client
      .db("quizDB")
      .collection("questions");

    const result = await collection.updateOne(
      {
        id: "visual_1776252864088_9d03bca4",
        topic: null,
      },
      {
        $unset: {
          topic: "",
        },
      }
    );

    console.log("Matched :", result.matchedCount);
    console.log("Modified:", result.modifiedCount);

    if (result.modifiedCount === 1) {
      console.log("✅ Missing topic restored exactly");
    }
  } finally {
    await client.close();
  }
}

fix();

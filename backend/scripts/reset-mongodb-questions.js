import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);

async function reset() {
  try {
    await client.connect();

    const collection = client
      .db("quizDB")
      .collection("questions");

    const before = await collection.countDocuments();
    console.log("Documents before reset:", before);

    await collection.deleteMany({});

    // Remove the incorrect unique { id: 1 } index if present
    const indexes = await collection.indexes();

    const idIndex = indexes.find(
      (index) =>
        index.key?.id === 1 &&
        Object.keys(index.key).length === 1
    );

    if (idIndex) {
      await collection.dropIndex(idIndex.name);
      console.log("✅ Removed old id-only index:", idIndex.name);
    }

    // Match Cosmos uniqueness: id within /topic
    await collection.createIndex(
      { id: 1, topic: 1 },
      { unique: true }
    );

    console.log("✅ Created unique { id, topic } index");
    console.log(
      "Documents after reset:",
      await collection.countDocuments()
    );
  } catch (error) {
    console.error("❌ Reset failed");
    console.error(error);
  } finally {
    await client.close();
  }
}

reset();
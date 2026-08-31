import dotenv from "dotenv";
import { MongoClient } from "mongodb";

dotenv.config();

const client = new MongoClient(process.env.MONGODB_URI);

async function testConnection() {
  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });

    console.log("✅ MongoDB Atlas connected successfully");

    const db = client.db("quizDB");

    console.log("Database:", db.databaseName);
  } catch (error) {
    console.error("❌ MongoDB connection failed");
    console.error(error);
  } finally {
    await client.close();
  }
}

testConnection();
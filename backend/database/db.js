const { MongoClient } = require("mongodb");

const url = "mongodb://127.0.0.1:27017";
const client = new MongoClient(url);

const dbName = "examDB";

async function connectDB() {
  await client.connect();
  console.log("Connected to MongoDB");
  return client.db(dbName);
}

module.exports = connectDB;
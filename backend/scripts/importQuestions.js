const connectDB = require("../database/db");
const questions = require("../../data/questions.json");

async function importQuestions() {
 const db = await connectDB();

 const collection = db.collection("questions");

 await collection.insertMany(questions);

 console.log("Questions imported successfully");
}

importQuestions();
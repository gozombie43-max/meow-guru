const connectDB = require("../database/db")
const tagQuestion = require("../ai/tagQuestion")

async function runTagger(){

 const db = await connectDB()

 const questions = await db
  .collection("questions")
  .find({ concept: { $exists:false } })
  .toArray()

 for(const q of questions){

  const tags = await tagQuestion(q.question)

  await db.collection("questions").updateOne(
   { _id: q._id },
   { $set: tags }
  )

  console.log("Tagged:", q.question)
 }

}

runTagger()
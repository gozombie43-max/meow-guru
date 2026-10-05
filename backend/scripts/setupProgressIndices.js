import { connectMongoDB, getUserQuestionProgressCollection, getUserTopicProgressCollection, disconnectMongoDB } from "../config/mongodb.js";
import 'dotenv/config';

async function run() {
  await connectMongoDB();
  const userQuestionProgress = getUserQuestionProgressCollection();
  const userTopicProgress = getUserTopicProgressCollection();

  await userQuestionProgress.createIndex({ userId: 1, questionUid: 1 }, { unique: true, partialFilterExpression: { questionUid: { $type: "string" } }, name: "canonical_user_question_progress" });
  await userQuestionProgress.createIndex({ userId: 1, topic: 1 });
  await userTopicProgress.createIndex({ userId: 1, topic: 1 }, { unique: true });

  console.log("Progress indices created.");
  await disconnectMongoDB();
}
run();

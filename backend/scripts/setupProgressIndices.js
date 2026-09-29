import { connectMongoDB, getUserQuestionProgressCollection, getUserTopicProgressCollection, disconnectMongoDB } from "../config/mongodb.js";
import 'dotenv/config';

async function run() {
  await connectMongoDB();
  const userQuestionProgress = getUserQuestionProgressCollection();
  const userTopicProgress = getUserTopicProgressCollection();

  await userQuestionProgress.createIndex({ userId: 1, questionId: 1 }, { unique: true });
  await userQuestionProgress.createIndex({ userId: 1, topic: 1 });
  await userTopicProgress.createIndex({ userId: 1, topic: 1 }, { unique: true });

  console.log("Progress indices created.");
  await disconnectMongoDB();
}
run();

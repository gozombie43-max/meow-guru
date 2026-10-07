import { resolveQuestion } from '../services/questions/questionIdentity.js';
import { withMongoTransaction, getQuestionsCollection, getUserTopicProgressCollection } from '../config/mongodb.js';
import { advanceTopicProgressRevision } from '../services/questions/topicProgressCache.js';
export const findAnsweredQuestion = (questionId, context = {}) => resolveQuestion(getQuestionsCollection(), questionId, context);
export const readUserTopicProgress = userId => getUserTopicProgressCollection().find({ userId }).toArray();
export async function recordQuestionAnswer(userId, questionUid, topic, isCorrect, legacyId) {
 return withMongoTransaction(async ({ db, session }) => {
    const uqpColl = db.collection('userQuestionProgress');
    const utpColl = db.collection('userTopicProgress');

    const now = new Date();

    const existingDoc = await uqpColl.findOne({ userId: String(userId), questionUid }, { session });

    let isFirstTime = false;
    let becameMastered = false;

    if (!existingDoc) {
       isFirstTime = true;
       await uqpColl.insertOne({
         userId: String(userId),
         questionUid,
         questionId: legacyId,
         topic,
         firstAttemptedAt: now,
         lastAttemptedAt: now,
         isCorrect,
         attempts: 1,
         everCorrect: isCorrect
       }, { session });
       becameMastered = isCorrect;
    } else {
       const updateFields = { $set: { lastAttemptedAt: now }, $inc: { attempts: 1 } };
       if (isCorrect && !existingDoc.everCorrect) {
          updateFields.$set.everCorrect = true;
          becameMastered = true;
       }
       await uqpColl.updateOne({ _id: existingDoc._id }, updateFields, { session });
    }

    // If state changed, update topic progress
    if (isFirstTime || becameMastered) {
       const inc = {};
       if (isFirstTime) inc.solvedCount = 1;
       if (becameMastered) inc.masteredCount = 1;

       await utpColl.updateOne(
         { userId: String(userId), topic },
         {
           $inc: inc,
           $set: { lastActivityAt: now }
         },
         { upsert: true, session }
       );
       await advanceTopicProgressRevision(userId, { db, session });
    }

    return {
      isCorrect,
      isFirstTime,
      becameMastered
    };
  });
}

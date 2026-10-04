import { getMongoDB, getQuestionsCollection, withMongoTransaction } from '../config/mongodb.js';
import { trainingQuestionMetadata } from '../services/training/domain/questionMetadata.js';
export const listPendingTrainingVariants = () => getMongoDB().collection('trainingQuestionVariants').find({ validationStatus: 'pending_review' }).sort({ createdAt: -1 }).limit(50).toArray();
export const findTrainingSeed = seedId => getQuestionsCollection().findOne({ id: seedId });
export const insertTrainingVariant = (draft, userId) => getMongoDB().collection('trainingQuestionVariants').insertOne({ ...draft, createdBy: String(userId) });
export async function reviewTrainingVariant(id, userId, review) {
 let output;
 await withMongoTransaction(async ({ db, session }) => {
      const drafts = db.collection("trainingQuestionVariants");
      const draft = await drafts.findOne({ id: id }, { session });
      if (!draft)
        throw Object.assign(new Error("Variant not found"), {
          statusCode: 404,
        });
      if (draft.validationStatus !== "pending_review") {
        output = { id: draft.id, status: draft.validationStatus };
        return;
      }
      if (review.decision === "approve") {
        if (
          review.verifiedAnswer === undefined ||
          review.verifiedAnswer >= draft.options.length
        )
          throw Object.assign(
            new Error("Select the independently verified answer index"),
            { statusCode: 400 },
          );
        const { _id, createdBy, ...question } = draft;
        await db
          .collection("questions")
          .insertOne(
            {
              ...question,
              ...trainingQuestionMetadata({ ...question, correctAnswer: review.verifiedAnswer, validationStatus: 'validated' }),
              correctAnswer: review.verifiedAnswer,
              validationStatus: "validated",
              validatedBy: String(userId),
              validatedAt: new Date(),
              updatedAt: new Date(),
              verificationNotes: review.verificationNotes,
            },
            { session },
          );
      }
      const status =
        review.decision === "approve" ? "validated" : "rejected";
      await drafts.updateOne(
        { _id: draft._id },
        {
          $set: {
            validationStatus: status,
            reviewedBy: String(userId),
            reviewedAt: new Date(),
            verificationNotes: review.verificationNotes,
          },
        },
        { session },
      );
      output = { id: draft.id, status };
    });
 return output;
}

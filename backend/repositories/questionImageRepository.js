import { resolveQuestion } from '../services/questions/questionIdentity.js';


import { getQuestionsCollection } from "../config/mongodb.js";

export function mergeQuestionContent(
  existingQuestion,
  questionImage
) {
  const imageMarkdown =
    `![question](${questionImage})`;

  const textOnly = String(
    existingQuestion || ""
  )
    .replace(
      /\s*!\[[^\]]*\]\([^)]+\)\s*/g,
      "\n\n"
    )
    .trim();

  if (!textOnly) {
    return imageMarkdown;
  }

  return `${textOnly}\n\n${imageMarkdown}`;
}

export async function patchQuestionImage(
  questionId,
  questionImage,
  questionImageKey
) {
  const questions =
    getQuestionsCollection();

  const doc = await resolveQuestion(questions, questionId);

  if (!doc) {
    throw new Error(
      `Question "${questionId}" not found in MongoDB`
    );
  }

  const question =
    mergeQuestionContent(
      doc.question,
      questionImage
    );

  await questions.updateOne(
    {
      _id: doc._id,
    },
    {
      $set: {
        questionImage,
        questionImageKey,
        question,
        updatedAt:
          new Date().toISOString(),
      },
    }
  );

  return {
    ...doc,
    questionImage,
    questionImageKey,
    question,
  };
}

export function mergeSolutionContent(
  existingSolution,
  solutionImage
) {
  const imageMarkdown =
    `![solution](${solutionImage})`;

  const textOnly = String(
    existingSolution || ""
  )
    .replace(
      /\s*!\[[^\]]*\]\([^)]+\)\s*/g,
      "\n\n"
    )
    .trim();

  if (!textOnly) {
    return imageMarkdown;
  }

  return (
    `${textOnly}\n\n${imageMarkdown}`
  );
}
export async function patchSolutionImage(
  questionId,
  solutionImage,
  solutionImageKey,
  dimensions = {}
) {
  const questions =
    getQuestionsCollection();

  const doc =
    await resolveQuestion(questions, questionId);

  if (!doc) {
    throw new Error(
      `Question "${questionId}" not found in MongoDB`
    );
  }

  const solution =
    mergeSolutionContent(
      doc.solution,
      solutionImage
    );

  await questions.updateOne(
    {
      _id: doc._id,
    },
    {
      $set: {
        ...dimensions,
        solutionImage,
        solutionImageKey,
        solution,

        updatedAt:
          new Date()
            .toISOString(),
      },
    }
  );

  return {
    ...doc,
    solutionImage,
    solutionImageKey,
    solution,
  };
}
export const findQuestionForSolution = questionId => resolveQuestion(getQuestionsCollection(), questionId);

import { getMongoDB } from '../config/mongodb.js';
const metadata = () => getMongoDB().collection('questionMetadata');
export const advanceQuestionRevision = () => metadata().updateOne({ _id: 'revision' }, { $inc: { revision: 1 } }, { upsert: true });
export const readQuestionRevision = () => metadata().findOne({ _id: 'revision' }, { projection: { revision: 1 }, timeoutMS: 300 });
export const findPersistedQuestionMetadata = key => metadata().findOne({ _id: key });
export const savePersistedQuestionMetadata = (key, revision, data, params) => metadata().updateOne({ _id: key }, {
  $set: { revision, data, params: { topic: params.topic, subject: params.subject, mode: params.mode }, updatedAt: new Date() },
}, { upsert: true });
export const saveTopicCountSnapshot = snapshot => metadata().updateOne({ _id: snapshot._id }, [{ $replaceWith: {
  $cond: [{ $gt: [{ $ifNull: ['$revision', -1] }, snapshot.revision] }, '$$ROOT', { $literal: snapshot }],
} }], { upsert: true });

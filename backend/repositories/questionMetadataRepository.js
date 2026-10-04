// @ts-check
import { getMongoDB, getQuestionsCollection } from '../config/mongodb.js';

/** @typedef {import('mongodb').Document & { _id: string, revision?: number }} MetadataDocument */
/** @returns {import('mongodb').Collection<MetadataDocument>} */
const metadata = () => getMongoDB().collection('questionMetadata');
export const advanceQuestionRevision = () => metadata().updateOne({ _id: 'revision' }, { $inc: { revision: 1 } }, { upsert: true });
export const readQuestionRevision = () => metadata().findOne({ _id: 'revision' }, { projection: { revision: 1 }, timeoutMS: 300 });
/** @param {string} key */
export const findPersistedQuestionMetadata = key => metadata().findOne({ _id: key });
/** @param {string} key @param {number} revision @param {unknown} data @param {{ topic?: string, subject?: string, mode?: string }} params */
export const savePersistedQuestionMetadata = (key, revision, data, params) => metadata().updateOne({ _id: key }, {
  $set: { revision, data, params: { topic: params.topic, subject: params.subject, mode: params.mode }, updatedAt: new Date() },
}, { upsert: true });
/** @param {MetadataDocument & { revision: number }} snapshot */
export const saveTopicCountSnapshot = snapshot => metadata().updateOne({ _id: snapshot._id }, [{ $replaceWith: {
  $cond: [{ $gt: [{ $ifNull: ['$revision', -1] }, snapshot.revision] }, '$$ROOT', { $literal: snapshot }],
} }], { upsert: true });

/** @param {import('mongodb').Document[]} pipeline */
export const aggregateQuestionModeCounts = pipeline => getQuestionsCollection().aggregate(pipeline, { maxTimeMS: 10000 }).toArray();
/** @param {import('mongodb').Document[]} pipeline */
export const aggregateQuestionFacets = pipeline => getQuestionsCollection().aggregate(pipeline, { maxTimeMS: 10000 }).toArray();
export const findMetadataScopes = () => getMongoDB().collection('questionMetadata').find({ params: { $exists: true } }, { projection: { params: 1 } }).toArray();

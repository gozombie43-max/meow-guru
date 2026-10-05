import { getNotesCollection } from '../config/mongodb.js';
import { readKeysetPage } from '../infrastructure/keysetPage.js';
const summary = { id: 1, title: 1, topic: 1, type: 1, thumbnail: 1, tags: 1, updatedAt: 1, createdAt: 1 };
export const listNotes = filter => getNotesCollection().find(filter, { projection: summary }).sort({ updatedAt: -1, _id: -1 }).limit(100).toArray();
export const listNotePage = (filter, pagination) => readKeysetPage(getNotesCollection(), { filter, scope: 'notes', field: 'updatedAt', projection: summary, ...pagination });
export const findNoteById = (id, internal = false) => getNotesCollection().findOne({ id: String(id) }, internal ? {} : { projection: { _id: 0, _cosmosRid: 0 } });
export const insertNote = note => getNotesCollection().insertOne({ ...note, createdAt: new Date(note.createdAt || Date.now()), updatedAt: new Date(note.updatedAt || Date.now()) });
export const patchNoteDocument = (id, fields) => getNotesCollection().updateOne({ _id: id }, { $set: { ...fields, updatedAt: new Date() } });
export const deleteNoteById = id => getNotesCollection().deleteOne({ id: String(id) });

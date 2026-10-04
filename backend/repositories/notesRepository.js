import { getNotesCollection } from '../config/mongodb.js';
export const listNotes = filter => getNotesCollection().find(filter, { projection: { _id: 0, _cosmosRid: 0 } }).sort({ updatedAt: -1, createdAt: -1, _ts: -1 }).toArray();
export const findNoteById = (id, internal = false) => getNotesCollection().findOne({ id: String(id) }, internal ? {} : { projection: { _id: 0, _cosmosRid: 0 } });
export const insertNote = note => getNotesCollection().insertOne(note);
export const patchNoteDocument = (id, fields) => getNotesCollection().updateOne({ _id: id }, { $set: fields });
export const deleteNoteById = id => getNotesCollection().deleteOne({ id: String(id) });

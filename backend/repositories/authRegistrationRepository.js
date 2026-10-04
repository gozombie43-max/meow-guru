import { getUsersCollection, getMongoDB } from '../config/mongodb.js';
export function findUserByEmail(email) {
  return getUsersCollection().findOne({ email: String(email).trim().toLowerCase(), type: { $ne: 'email_lock' } });
}
export function acquireRegistrationLock(email) {
  return getMongoDB().collection('registrationLocks').insertOne({ _id: email, createdAt: new Date() });
}
export function releaseRegistrationLock(email) {
  return getMongoDB().collection('registrationLocks').deleteOne({ _id: email });
}
export function insertRegisteredUser(user) { return getUsersCollection().insertOne(user); }

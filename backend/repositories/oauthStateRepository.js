import { getMongoDB } from '../config/mongodb.js';

export async function saveOAuthState(hash, expiresAt) {
  await getMongoDB().collection('oauthStates').insertOne({ _id: hash, expiresAt });
}

export async function consumeOAuthState(hash, now = new Date()) {
  return Boolean(await getMongoDB().collection('oauthStates').findOneAndDelete({
    _id: hash, expiresAt: { $gt: now },
  }));
}

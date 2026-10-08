import { getMongoDB, withMongoTransaction } from '../config/mongodb.js';
import { mutateUserList } from './userRepository.js';
import { appendChatMessages, chatSummary } from '../services/userHistory.js';

const missingOwner = () => Object.assign(new Error('User not found'), { statusCode: 404 });
const storageChanged = () => Object.assign(new Error('History storage changed; retry'), { statusCode: 409 });
const conflict = () => Object.assign(new Error('Chat sequence conflict'), { statusCode: 409 });
const clean = ({ _id, userId, messagePositionVersion, ...row }) => row;

async function readOwner(userId, chatId, summaries = false) {
  // Legacy histories also avoid transferring unselected message bodies.
  const count = { $size: { $cond: [{ $isArray: '$$chat.messages' }, '$$chat.messages', []] } };
  const chats = summaries ? { $map: { input: { $ifNull: ['$aiChats', []] }, as: 'chat', in: {
    id: '$$chat.id', title: '$$chat.title', updatedAt: '$$chat.updatedAt', messageCount: count,
    revision: { $ifNull: ['$$chat.revision', count] },
  } } } : { $filter: { input: { $ifNull: ['$aiChats', []] }, as: 'chat', cond: { $eq: ['$$chat.id', chatId] } } };
  return getMongoDB().collection('users').aggregate([
    { $match: { id: String(userId), type: { $ne: 'email_lock' } } },
    { $project: { id: 1, historyStorageVersion: 1,
      aiChats: { $cond: [{ $eq: ['$historyStorageVersion', 1] }, '$$REMOVE', chats] } } },
  ]).next();
}

export async function listAiChatSummaries(userId) {
  const owner = await readOwner(userId, undefined, true);
  if (!owner) throw missingOwner();
  const rows = owner.historyStorageVersion === 1
    ? await getMongoDB().collection('aiConversations').find({ userId: String(userId) },
      { projection: { _id: 0, id: 1, title: 1, updatedAt: 1, revision: 1, messageCount: 1 } })
      .sort({ updatedAt: -1, _id: -1 }).limit(30).toArray()
    : (owner.aiChats || []).filter(chat => chat?.id).sort((a, b) => (Date.parse(b.updatedAt) || 0) - (Date.parse(a.updatedAt) || 0)).slice(0, 30);
  return rows.map(chatSummary);
}

async function transactionOwner(db, session, userId) {
  const owner = await db.collection('users').findOne({ id: String(userId), type: { $ne: 'email_lock' } },
    { session, projection: { historyStorageVersion: 1 } });
  if (!owner) throw missingOwner();
  if (owner.historyStorageVersion !== 1) throw storageChanged();
  return owner;
}

export async function readAiChat(userId, chatId) {
  const owner = await readOwner(userId, chatId);
  if (!owner) throw missingOwner();
  if (owner.historyStorageVersion !== 1) return owner.aiChats?.[0] ?? null;
  // Metadata and retained messages must represent the same append revision.
  return withMongoTransaction(async ({ db, session }) => {
    await transactionOwner(db, session, userId);
    const filter = { userId: String(userId), id: chatId };
    const chat = await db.collection('aiConversations').findOne(filter, { session });
    if (!chat) return null;
    const messages = await db.collection('aiMessages').find({ userId: String(userId), conversationId: chatId }, { session })
      .sort({ position: 1 }).limit(80).toArray();
    return { ...clean(chat), messages: messages.map(row => row.message), revision: chat.revision ?? messages.length };
  });
}

async function pruneChats(db, session, userId) {
  const excluded = await db.collection('aiConversations').find({ userId }, { session, projection: { id: 1 } })
    .sort({ updatedAt: -1, _id: -1 }).skip(30).toArray();
  if (!excluded.length) return;
  const ids = excluded.map(row => row.id);
  await db.collection('aiConversations').deleteMany({ userId, id: { $in: ids } }, { session });
  await db.collection('aiMessages').deleteMany({ userId, conversationId: { $in: ids } }, { session });
}

export async function appendAiChatMessages(userId, chatId, payload) {
  const owner = await getMongoDB().collection('users').findOne({ id: String(userId), type: { $ne: 'email_lock' } },
    { projection: { historyStorageVersion: 1 } });
  if (!owner) throw missingOwner();
  if (owner.historyStorageVersion !== 1) {
    let revision;
    const result = await mutateUserList(userId, 'aiChats', chats => {
      const next = appendChatMessages(chats, chatId, payload);
      revision = next.revision;
      return next.chats;
    });
    if (!result) throw missingOwner();
    return revision;
  }
  userId = String(userId);
  return withMongoTransaction(async ({ db, session }) => {
    const user = await transactionOwner(db, session, userId);
    const conversations = db.collection('aiConversations'), messages = db.collection('aiMessages');
    const filter = { userId, id: chatId }, messageFilter = { userId, conversationId: chatId };
    const previous = await conversations.findOne(filter, { session });
    const revision = previous?.revision ?? previous?.messageCount ?? 0;
    const count = previous?.messageCount ?? 0, first = revision - count, offset = payload.sequence - 1;
    if (offset < revision) {
      if (offset < first || offset + payload.messages.length > revision) throw conflict();
      const position = previous.messagePositionVersion === 1 ? offset : offset - first;
      const saved = await messages.find({ ...messageFilter, position: { $gte: position, $lt: position + payload.messages.length } }, { session })
        .sort({ position: 1 }).toArray();
      if (saved.length !== payload.messages.length || saved.some((row, i) => row.message.role !== payload.messages[i].role || row.message.content !== payload.messages[i].content)) throw conflict();
      return revision;
    }
    if (offset !== revision) throw conflict();
    // Earlier separated writes numbered the retained window from zero. Upgrade
    // positions in place once; subsequent appends insert only their new rows.
    if (previous && previous.messagePositionVersion !== 1 && first !== 0) {
      // A temporary negative range avoids collisions on the unique position index.
      await messages.updateMany(messageFilter, [{ $set: { position: { $subtract: [-1, '$position'] } } }], { session });
      await messages.updateMany(messageFilter, [{ $set: { position: { $subtract: [first - 1, '$position'] } } }], { session });
    }
    const nextRevision = revision + payload.messages.length;
    await messages.insertMany(payload.messages.map((message, i) => ({ ...messageFilter, position: revision + i, message })), { session });
    await messages.deleteMany({ ...messageFilter, position: { $lt: nextRevision - 80 } }, { session });
    await conversations.updateOne(filter, { $set: { ...filter, title: previous?.title || payload.title || 'New chat',
      revision: nextRevision, messageCount: Math.min(80, count + payload.messages.length),
      messagePositionVersion: 1, updatedAt: new Date().toISOString() } }, { session, upsert: true });
    await pruneChats(db, session, userId);
    const fence = await db.collection('users').updateOne({ _id: user._id, historyStorageVersion: 1 }, { $inc: { aiChatsRevision: 1 } }, { session });
    if (!fence.matchedCount) throw storageChanged();
    return nextRevision;
  });
}

// PUT intentionally replaces this conversation; DELETE never reads its messages.
export async function writeAiChat(userId, chatId, entry) {
  const owner = await getMongoDB().collection('users').findOne({ id: String(userId), type: { $ne: 'email_lock' } },
    { projection: { historyStorageVersion: 1 } });
  if (!owner) throw missingOwner();
  if (owner.historyStorageVersion !== 1) {
    const result = await mutateUserList(userId, 'aiChats', chats => entry
      ? [entry, ...chats.filter(chat => chat?.id && chat.id !== chatId && Array.isArray(chat.messages))].slice(0, 30)
      : chats.filter(chat => chat?.id && chat.id !== chatId).slice(0, 30));
    if (!result) throw missingOwner();
    return;
  }
  userId = String(userId);
  await withMongoTransaction(async ({ db, session }) => {
    const user = await transactionOwner(db, session, userId);
    const filter = { userId, id: chatId }, messageFilter = { userId, conversationId: chatId };
    await db.collection('aiMessages').deleteMany(messageFilter, { session });
    if (entry) {
      const { messages, ...metadata } = entry;
      await db.collection('aiConversations').replaceOne(filter, { ...metadata, userId,
        messageCount: messages.length, messagePositionVersion: 1 }, { session, upsert: true });
      if (messages.length) await db.collection('aiMessages').insertMany(messages.map((message, position) => ({ ...messageFilter, position, message })), { session });
      await pruneChats(db, session, userId);
    } else await db.collection('aiConversations').deleteOne(filter, { session });
    const fence = await db.collection('users').updateOne({ _id: user._id, historyStorageVersion: 1 }, { $inc: { aiChatsRevision: 1 } }, { session });
    if (!fence.matchedCount) throw storageChanged();
  });
}

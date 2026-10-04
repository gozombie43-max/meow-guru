import { getAccessCodesCollection } from '../config/mongodb.js';
export const findActiveAccessCode = code => getAccessCodesCollection().findOne({ code, active: true });
export const consumeAccessCode = (id, currentUsed, maxUses) => getAccessCodesCollection().updateOne(
  { _id: id, active: true, ...(maxUses > 0 ? { usedCount: currentUsed } : {}) }, { $inc: { usedCount: 1 } },
);

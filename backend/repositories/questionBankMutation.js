export const advanceQuestionBankRevision = db => db.collection('questionMetadata').updateOne(
  { _id: 'revision' }, { $inc: { revision: 1 } }, { upsert: true },
);

// Unordered imports can partially succeed before throwing. Retire cached
// generations in finally as well as after a fully successful mutation.
export async function mutateQuestionBank(db, mutation) {
  try { return await mutation(); }
  finally { await advanceQuestionBankRevision(db); }
}

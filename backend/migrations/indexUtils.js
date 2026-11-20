export function sameKeySpec(a, b) {
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false;
  const entriesA = Object.entries(a);
  const entriesB = Object.entries(b);
  if (entriesA.length !== entriesB.length) return false;
  return entriesA.every(([k, v], idx) => entriesB[idx][0] === k && entriesB[idx][1] === v);
}

function canonicalEqual(a, b) {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (a instanceof Date || b instanceof Date) {
    return a instanceof Date && b instanceof Date && a.getTime() === b.getTime();
  }
  if (a instanceof RegExp || b instanceof RegExp) {
    return a instanceof RegExp && b instanceof RegExp && a.source === b.source && a.flags === b.flags;
  }
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((item, idx) => canonicalEqual(item, b[idx]));
  }
  if (typeof a === 'object') {
    const keysA = Object.keys(a).sort();
    const keysB = Object.keys(b).sort();
    if (keysA.length !== keysB.length) return false;
    return keysA.every((key, idx) => key === keysB[idx] && canonicalEqual(a[key], b[key]));
  }
  return false;
}

function normalizeCollation(collation) {
  if (!collation || typeof collation !== 'object') return null;
  const locale = collation.locale || 'simple';
  if (
    locale === 'simple'
    && !collation.numericOrdering
    && (collation.strength === undefined || collation.strength === 3)
    && !collation.caseLevel
    && (!collation.caseFirst || collation.caseFirst === 'off')
  ) {
    return null;
  }
  return {
    locale,
    numericOrdering: Boolean(collation.numericOrdering),
    strength: collation.strength ?? 3,
    caseLevel: Boolean(collation.caseLevel),
    caseFirst: collation.caseFirst ?? 'off',
  };
}

export function sameSemanticOptions(existingIndex, desiredOptions = {}) {
  if (!existingIndex || typeof existingIndex !== 'object') return false;
  const desired = desiredOptions && typeof desiredOptions === 'object' ? desiredOptions : {};

  if (Boolean(existingIndex.unique) !== Boolean(desired.unique)) return false;
  if (Boolean(existingIndex.sparse) !== Boolean(desired.sparse)) return false;

  const existingTtl = typeof existingIndex.expireAfterSeconds === 'number' ? existingIndex.expireAfterSeconds : undefined;
  const desiredTtl = typeof desired.expireAfterSeconds === 'number' ? desired.expireAfterSeconds : undefined;
  if (existingTtl !== desiredTtl) return false;

  const existingPartial = existingIndex.partialFilterExpression ?? null;
  const desiredPartial = desired.partialFilterExpression ?? null;
  if (!canonicalEqual(existingPartial, desiredPartial)) return false;

  if (!canonicalEqual(normalizeCollation(existingIndex.collation), normalizeCollation(desired.collation))) {
    return false;
  }

  return true;
}

export async function listIndexesSafe(collection) {
  if (typeof collection?.listIndexes !== 'function') return [];
  try {
    return await collection.listIndexes().toArray();
  } catch (error) {
    if (error?.code === 26 || /ns does not exist/i.test(error?.message || '')) return [];
    throw error;
  }
}

function isIndexConflictError(error) {
  return (
    error?.code === 85
    || error?.code === 86
    || /IndexOptionsConflict|IndexKeySpecsConflict|already exists/i.test(error?.message || '')
  );
}

/**
 * Ensures an index with `key` exists on `collection` without failing on MongoDB
 * code 85 (`IndexOptionsConflict`) or code 86 (`IndexKeySpecsConflict`) when an
 * equivalent index already exists under a different name (e.g. legacy default-named
 * indexes created by standalone scripts on production Atlas).
 */
export async function ensureIndex(collection, key, options = {}) {
  const opts = options && typeof options === 'object' ? options : {};
  const existing = await listIndexesSafe(collection);
  const collectionName = collection?.collectionName || 'unknown';

  const byKey = existing.find(index => sameKeySpec(index.key, key));
  if (byKey) {
    if (!sameSemanticOptions(byKey, opts)) {
      console.warn(
        `[migrations] Keeping existing index "${byKey.name}" on "${collectionName}" with matching key ${JSON.stringify(key)} despite differing options (requested ${JSON.stringify(opts)})`,
      );
    }
    return byKey.name;
  }

  let createOptions = opts;
  if (opts.name && existing.some(index => index.name === opts.name)) {
    console.warn(
      `[migrations] Index name "${opts.name}" already exists on "${collectionName}" with a different key spec; creating index ${JSON.stringify(key)} with default name`,
    );
    createOptions = { ...opts };
    delete createOptions.name;
  }

  try {
    return await collection.createIndex(key, createOptions);
  } catch (error) {
    if (isIndexConflictError(error)) {
      const refreshed = await listIndexesSafe(collection);
      const matched = refreshed.find(index => sameKeySpec(index.key, key));
      if (matched) {
        if (!sameSemanticOptions(matched, opts)) {
          console.warn(
            `[migrations] Keeping conflicting index "${matched.name}" on "${collectionName}" with matching key ${JSON.stringify(key)}`,
          );
        }
        return matched.name;
      }
      console.warn(
        `[migrations] Ignored index conflict (code ${error?.code ?? 'unknown'}) on "${collectionName}" for ${JSON.stringify(key)}: ${error?.message || error}`,
      );
      return opts.name || null;
    }
    throw error;
  }
}

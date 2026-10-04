const { isAbsolute, parse } = require('node:path');
const { globSync: matchDirectories } = require('tinyglobby');

// Next 16.3.6 uses only globSync(string, { onlyDirectories: true }).
// Reject other callers instead of pretending to implement all of fast-glob.
exports.globSync = (pattern, options) => {
  if (typeof pattern !== 'string' || options?.onlyDirectories !== true) {
    throw new TypeError('Next lint glob supports synchronous directory patterns only');
  }
  return matchDirectories(pattern, {
    ...options,
    expandDirectories: false,
    absolute: isAbsolute(pattern),
  }).map((directory) => {
    const root = parse(directory).root.replace(/\\/g, '/');
    return directory === root ? directory : directory.replace(/\/+$/, '');
  });
};

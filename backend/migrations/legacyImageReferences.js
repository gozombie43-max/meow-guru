// Match relative legacy URLs without rewriting matching paths on another host.
const relativeImage = /(?<![A-Za-z0-9:/\]])\/uploads\/([A-Za-z0-9._-]+)/g;

export function legacyImageFilenames(value) {
  return [...value.matchAll(relativeImage)].map(match => match[1]);
}

export function replaceLegacyImages(value, migrated) {
  return value.replace(relativeImage, (reference, filename) => migrated.get(filename) || reference);
}

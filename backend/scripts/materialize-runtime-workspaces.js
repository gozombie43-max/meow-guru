import { cpSync, lstatSync, realpathSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Azure ZIP deployment does not reliably preserve npm workspace symlinks.
// Run only in the release build after npm ci, before packaging the artifact.
const source = fileURLToPath(new URL('../../contracts/', import.meta.url));
const destination = fileURLToPath(new URL('../../node_modules/@meow/contracts', import.meta.url));
if (lstatSync(destination).isSymbolicLink()) {
  if (realpathSync(destination) !== realpathSync(source)) {
    throw new Error('Unexpected @meow/contracts workspace link target');
  }
  unlinkSync(destination);
  cpSync(source, destination, { recursive: true, dereference: true });
} else if (!lstatSync(destination).isDirectory()) {
  throw new Error('@meow/contracts must be a package directory');
}
console.log('Shared runtime contracts are packaged as real files.');

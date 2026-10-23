// Copies the shared modules, the data file and the content licence into
// ./vendor so the published package works without the rest of the repository.
// Runs automatically before `npm pack` and `npm publish`; with --clean (after
// packing) it removes them again, so development always uses ../tools.

import { cpSync, mkdirSync, rmSync } from 'node:fs';

const root = new URL('../../', import.meta.url);
const vendor = new URL('../vendor/', import.meta.url);

rmSync(vendor, { recursive: true, force: true });
if (process.argv.includes('--clean')) process.exit(0);
mkdirSync(vendor);
for (const file of ['tools/romanise.mjs', 'tools/library.mjs', 'tools/tool-definitions.mjs', 'dist/cantonlink-community.json', 'dist/schema.json', 'LICENSE-CONTENT']) {
  cpSync(new URL(file, root), new URL(file.split('/').pop(), vendor));
}
console.error('Vendored the shared modules and data into vendor/');

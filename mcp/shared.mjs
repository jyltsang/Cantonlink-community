// Finds the shared library modules and data: in the repository they live in
// ../tools and ../dist; the published package carries copies in ./vendor
// (made by scripts/vendor.mjs before packing).

import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const VENDOR = new URL('./vendor/', import.meta.url);
export const bundled = existsSync(VENDOR);
const shared = bundled ? VENDOR : new URL('../tools/', import.meta.url);

export const library = await import(new URL('library.mjs', shared));
export const { TOOLS } = await import(new URL('tool-definitions.mjs', shared));

export const VERSION = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).version;

export function loadLibrary(path = bundled ? new URL('cantonlink-community.json', VENDOR) : new URL('../dist/cantonlink-community.json', import.meta.url)) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

// True when this module's file was started directly, including through the
// symlink npm creates for a command in node_modules/.bin.
export const isMain = (moduleUrl) => Boolean(process.argv[1]) && moduleUrl === pathToFileURL(realpathSync(process.argv[1])).href;

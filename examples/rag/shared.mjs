// Paths and loading shared by the example's commands.

import { existsSync, readFileSync } from 'node:fs';

export const INDEX = new URL('./index.json', import.meta.url);

export const loadData = () => JSON.parse(readFileSync(new URL('../../dist/cantonlink-community.json', import.meta.url), 'utf8'));

export function loadIndex() {
  if (!existsSync(INDEX)) throw new Error('No index yet. Run "npm run build-index" first.');
  return JSON.parse(readFileSync(INDEX, 'utf8'));
}

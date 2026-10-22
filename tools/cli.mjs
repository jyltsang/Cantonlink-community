#!/usr/bin/env node
import { romanise } from './romanise.mjs';

const input = process.argv.slice(2).join(' ').trim();
if (!input) {
  console.error('Usage: node tools/cli.mjs "nei5 hou2"');
  process.exit(1);
}

try {
  const { jyutping, yale, bopomofo } = romanise(input);
  console.log(`Jyutping  ${jyutping}\nYale      ${yale}\nBopomofo  ${bopomofo}`);
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

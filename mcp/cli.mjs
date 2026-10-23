#!/usr/bin/env node
// Learn Cantonese in the terminal with the CantonLink Community library:
//   cantonlink word [english | jyutping | 漢字]   look a word up (no query: word of the day)
//   cantonlink quiz [--level A1] [--count 5]      fill-the-gap quiz, answered by number
//   cantonlink romanise "nei5 hou2"               Jyutping to Yale and Bopomofo

import { createInterface } from 'node:readline';
import { parseArgs } from 'node:util';
import { library, VERSION, loadLibrary, isMain } from './shared.mjs';

const { LEVELS, searchVocabulary, formatWord, convertJyutping, findPattern } = library;
const SITE = 'https://jyltsang.github.io/Cantonlink-community/';

const HELP = `cantonlink ${VERSION} — learn spoken Hong Kong Cantonese in the terminal

Usage:
  cantonlink word [query]              Look up a word by English, Jyutping or characters.
                                       With no query, show the word of the day.
  cantonlink quiz [options]            Fill-the-gap grammar quiz.
      --level A1|A2|B1                 Only questions at this level
      --count N                        Number of questions (default 5)
      --system jyutping|yale|bopomofo  Romanisation to show (default jyutping)
  cantonlink romanise "nei5 hou2"      Convert Jyutping to Yale and Bopomofo.
  cantonlink --version | --help

Lessons and practice in your browser: ${SITE}`;

function colours(stream) {
  const on = stream.isTTY && !process.env.NO_COLOR;
  const wrap = (code) => (text) => (on ? `\x1b[${code}m${text}\x1b[0m` : String(text));
  return { bold: wrap(1), dim: wrap(2), green: wrap(32), red: wrap(31) };
}

function shuffle(items) {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// Reads answers one line at a time, from a terminal or from a pipe.
function lineReader(input, output) {
  const rl = createInterface({ input, output, terminal: false });
  const lines = rl[Symbol.asyncIterator]();
  return {
    ask: async (prompt) => {
      output.write(prompt);
      const { value, done } = await lines.next();
      if (!input.isTTY) output.write(`${value ?? ''}\n`);
      return done ? null : value.trim();
    },
    close: () => rl.close(),
  };
}

export function wordCommand(data, query, { out, c, today = new Date() }) {
  if (!query) {
    const words = data.vocabulary.flatMap((t) => t.words.map((w) => ({ ...w, topicTitle: t.title })));
    const day = Math.floor(today.getTime() / 86_400_000);
    out.write(`${c.bold('Word of the day')}\n${formatWord(words[day % words.length])}\n`);
    return 0;
  }
  const found = searchVocabulary(data, query, 5);
  if (!found.length) {
    out.write(`No word found for "${query}". Try English ("thank you"), Jyutping ("m4 goi1") or characters (唔該).\n`);
    return 1;
  }
  out.write(`${found.map(formatWord).join('\n\n')}\n`);
  return 0;
}

export function romaniseCommand(text, { out, err }) {
  const result = convertJyutping(text);
  if (!result.jyutping) {
    err.write(result.invalid?.length
      ? `Not valid Jyutping: ${result.invalid.join(', ')}. Each syllable needs a tone number 1–6, e.g. "nei5 hou2".\n`
      : 'Give some Jyutping to convert, e.g. cantonlink romanise "nei5 hou2"\n');
    return 1;
  }
  out.write(`Jyutping  ${result.jyutping}\nYale      ${result.yale}\nBopomofo  ${result.bopomofo}\n`);
  return 0;
}

export async function quizCommand(data, { level, count = 5, system = 'jyutping' }, { input, out, c }) {
  const pool = data.practice.fillGap.filter((q) => !level || q.level === level);
  const questions = shuffle(pool).slice(0, count);
  const reader = lineReader(input, out);
  const roman = (token) => token.punctuation ?? token[system];
  let score = 0;
  let asked = 0;

  out.write(`${c.bold(`Fill the gap · ${level ?? 'all levels'} · ${questions.length} questions`)}\nAnswer with the option number. Press Enter on an empty line to stop.\n`);
  for (const [n, q] of questions.entries()) {
    const options = shuffle(q.options);
    const line = q.tokens.map((t, i) => (i === q.gapIndex ? '___' : roman(t))).join(' ').replace(/ ([.,?!])/g, '$1');
    const chars = q.tokens.map((t, i) => (i === q.gapIndex ? '＿＿' : t.cjk)).join('');
    out.write(`\n${c.dim(`${n + 1}/${questions.length}`)}  "${q.en}"\n    ${c.bold(line)}\n    ${chars}\n`);
    options.forEach((o, i) => out.write(`    ${i + 1}. ${o[system]}  ${o.cjk}\n`));
    const reply = await reader.ask('  > ');
    if (!reply) break;
    asked++;
    const choice = options[Number(reply) - 1];
    const right = q.options[0];
    const pattern = findPattern(data, q.patternId);
    if (choice === right) {
      score++;
      out.write(`  ${c.green('Correct.')} ${pattern.pattern}: ${pattern.meaning}\n`);
    } else {
      out.write(`  ${c.red('Not quite.')} The answer is ${right[system]} ${right.cjk}. ${pattern.pattern}: ${pattern.meaning}\n  ${c.dim(`${SITE}#/grammar/${pattern.id}`)}\n`);
    }
  }
  reader.close();
  out.write(`\n${c.bold(`Score: ${score} / ${asked}`)}${asked ? '' : ' (no answers)'}\n`);
  return 0;
}

export async function main(argv = process.argv.slice(2), io = { input: process.stdin, out: process.stdout, err: process.stderr }) {
  const c = colours(io.out);
  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        level: { type: 'string' }, count: { type: 'string' }, system: { type: 'string' },
        help: { type: 'boolean', short: 'h' }, version: { type: 'boolean', short: 'v' },
      },
    });
  } catch (error) {
    io.err.write(`${error.message}\n\n${HELP}\n`);
    return 2;
  }
  const { values, positionals: [command, ...rest] } = parsed;
  const fail = (message) => {
    io.err.write(`${message}\n`);
    return 2;
  };
  if (values.version) {
    io.out.write(`${VERSION}\n`);
    return 0;
  }
  if (values.help || !command || command === 'help') {
    io.out.write(`${HELP}\n`);
    return 0;
  }

  const data = loadLibrary();
  if (command === 'word') return wordCommand(data, rest.join(' ').trim(), { out: io.out, c });
  if (command === 'romanise' || command === 'romanize') return romaniseCommand(rest.join(' '), io);
  if (command === 'quiz') {
    const level = values.level?.toUpperCase();
    if (level && !LEVELS.includes(level)) return fail(`--level must be one of ${LEVELS.join(', ')}`);
    const count = values.count ? Number(values.count) : 5;
    if (!Number.isInteger(count) || count < 1) return fail('--count must be a whole number of at least 1');
    const system = values.system ?? 'jyutping';
    if (!['jyutping', 'yale', 'bopomofo'].includes(system)) return fail('--system must be jyutping, yale or bopomofo');
    return quizCommand(data, { level, count, system }, { ...io, c });
  }
  return fail(`Unknown command "${command}".\n\n${HELP}`);
}

if (isMain(import.meta.url)) process.exitCode = await main();

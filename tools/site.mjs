// Assembles the website into _site/ (site files, the romanisation module and
// the generated data), and with --serve previews it at http://localhost:8080.

import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, rmSync, readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, '_site');

rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
cpSync(join(ROOT, 'site'), OUT, { recursive: true });
// Shared modules are served as .js (the type every static host knows), so
// their relative imports are rewritten to match.
for (const name of ['romanise', 'library', 'tool-definitions']) {
  const source = readFileSync(join(ROOT, 'tools', `${name}.mjs`), 'utf8').replace(/from '\.\/([\w-]+)\.mjs'/g, "from './$1.js'");
  writeFileSync(join(OUT, `${name}.js`), source);
}
cpSync(join(ROOT, 'dist', 'cantonlink-community.json'), join(OUT, 'data.json'));

const hash = createHash('sha256');
for (const file of readdirSync(OUT).sort()) if (file !== 'sw.js') hash.update(readFileSync(join(OUT, file)));
const version = hash.digest('hex').slice(0, 12);
const swPath = join(OUT, 'sw.js');
writeFileSync(swPath, readFileSync(swPath, 'utf8').replace('__VERSION__', version));
console.log(`✓ Built _site/ (version ${version})`);

if (process.argv.includes('--serve')) {
  const TYPES = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json',
  };
  const port = Number(process.env.PORT ?? 8080);
  createServer((req, res) => {
    const path = normalize(decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    const file = join(OUT, path.endsWith('/') ? `${path}index.html` : path);
    if (!file.startsWith(OUT) || !existsSync(file)) {
      res.writeHead(404).end('Not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(readFileSync(file));
  }).listen(port, () => console.log(`Previewing at http://localhost:${port}`));
}

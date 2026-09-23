// @vexpay/node is published publicly and mirrored to an open-source repo, so it
// must never depend on the private workspace (`@vexpay/shared`, `@vexpay/db`,
// `@vexpay/api`, …). Fails on a private import in src/ or a private dependency.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PRIVATE = /^@vexpay\/(?!node$)/;
const problems = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.[cm]?tsx?$|\.[cm]?js$/.test(entry)) {
      const source = readFileSync(path, 'utf8');
      const specifiers = [...source.matchAll(/(?:from\s+|import\s*\(\s*|require\s*\(\s*)['"]([^'"]+)['"]/g)];
      for (const [, specifier] of specifiers) {
        if (PRIVATE.test(specifier)) problems.push(`${relative(root, path)} imports ${specifier}`);
      }
    }
  }
}

walk(join(root, 'src'));

const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
for (const field of ['dependencies', 'peerDependencies', 'optionalDependencies', 'devDependencies']) {
  for (const name of Object.keys(pkg[field] ?? {})) {
    if (PRIVATE.test(name)) problems.push(`package.json ${field} includes ${name}`);
  }
}

if (problems.length > 0) {
  console.error(`@vexpay/node must not depend on private workspace packages:\n  ${problems.join('\n  ')}`);
  process.exit(1);
}
console.log('No private workspace imports.');

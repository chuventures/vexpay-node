// Type-checks every ```ts block in README.md against the SDK source, so the
// published examples cannot drift from the real API.
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const readme = readFileSync(join(root, 'README.md'), 'utf8');
const blocks = [...readme.matchAll(/```ts\n([\s\S]*?)```/g)].map((match) => match[1]);
if (blocks.length === 0) {
  console.error('No ```ts blocks found in README.md');
  process.exit(1);
}

const dir = join(root, '.readme-check');
rmSync(dir, { recursive: true, force: true });
mkdirSync(dir, { recursive: true });

// Each block is its own module (top-level await, independent imports).
blocks.forEach((code, index) => {
  writeFileSync(join(dir, `example-${index + 1}.ts`), `${code}\nexport {};\n`);
});
writeFileSync(
  join(dir, 'tsconfig.json'),
  JSON.stringify(
    {
      compilerOptions: {
        target: 'ES2022',
        module: 'ESNext',
        moduleResolution: 'Bundler',
        lib: ['ES2022', 'DOM'],
        strict: true,
        noEmit: true,
        skipLibCheck: true,
        types: ['node'],
        typeRoots: [join(root, 'node_modules/@types')],
        paths: { '@vexpay/node': [join(root, 'src/index.ts')] },
      },
      include: ['*.ts'],
    },
    null,
    2,
  ),
);

try {
  execFileSync(join(root, 'node_modules/.bin/tsc'), ['-p', join(dir, 'tsconfig.json')], { stdio: 'inherit' });
  console.log(`README: ${blocks.length} TypeScript examples type-check.`);
} catch {
  console.error('README examples do not type-check (files kept in .readme-check/).');
  process.exit(1);
}
rmSync(dir, { recursive: true, force: true });

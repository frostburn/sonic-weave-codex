const {readFile, writeFile} = require('node:fs/promises');
const path = require('node:path');
const {pathToFileURL} = require('node:url');

async function minifyDistPrelude() {
  const root = globalThis.process.cwd();
  const preludePath = path.join(root, 'dist/stdlib/prelude.js');
  const minifierPath = path.join(root, 'dist/stdlib/prelude-minify.js');
  const preludeUrl = `${pathToFileURL(preludePath).href}?t=${Date.now()}`;
  const minifierUrl = `${pathToFileURL(minifierPath).href}?t=${Date.now()}`;
  const {PRELUDE_SOURCE, PRELUDE_VOLATILES} = await import(preludeUrl);
  const {minifyPrelude} = await import(minifierUrl);

  const minifiedSource = minifyPrelude(PRELUDE_SOURCE);
  const minifiedVolatiles = minifyPrelude(PRELUDE_VOLATILES);

  const fileContent = await readFile(preludePath, 'utf8');
  const replacedVolatiles = fileContent.replace(
    /export const PRELUDE_VOLATILES = `[\s\S]*?`;/,
    `export const PRELUDE_VOLATILES = ${JSON.stringify(minifiedVolatiles)};`,
  );
  const replaced = replacedVolatiles.replace(
    /export const PRELUDE_SOURCE = `[\s\S]*?`;/,
    `export const PRELUDE_SOURCE = ${JSON.stringify(minifiedSource)};`,
  );

  if (replaced === fileContent) {
    throw new Error(
      'Failed to replace prelude constants in dist/stdlib/prelude.js',
    );
  }

  await writeFile(preludePath, replaced);
}

void minifyDistPrelude();

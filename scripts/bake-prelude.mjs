import {readFileSync, writeFileSync} from 'node:fs';

const DIST_PRELUDE_PATH = new URL('../dist/stdlib/prelude.js', import.meta.url);

function bakePreludeSource(content, constantName) {
  const pattern = new RegExp(
    'export const ' +
      constantName +
      " = `([\\s\\S]*?)`\\s*\\n\\s*\\.replaceAll\\('riff', 'fn'\\)\\s*\\n\\s*\\.replaceAll\\('  ', ''\\)\\s*\\n\\s*\\.replaceAll\\('\\\\n', ''\\);"
  );

  return content.replace(pattern, (_, source) => {
    const minified = source
      .replaceAll('riff', 'fn')
      .replaceAll('  ', '')
      .replaceAll('\n', '');
    return `export const ${constantName} = ${JSON.stringify(minified)};`;
  });
}

const original = readFileSync(DIST_PRELUDE_PATH, 'utf8');
let baked = bakePreludeSource(original, 'PRELUDE_VOLATILES');
baked = bakePreludeSource(baked, 'PRELUDE_SOURCE');

if (baked === original) {
  throw new Error('Failed to bake prelude sources in dist/stdlib/prelude.js');
}

writeFileSync(DIST_PRELUDE_PATH, baked);

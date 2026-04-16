import {writeFileSync} from 'node:fs';

const DIST_PRELUDE_PATH = new URL('../dist/stdlib/prelude.js', import.meta.url);

const {PRELUDE_VOLATILES, PRELUDE_SOURCE} = await import(
  `${DIST_PRELUDE_PATH.href}?bake=${Date.now()}`
);

const bakedPrelude = [
  `export const PRELUDE_VOLATILES = ${JSON.stringify(PRELUDE_VOLATILES)};`,
  `export const PRELUDE_SOURCE = ${JSON.stringify(PRELUDE_SOURCE)};`,
  '',
].join('\n');

writeFileSync(DIST_PRELUDE_PATH, bakedPrelude);

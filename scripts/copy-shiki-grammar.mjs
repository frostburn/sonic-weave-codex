import {mkdir, copyFile} from 'node:fs/promises';
import {resolve} from 'node:path';

const source = resolve('src/shiki/sonic-weave.tmLanguage.json');
const targetDir = resolve('dist/shiki');
const target = resolve(targetDir, 'sonic-weave.tmLanguage.json');

await mkdir(targetDir, {recursive: true});
await copyFile(source, target);

import {mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {minify} from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const inputDir = path.join(rootDir, 'dist');
const outputDir = path.join(rootDir, 'dist-min');
const terserConfigPath = path.join(rootDir, 'terser.config.json');

async function listJavaScriptFiles(dir) {
  const entries = await readdir(dir, {withFileTypes: true});
  const files = await Promise.all(
    entries.map(async entry => {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return listJavaScriptFiles(fullPath);
      }
      if (entry.isFile() && fullPath.endsWith('.js')) {
        return [fullPath];
      }
      return [];
    })
  );

  return files.flat();
}

async function minifyFile(inputFile, options) {
  const relativePath = path.relative(inputDir, inputFile);
  const outputFile = path.join(outputDir, relativePath);
  const source = await readFile(inputFile, 'utf8');
  const result = await minify({[relativePath]: source}, options);

  if (!result.code) {
    throw new Error(`Minification produced no output for ${relativePath}`);
  }

  await mkdir(path.dirname(outputFile), {recursive: true});
  await writeFile(outputFile, result.code, 'utf8');
}

async function main() {
  const options = JSON.parse(await readFile(terserConfigPath, 'utf8'));
  await rm(outputDir, {recursive: true, force: true});

  const jsFiles = await listJavaScriptFiles(inputDir);
  await Promise.all(jsFiles.map(file => minifyFile(file, options)));
}

await main();

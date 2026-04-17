import {copyFile, mkdir, readdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {getManglePolicy} from './minify-policy.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..');
const distDir = path.join(repoRoot, 'dist');
const minDir = path.join(distDir, 'min');

async function collectJavaScriptFiles(directory) {
  const entries = await readdir(directory, {withFileTypes: true});
  const files = [];
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (fullPath === minDir) {
        continue;
      }
      files.push(...(await collectJavaScriptFiles(fullPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith('.js')) {
      files.push(fullPath);
    }
  }
  return files;
}

function basicMinify(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1')
    .replace(/\n+/g, '\n')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

async function tryLoadTerser() {
  try {
    const mod = await import('terser');
    return mod.minify;
  } catch {
    return null;
  }
}

async function main() {
  const compactMode = process.env.SONIC_WEAVE_MIN_COMPACT === '1';
  const mangle = getManglePolicy(compactMode);
  const terserMinify = await tryLoadTerser();

  await rm(minDir, {recursive: true, force: true});
  await mkdir(minDir, {recursive: true});
  await copyFile(path.join(repoRoot, 'package.json'), path.join(distDir, 'package.json'));

  const jsFiles = await collectJavaScriptFiles(distDir);
  for (const file of jsFiles) {
    const relativePath = path.relative(distDir, file);
    const outputPath = path.join(minDir, relativePath);
    await mkdir(path.dirname(outputPath), {recursive: true});

    const source = await readFile(file, 'utf8');
    let code;

    if (terserMinify) {
      const result = await terserMinify(source, {
        module: true,
        compress: {ecma: 2020, passes: 2},
        mangle: {properties: mangle},
        format: {comments: false},
      });
      code = result.code;
    } else {
      code = basicMinify(source);
    }

    if (!code) {
      throw new Error(`Minification produced no output for ${relativePath}`);
    }
    await writeFile(outputPath, code);
  }

  const backend = terserMinify ? 'terser' : 'basic-fallback (no property mangling)';
  console.log(
    `Built ${jsFiles.length} minified files in ${path.relative(repoRoot, minDir)} using ${backend} (compact=${compactMode ? 'on' : 'off'}).`,
  );
}

await main();

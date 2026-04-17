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

function createPropertyMangleMap(source, regex, reserved) {
  const mapping = new Map();
  const seen = new Set();
  const dotPropertyPattern = /\.(?<prop>[A-Za-z_$][\w$]*)/g;
  for (const match of source.matchAll(dotPropertyPattern)) {
    const prop = match.groups?.prop;
    if (!prop || !regex.test(prop) || reserved.has(prop)) {
      continue;
    }
    seen.add(prop);
  }

  let index = 0;
  const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ$_';
  const nextName = () => {
    let n = index++;
    let name = '';
    do {
      name = alphabet[n % alphabet.length] + name;
      n = Math.floor(n / alphabet.length) - 1;
    } while (n >= 0);
    return name;
  };

  for (const prop of seen) {
    mapping.set(prop, `_${nextName()}`);
  }
  return mapping;
}

function applyPropertyMangling(source, mapping) {
  let output = source;
  for (const [from, to] of mapping) {
    const escaped = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const dotRef = new RegExp(`\\.${escaped}(?![\\w$])`, 'g');
    const quotedKey = new RegExp(`(["'])${escaped}\\1\\s*:`, 'g');
    output = output.replace(dotRef, `.${to}`);
    output = output.replace(quotedKey, `'${to}':`);
  }
  return output;
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
  const reserved = new Set(mangle.reserved);
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
      const mapping = createPropertyMangleMap(source, mangle.regex, reserved);
      code = basicMinify(applyPropertyMangling(source, mapping));
    }

    if (!code) {
      throw new Error(`Minification produced no output for ${relativePath}`);
    }
    await writeFile(outputPath, code);
  }

  const backend = terserMinify ? 'terser' : 'basic-fallback';
  console.log(
    `Built ${jsFiles.length} minified files in ${path.relative(repoRoot, minDir)} using ${backend} (compact=${compactMode ? 'on' : 'off'}).`,
  );
}

await main();

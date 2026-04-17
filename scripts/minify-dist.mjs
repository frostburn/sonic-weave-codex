import {mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';
import {minify} from 'terser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const outputDir = path.join(rootDir, 'dist-min');

async function loadEntryFiles() {
  const packageJson = JSON.parse(
    await readFile(path.join(rootDir, 'package.json'), 'utf8')
  );
  const entries = new Set();

  for (const value of Object.values(packageJson.exports ?? {})) {
    if (!value || typeof value === 'string') {
      continue;
    }
    const importPath = value.import;
    if (typeof importPath !== 'string') {
      continue;
    }
    if (!importPath.startsWith('./dist/') || !importPath.endsWith('.js')) {
      continue;
    }
    entries.add(path.join(rootDir, importPath.slice(2)));
  }

  return [...entries];
}

async function bundleAndMinify(entryFile, terserOptions) {
  const relativeDistPath = path.relative(path.join(rootDir, 'dist'), entryFile);
  const outputFile = path.join(outputDir, relativeDistPath);
  const bundle = await build({
    absWorkingDir: rootDir,
    entryPoints: [entryFile],
    bundle: true,
    format: 'esm',
    platform: 'neutral',
    target: ['es2020'],
    write: false,
    sourcemap: false,
    minify: false,
    treeShaking: true,
  });

  const code = bundle.outputFiles[0]?.text;
  if (!code) {
    throw new Error(`Bundling produced no output for ${relativeDistPath}`);
  }

  const result = await minify({[relativeDistPath]: code}, terserOptions);
  if (!result.code) {
    throw new Error(`Minification produced no output for ${relativeDistPath}`);
  }

  await mkdir(path.dirname(outputFile), {recursive: true});
  await writeFile(outputFile, result.code, 'utf8');
}

async function main() {
  const terserOptions = JSON.parse(
    await readFile(path.join(rootDir, 'terser.config.json'), 'utf8')
  );
  const entryFiles = await loadEntryFiles();

  await rm(outputDir, {recursive: true, force: true});
  await Promise.all(
    entryFiles.map(entryFile => bundleAndMinify(entryFile, terserOptions))
  );
}

await main();

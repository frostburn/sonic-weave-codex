import {performance} from 'node:perf_hooks';
import {Session} from 'node:inspector';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {
  StatementVisitor,
  getSourceVisitor,
  parseAST,
  sw,
} from '../dist/parser/index.js';
import {BUILTIN_CONTEXT} from '../dist/stdlib/builtin/index.js';
import {PRELUDE_SOURCE, PRELUDE_VOLATILES} from '../dist/stdlib/prelude.js';
import {RootContext} from '../dist/context.js';
import {CSS_COLOR_CONTEXT} from '../dist/css-colors.js';

const CPU_PROFILE_ENABLED = process.argv.includes('--cpu');
const PROFILE_DIR = resolve(process.cwd(), '.profiles');
const INTERCHANGE_SOURCE = `
  "Raga Bhairavi"
  1 = [1 3 1 1>@Hz.2.5.11

  [4 -1 -1> "" black
  [-3 2> "" white
  [1 1 -1> "" black
  [-2 3 -1> "" black
  [-1 1> "" white
  [3 0 -1> "" black
  [0 2 -1> "" black
  [1> "" white
`;

function formatDuration(ms) {
  return `${ms.toFixed(2)} ms`;
}

function formatBytes(bytes) {
  const sign = bytes < 0 ? '-' : '';
  const absolute = Math.abs(bytes);
  if (absolute < 1024) {
    return `${sign}${absolute} B`;
  }
  if (absolute < 1024 * 1024) {
    return `${sign}${(absolute / 1024).toFixed(1)} KiB`;
  }
  return `${sign}${(absolute / (1024 * 1024)).toFixed(2)} MiB`;
}

function createVisitor() {
  const rootContext = new RootContext();
  const visitor = new StatementVisitor();
  visitor.rootContext = rootContext;
  for (const [name, color] of CSS_COLOR_CONTEXT) {
    visitor.immutables.set(name, color);
  }
  for (const name in BUILTIN_CONTEXT) {
    visitor.immutables.set(name, BUILTIN_CONTEXT[name]);
  }
  return visitor;
}

async function profileCpu(name, fn) {
  const session = new Session();
  session.connect();

  const post = (method, params = {}) =>
    new Promise((resolvePost, rejectPost) => {
      session.post(method, params, (error, result) => {
        if (error) {
          rejectPost(error);
          return;
        }
        resolvePost(result);
      });
    });

  await post('Profiler.enable');
  await post('Profiler.start');

  fn();

  const data = await post('Profiler.stop');
  session.disconnect();

  await mkdir(PROFILE_DIR, {recursive: true});
  const safeName = name.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
  const filename = `${safeName}.cpuprofile`;
  await writeFile(resolve(PROFILE_DIR, filename), JSON.stringify(data.profile));
  return filename;
}

async function runWorkload({name, iterations, fn}) {
  const beforeHeap = process.memoryUsage().heapUsed;
  const start = performance.now();

  for (let i = 0; i < iterations; ++i) {
    fn();
  }

  const totalMs = performance.now() - start;
  const afterHeap = process.memoryUsage().heapUsed;
  let cpuProfile = '';

  if (CPU_PROFILE_ENABLED) {
    cpuProfile = await profileCpu(name, fn);
  }

  return {
    name,
    iterations,
    totalMs,
    avgMs: totalMs / iterations,
    heapDelta: afterHeap - beforeHeap,
    cpuProfile,
  };
}

async function main() {
  getSourceVisitor();

  const prelude = parseAST(PRELUDE_SOURCE);
  const volatiles = parseAST(PRELUDE_VOLATILES);

  const workloads = [
    {
      name: 'Parse prelude source',
      iterations: 30,
      fn: () => parseAST(PRELUDE_SOURCE),
    },
    {
      name: 'Visit prelude and volatiles',
      iterations: 40,
      fn: () => {
        const visitor = createVisitor();
        for (const statement of prelude.body) {
          visitor.visit(statement);
        }
        for (const statement of volatiles.body) {
          visitor.visit(statement);
        }
      },
    },
    {
      name: 'Parse SonicWeave Interchange sample',
      iterations: 250,
      fn: () => parseAST(INTERCHANGE_SOURCE),
    },
    {
      name: 'Run Euler genus riff',
      iterations: 25,
      fn: () => {
        for (let n = 5; n < 100; ++n) {
          void sw`eulerGenus(${n})`;
        }
      },
    },
  ];

  const results = [];
  for (const workload of workloads) {
    results.push(await runWorkload(workload));
  }

  console.log('SonicWeave profiling summary\n');
  console.log(
    [
      'Workload'.padEnd(36),
      'Iterations'.padStart(10),
      'Total'.padStart(12),
      'Average'.padStart(12),
      'Heap Δ'.padStart(12),
      'CPU profile'.padStart(22),
    ].join(' | ')
  );
  console.log('-'.repeat(116));

  for (const result of results) {
    console.log(
      [
        result.name.padEnd(36),
        String(result.iterations).padStart(10),
        formatDuration(result.totalMs).padStart(12),
        formatDuration(result.avgMs).padStart(12),
        formatBytes(result.heapDelta).padStart(12),
        (result.cpuProfile || 'disabled').padStart(22),
      ].join(' | ')
    );
  }

  if (CPU_PROFILE_ENABLED) {
    console.log(`\nCPU profiles written to ${PROFILE_DIR}`);
    console.log('Open files in Chrome DevTools Performance tab for hotspot analysis.');
  } else {
    console.log('\nRun with --cpu to emit per-workload .cpuprofile files.');
  }
}

await main();

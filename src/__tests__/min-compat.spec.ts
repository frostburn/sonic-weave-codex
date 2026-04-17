import {describe, expect, it} from 'vitest';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const repoRoot = path.resolve(__dirname, '..', '..');

async function loadBuild(entry: string) {
  const moduleUrl = pathToFileURL(path.join(repoRoot, entry)).href;
  return import(moduleUrl);
}

describe('dist/min compatibility matrix', () => {
  it('preserves runtime behavior across selected APIs', async () => {
    const regular = await loadBuild('dist/index.js');
    const minified = await loadBuild('dist/min/index.js');

    const cases: Array<{
      name: string;
      run: (mod: Record<string, unknown>) => unknown;
    }> = [
      {
        name: 'AST shape (denominator remains addressable)',
        run: mod => {
          const ast = mod.parseAST('3/2');
          const expression = ast.body[0].expression;
          return {
            type: expression.type,
            hasDenominator: 'denominator' in expression,
            denominator: String(expression.denominator),
          };
        },
      },
      {
        name: 'public value field (numberOfComponents)',
        run: mod => {
          const interval = mod.evaluateExpression('3/2', false);
          return {
            numberOfComponents: interval.value.numberOfComponents,
          };
        },
      },
      {
        name: 'expression result parity',
        run: mod => {
          const interval = mod.evaluateExpression('5/4 * 6/5', false);
          return {
            cents: interval.totalCents(),
            text: interval.toString(),
          };
        },
      },
    ];

    for (const testCase of cases) {
      const regularResult = testCase.run(regular);
      const minifiedResult = testCase.run(minified);
      expect(minifiedResult, testCase.name).toEqual(regularResult);
    }
  });
});

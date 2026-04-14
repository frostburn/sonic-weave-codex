import {describe, expect, it} from 'vitest';
import {parseAST, getSourceVisitor} from '../../parser/parser.js';
import {PRELUDE_SOURCE, PRELUDE_VOLATILES} from '../prelude.js';
import {minifyPrelude} from '../prelude-minify.js';
import {Interval} from '../../interval.js';

function parseWithPrelude(program: string, prelude: string, volatiles: string) {
  const visitor = getSourceVisitor(false);
  visitor.executeProgram(parseAST(prelude));
  visitor.executeProgram(parseAST(volatiles));
  visitor.executeProgram(parseAST(program));
  return visitor.currentScale.map(interval =>
    (interval as Interval).toString(),
  );
}

describe('prelude minifier regression coverage', () => {
  const minifiedPrelude = minifyPrelude(PRELUDE_SOURCE);
  const minifiedVolatiles = minifyPrelude(PRELUDE_VOLATILES);

  const samples = [
    'csgs([8/7, 7/6]);',
    'csgs([8/7, 7/6], 3);',
    '1;2/1;coalesce();',
    '4096/4095;3/2;4095/2048;2/1;coalesce();',
  ];

  for (const sample of samples) {
    it(`preserves behavior for: ${sample}`, () => {
      expect(
        parseWithPrelude(sample, minifiedPrelude, minifiedVolatiles),
      ).toEqual(parseWithPrelude(sample, PRELUDE_SOURCE, PRELUDE_VOLATILES));
    });
  }
});

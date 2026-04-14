import {describe, expect, it} from 'vitest';
import {parseAST, getSourceVisitor} from '../../parser/parser.js';
import {PRELUDE_SOURCE, PRELUDE_VOLATILES} from '../prelude.js';
import {Interval} from '../../interval.js';

function isIdentifierChar(char: string) {
  return /[\p{L}\p{N}_$]/u.test(char);
}

function minifyPrelude(source: string) {
  let i = 0;
  let output = '';

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (char === '(' && next === '*') {
      i += 2;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === ')')
      ) {
        if (source[i] === '\n') {
          output += '\n';
        }
        i += 1;
      }
      i += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      output += quote;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        output += c;
        i += 1;
        if (c === '\\') {
          output += source[i] ?? '';
          i += 1;
          continue;
        }
        if (c === quote) {
          break;
        }
      }
      continue;
    }

    if (isIdentifierChar(char)) {
      let token = char;
      i += 1;
      while (i < source.length && isIdentifierChar(source[i])) {
        token += source[i];
        i += 1;
      }
      output += token === 'riff' ? 'fn' : token;
      continue;
    }

    output += char;
    i += 1;
  }

  return output.trim();
}

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

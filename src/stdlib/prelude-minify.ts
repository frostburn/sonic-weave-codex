function isIdentifierChar(char: string) {
  return /[\p{L}\p{N}_$]/u.test(char);
}

/**
 * Minify SonicWeave prelude source while preserving semantics.
 * - Removes `(* ... *)` comments
 * - Preserves all non-comment whitespace/newline structure
 * - Rewrites `riff` keyword to `fn` outside string literals
 */
export function minifyPrelude(source: string) {
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

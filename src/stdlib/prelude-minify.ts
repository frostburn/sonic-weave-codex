type TokenType = 'word' | 'string' | 'symbol';

type Token = {
  type: TokenType;
  value: string;
};

type Gap = {
  hasWhitespace: boolean;
  hasNewline: boolean;
};

const ALIASES: ReadonlyArray<readonly [string, string, string]> = [
  ['niente', '_N', 'const _N=niente;'],
  ['length', '_L', 'const _L=length;'],
];

function applyAliases(tokens: Token[]) {
  const used = new Set<string>();
  const aliasMap = new Map(ALIASES.map(([from, to]) => [from, to]));

  for (const token of tokens) {
    if (token.type !== 'word') {
      continue;
    }
    const replacement = aliasMap.get(token.value);
    if (!replacement) {
      continue;
    }
    token.value = replacement;
    used.add(replacement);
  }

  return ALIASES.filter(([, to]) => used.has(to)).map(
    ([, , declaration]) => declaration,
  );
}

function isIdentifierChar(char: string) {
  return /[\p{L}\p{N}_$]/u.test(char);
}

function tokenize(source: string) {
  const tokens: Token[] = [];
  const gaps: Gap[] = [];

  let i = 0;
  let pendingWhitespace = false;
  let pendingNewline = false;

  while (i < source.length) {
    const char = source[i];
    const next = source[i + 1];

    if (/\s/u.test(char)) {
      pendingWhitespace = true;
      pendingNewline ||= char === '\n';
      i += 1;
      continue;
    }

    if (char === '(' && next === '*') {
      i += 2;
      pendingWhitespace = true;
      while (
        i < source.length &&
        !(source[i] === '*' && source[i + 1] === ')')
      ) {
        pendingNewline ||= source[i] === '\n';
        i += 1;
      }
      i += 2;
      continue;
    }

    if (char === '"' || char === "'") {
      const quote = char;
      let value = quote;
      i += 1;
      while (i < source.length) {
        const c = source[i];
        value += c;
        i += 1;
        if (c === '\\') {
          value += source[i] ?? '';
          i += 1;
          continue;
        }
        if (c === quote) {
          break;
        }
      }
      gaps.push({hasWhitespace: pendingWhitespace, hasNewline: pendingNewline});
      pendingWhitespace = false;
      pendingNewline = false;
      tokens.push({type: 'string', value});
      continue;
    }

    if (isIdentifierChar(char)) {
      let value = char;
      i += 1;
      while (i < source.length && isIdentifierChar(source[i])) {
        value += source[i];
        i += 1;
      }
      gaps.push({hasWhitespace: pendingWhitespace, hasNewline: pendingNewline});
      pendingWhitespace = false;
      pendingNewline = false;
      tokens.push({type: 'word', value: value === 'riff' ? 'fn' : value});
      continue;
    }

    gaps.push({hasWhitespace: pendingWhitespace, hasNewline: pendingNewline});
    pendingWhitespace = false;
    pendingNewline = false;
    tokens.push({type: 'symbol', value: char});
    i += 1;
  }

  return {tokens, gaps};
}

function renameLocalVariables(tokens: Token[]) {
  let aliasCounter = 0;
  const scopes: Array<Map<string, string>> = [new Map()];

  const createAlias = () => {
    const alias = `_v${aliasCounter.toString(36)}`;
    aliasCounter += 1;
    return alias;
  };

  const currentScope = () => scopes[scopes.length - 1];
  const lookup = (name: string) => {
    for (let i = scopes.length - 1; i >= 0; --i) {
      const alias = scopes[i].get(name);
      if (alias) {
        return alias;
      }
    }
    return undefined;
  };

  let inDeclaration = false;
  let expectIdentifier = false;

  for (const token of tokens) {
    if (token.type === 'symbol') {
      if (token.value === '{') {
        scopes.push(new Map());
      } else if (token.value === '}') {
        scopes.pop();
      } else if (inDeclaration && token.value === ',') {
        expectIdentifier = true;
      } else if (
        inDeclaration &&
        (token.value === ';' || token.value === ')')
      ) {
        inDeclaration = false;
        expectIdentifier = false;
      }
      continue;
    }

    if (token.type !== 'word') {
      continue;
    }

    if (token.value === 'const' || token.value === 'let') {
      inDeclaration = true;
      expectIdentifier = true;
      continue;
    }

    if (inDeclaration && expectIdentifier) {
      const scope = currentScope();
      if (!scope.has(token.value)) {
        scope.set(token.value, createAlias());
      }
      token.value = scope.get(token.value)!;
      expectIdentifier = false;
      continue;
    }

    const alias = lookup(token.value);
    if (alias) {
      token.value = alias;
    }
  }
}

function canTouch(prev: Token, next: Token) {
  if (prev.type === 'symbol' && '([{,;'.includes(prev.value)) {
    return true;
  }
  if (next.type === 'symbol' && ')]},;'.includes(next.value)) {
    return true;
  }
  if (prev.type === 'word' && next.type === 'symbol' && next.value === '(') {
    return true;
  }
  if (prev.type === 'symbol' && next.type === 'symbol') {
    return true;
  }
  return false;
}

function canCollapseNewline(prev: Token, next: Token) {
  if (prev.type === 'symbol' && '{};,'.includes(prev.value)) {
    return true;
  }
  return canTouch(prev, next);
}

function separator(prev: Token, next: Token, gap: Gap) {
  if (!gap.hasWhitespace) {
    return '';
  }

  if (gap.hasNewline) {
    if (!canCollapseNewline(prev, next)) {
      return '\n';
    }
    return canTouch(prev, next) ? '' : ' ';
  }

  return canTouch(prev, next) ? '' : ' ';
}

/**
 * Minify SonicWeave prelude source while preserving semantics.
 */
export function minifyPrelude(source: string) {
  const {tokens, gaps} = tokenize(source);
  const declarations = applyAliases(tokens);
  renameLocalVariables(tokens);
  if (!tokens.length) {
    return '';
  }

  let result = tokens[0].value;
  for (let i = 1; i < tokens.length; ++i) {
    result += separator(tokens[i - 1], tokens[i], gaps[i]);
    result += tokens[i].value;
  }

  result = result.trim();
  if (declarations.length) {
    return `${declarations.join('')}\n${result}`;
  }
  return result;
}

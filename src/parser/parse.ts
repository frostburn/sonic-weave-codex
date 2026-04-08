import {Program} from '../ast.js';
import * as sonicWeaveAstParser from './sonic-weave-ast.js';
import * as sonicWeaveChordParser from './sonic-weave-chord.js';

/**
 * Parse SonicWeave source text into an abstract syntax tree.
 *
 * This module is intentionally parse-only so consumers can import grammar APIs
 * without pulling in runtime evaluation machinery.
 *
 * @param source Source code for a SonicWeave program.
 * @returns The parsed program AST.
 */
export function parseAST(source: string): Program {
  return (sonicWeaveAstParser as {parse: (source: string) => Program}).parse(
    source,
  );
}

/**
 * Parse chord-like separator syntax into expression snippets.
 *
 * @param input User input in a context that expects a chord expression list.
 * @returns Chord expression fragments as raw source strings.
 */
export function parseChordFragments(input: string): string[] {
  return (sonicWeaveChordParser as {parse: (input: string) => string[]}).parse(
    input,
  );
}

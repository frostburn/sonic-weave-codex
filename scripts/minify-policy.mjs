const SAFE_INTERNAL_PROPERTY_PATTERN = /^(?:_|peg\$|__)/;

const PUBLIC_RESERVED_PROPERTIES = [
  // Public interval / runtime fields.
  'basis',
  'body',
  'color',
  'denominator',
  'domain',
  'expression',
  'label',
  'node',
  'numberOfComponents',
  'numerator',
  'ortho',
  'primeExponents',
  'residual',
  'steps',
  'timeExponent',
  'trackingIds',
  'type',
  'value',
  // AST keys that are often accessed dynamically by integrators.
  'equaveDenominator',
  'equaveNumerator',
  'left',
  'right',
  'radical',
];

/**
 * Mangle policy for the optional dist/min build.
 *
 * Default mode protects public/exported fields and common AST keys.
 * Compact mode can be enabled with SONIC_WEAVE_MIN_COMPACT=1 to allow these
 * names to be mangled as well (smaller output, higher breakage risk).
 */
export function getManglePolicy(compactMode = false) {
  return {
    regex: SAFE_INTERNAL_PROPERTY_PATTERN,
    reserved: compactMode ? [] : PUBLIC_RESERVED_PROPERTIES,
  };
}

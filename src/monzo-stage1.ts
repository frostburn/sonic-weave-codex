import {
  Fraction,
  FractionValue,
  valueToCents,
  PRIMES,
  PRIME_CENTS,
  primeLimit,
  toMonzoAndResidual,
  centsToValue,
} from 'xen-dev-utils';
import {getNumberOfComponents} from './monzo-config.js';
import {TWO, ZERO} from './utils.js';

/**
 * Stage 1 monzo/runtime core for parser-focused consumers.
 */
export class Stage1TimeReal {
  timeExponent: number;
  value: number;

  constructor(timeExponent: number, value: number) {
    if (!value) {
      timeExponent = 0;
    }
    if (!isFinite(timeExponent)) {
      throw new Error('Time exponent must be finite.');
    }
    this.timeExponent = timeExponent;
    this.value = value;
  }

  static fromValue(value: number) {
    return new Stage1TimeReal(0, value);
  }

  static fromCents(cents: number) {
    return new Stage1TimeReal(0, centsToValue(cents));
  }

  static fromFrequency(frequency: number) {
    return new Stage1TimeReal(-1, frequency);
  }

  inverse(): any {
    return new Stage1TimeReal(-this.timeExponent, 1 / this.value);
  }

  mul(other: any): any {
    return new Stage1TimeReal(
      this.timeExponent + other.timeExponent,
      this.value * other.value,
    );
  }

  div(other: any): any {
    return new Stage1TimeReal(
      this.timeExponent - other.timeExponent,
      this.value / other.value,
    );
  }
}

/**
 * Stage 1 monzo/runtime core for parser-focused consumers.
 */
export class Stage1TimeMonzo {
  timeExponent: Fraction;
  primeExponents: Fraction[];
  residual: Fraction;

  constructor(
    timeExponent: Fraction,
    primeExponents: Fraction[],
    residual = new Fraction(1),
  ) {
    this.timeExponent = timeExponent;
    this.primeExponents = primeExponents;
    this.residual = residual;
  }

  static fromBigInt(value: bigint, numberOfComponents?: number) {
    const [vector, residual] = toMonzoAndResidual(
      value,
      numberOfComponents ?? getNumberOfComponents(),
    );
    return new Stage1TimeMonzo(
      ZERO,
      vector.map(c => new Fraction(c)),
      new Fraction(Number(residual)),
    );
  }

  static fromBigNumeratorDenominator(
    numerator: bigint,
    denominator: bigint,
    numberOfComponents?: number,
  ) {
    numberOfComponents ??= getNumberOfComponents();
    const [positiveVector, numeratorResidual] = toMonzoAndResidual(
      numerator,
      numberOfComponents,
    );
    const [negativeVector, denominatorResidual] = toMonzoAndResidual(
      denominator,
      numberOfComponents,
    );
    return new Stage1TimeMonzo(
      ZERO,
      positiveVector.map((p, i) => new Fraction(p - negativeVector[i])),
      new Fraction(Number(numeratorResidual), Number(denominatorResidual)),
    );
  }

  static fromEqualTemperament(
    fractionOfEquave: FractionValue,
    equave: FractionValue = TWO,
    numberOfComponents?: number,
  ) {
    if (numberOfComponents === undefined) {
      numberOfComponents = Math.max(
        primeLimit(equave, true),
        getNumberOfComponents(),
      );
    }
    const [equaveVector, residual] = toMonzoAndResidual(
      equave,
      numberOfComponents,
    );
    if (!residual.isUnity()) {
      throw new Error('Unable to convert equave to monzo.');
    }
    const fractionOfEquave_ = new Fraction(fractionOfEquave);
    return new Stage1TimeMonzo(
      ZERO,
      equaveVector.map(component => fractionOfEquave_.mul(component)),
    );
  }

  inverse(): any {
    return new Stage1TimeMonzo(
      this.timeExponent.neg(),
      this.primeExponents.map(p => p.neg()),
      this.residual.inverse(),
    );
  }

  mul(other: any): any {
    const count = Math.max(
      this.primeExponents.length,
      other.primeExponents.length,
    );
    const components: Fraction[] = [];
    for (let i = 0; i < count; ++i) {
      components.push(
        (this.primeExponents[i] ?? ZERO).add(other.primeExponents[i] ?? ZERO),
      );
    }
    return new Stage1TimeMonzo(
      this.timeExponent.add(other.timeExponent),
      components,
      this.residual.mul(other.residual),
    );
  }

  div(other: any): any {
    return this.mul(other.inverse());
  }

  isScalar() {
    return !this.timeExponent.n;
  }

  equals(other: any) {
    if (!(other instanceof Stage1TimeMonzo)) {
      return false;
    }
    if (!this.timeExponent.equals(other.timeExponent)) {
      return false;
    }
    if (!this.residual.equals(other.residual)) {
      return false;
    }
    const len = Math.max(
      this.primeExponents.length,
      other.primeExponents.length,
    );
    for (let i = 0; i < len; ++i) {
      if (
        !(this.primeExponents[i] ?? ZERO).equals(
          other.primeExponents[i] ?? ZERO,
        )
      ) {
        return false;
      }
    }
    return true;
  }

  toBigNumeratorDenominator() {
    if (!this.isScalar()) {
      throw new Error('Not scalar.');
    }
    let numerator = BigInt(this.residual.s * this.residual.n);
    let denominator = BigInt(this.residual.d);
    for (let i = 0; i < this.primeExponents.length; ++i) {
      const exponent = this.primeExponents[i];
      if (exponent.d !== 1) {
        throw new Error('Not rational.');
      }
      const prime = BigInt(PRIMES[i]);
      if (exponent.s > 0) {
        numerator *= prime ** BigInt(exponent.n);
      } else if (exponent.s < 0) {
        denominator *= prime ** BigInt(exponent.n);
      }
    }
    return {numerator, denominator};
  }

  isIntegral() {
    try {
      const {denominator} = this.toBigNumeratorDenominator();
      return denominator === 1n;
    } catch {
      return false;
    }
  }

  toBigInteger() {
    const {numerator, denominator} = this.toBigNumeratorDenominator();
    if (denominator !== 1n) {
      throw new Error('Not integer.');
    }
    return numerator;
  }

  valueOf() {
    const {numerator, denominator} = this.toBigNumeratorDenominator();
    return Number(numerator) / Number(denominator);
  }
  totalCents(ignoreSign = false) {
    if (!this.isScalar()) {
      throw new Error('Not scalar.');
    }
    let total = valueToCents(this.residual.valueOf());
    for (
      let i = 0;
      i < this.primeExponents.length && i < PRIME_CENTS.length;
      ++i
    ) {
      total += this.primeExponents[i].valueOf() * PRIME_CENTS[i];
    }
    return ignoreSign ? Math.abs(total) : total;
  }

  toString(domain: 'linear' | 'logarithmic' = 'linear') {
    if (domain === 'linear' && this.isScalar()) {
      try {
        const {numerator, denominator} = this.toBigNumeratorDenominator();
        if (denominator === 1n) {
          return numerator.toString();
        }
        return `${numerator}/${denominator}`;
      } catch {
        // Fall through
      }
    }
    if (
      domain === 'logarithmic' &&
      this.isScalar() &&
      this.residual.equals(new Fraction(1)) &&
      this.primeExponents.length > 0 &&
      this.primeExponents[0].n
    ) {
      const exponent = this.primeExponents[0];
      return `${exponent.s * exponent.n}\\${exponent.d}`;
    }
    return '[object Object]';
  }
}

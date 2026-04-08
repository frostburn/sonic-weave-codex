import {NUM_INTERCHANGE_COMPONENTS} from './utils.js';

let numberOfComponents = NUM_INTERCHANGE_COMPONENTS; // Primes 2..23 by default.

/**
 * Set the default number of components in the vector part of time monzos.
 * @param n New default length of the vector part.
 */
export function setNumberOfComponents(n: number) {
  numberOfComponents = n;
}

/**
 * Get the default number of components in the vector part of extended monzos.
 * @returns The default length of the vector part.
 */
export function getNumberOfComponents() {
  return numberOfComponents;
}

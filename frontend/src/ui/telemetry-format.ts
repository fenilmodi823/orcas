const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

function toSuperscript(exponent: string): string {
  return exponent
    .split('')
    .map((char) => SUPERSCRIPT_DIGITS[char] ?? char)
    .join('');
}

/**
 * Formats a measurement the way Design.md §4 requires: proper scientific
 * notation for very small or very large magnitudes (4.2 × 10⁻³, never
 * 4.2e-3), plain tabular decimals otherwise.
 */
export function formatTelemetryValue(value: number, precision = 2): string {
  if (value === 0) return (0).toFixed(precision);
  const magnitude = Math.abs(value);
  const useScientific = magnitude < 1e-2 || magnitude >= 1e6;
  if (!useScientific) {
    return value.toFixed(precision);
  }
  const [rawMantissa, rawExponent] = value.toExponential(precision).split('e');
  const mantissa = String(Number(rawMantissa));
  const exponent = toSuperscript(rawExponent.replace('+', ''));
  return `${mantissa} × 10${exponent}`;
}

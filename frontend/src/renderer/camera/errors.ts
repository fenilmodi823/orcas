/** Rejects a superseded or grabbed flight promise (brief §C.6, §C.11). Its
 * own module so camera-system.ts and flight.ts both import it without a
 * circular dependency. */
export class CancelledError extends Error {
  constructor() {
    super('camera flight cancelled');
    this.name = 'CancelledError';
  }
}

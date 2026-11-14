/**
 * Small helpers shared inside the library. Nothing here is exported from the package.
 */

/**
 * Attaches a value that is read only and left out of enumeration, `JSON.stringify` and `console.log`.
 * Structures keep their client, channel or message this way.
 *
 * @internal
 */
export function attachHidden(target: object, key: string, value: unknown): void {
  Object.defineProperty(target, key, { value, writable: false, enumerable: false, configurable: false });
}

/**
 * A `Date` for a millisecond timestamp, or `null` when there is none.
 *
 * @internal
 */
export function dateFrom(timestamp: number): Date;
export function dateFrom(timestamp: number | null): Date | null;
export function dateFrom(timestamp: number | null): Date | null {
  return timestamp === null ? null : new Date(timestamp);
}

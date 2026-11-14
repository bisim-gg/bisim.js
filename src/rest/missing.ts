import { BisimAPIError } from './errors.js';

/**
 * Whether an error means the route itself does not exist on this Bisim server yet (as opposed to "not found"
 * for the thing asked about). Bisim is adding some routes bots need; until a server has them, bisim.js falls
 * back to an older way of doing the same thing.
 *
 * @param error - The error
 * @internal
 */
export function isRouteMissing(error: unknown): boolean {
  if (!(error instanceof BisimAPIError)) return false;
  if (error.status === 405) return true;
  if (error.status !== 404) return false;
  const message = error.rawError?.message;
  return typeof message === 'string' && /^Cannot (GET|POST|PUT|PATCH|DELETE) /.test(message);
}

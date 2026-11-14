import type { InternalRequest, RateLimitData, RawFile, RequestBody } from './types.js';

/**
 * The body of an error Bisim answered: a coded error `{message, code}`, a plain one
 * `{statusCode, message, error}`, or a validation error whose message is a list.
 */
export interface BisimErrorData {
  code?: string;
  message?: string | string[];
  statusCode?: number;
  error?: string;
  retryAfter?: number;
  [key: string]: unknown;
}

function errorMessage(raw: BisimErrorData, status: number): string {
  if (Array.isArray(raw.message)) return raw.message.join('\n');
  if (typeof raw.message === 'string' && raw.message.length) return raw.message;
  if (typeof raw.error === 'string' && raw.error.length) return raw.error;
  return `Bisim answered ${status}`;
}

/**
 * An error Bisim's API answered with a JSON body (4xx). What discord.js calls `DiscordAPIError`.
 *
 * @example
 * ```js
 * try {
 *   await member.kick();
 * } catch (error) {
 *   if (error instanceof BisimAPIError && error.status === 403) console.log('Missing permissions');
 * }
 * ```
 */
export class BisimAPIError extends Error {
  /**
   * The body Bisim answered with.
   */
  public readonly rawError!: BisimErrorData;

  /**
   * Bisim's error code, a string such as `BOT_NOT_ALLOWED` or `RATE_LIMITED` (Bisim's codes are names, not
   * Discord's numbers), or the HTTP status when the error carried no code.
   */
  public readonly code!: string | number;

  /**
   * The HTTP status of the response.
   */
  public readonly status!: number;

  /**
   * The HTTP method used for the request.
   */
  public readonly method!: string;

  /**
   * The URL of the request.
   */
  public readonly url!: string;

  /**
   * What was sent.
   */
  public readonly requestBody!: RequestBody;

  /**
   * @param rawError - The error body Bisim answered with
   * @param code - The error code
   * @param status - The HTTP status
   * @param method - The HTTP method
   * @param url - The URL of the request
   * @param bodyData - What was sent
   */
  public constructor(rawError: BisimErrorData, code: string | number, status: number, method: string, url: string, bodyData: SentData) {
    super(errorMessage(rawError, status));
    Object.assign(this, { rawError, code, status, method, url, requestBody: describeSent(bodyData) });
  }

  /**
   * The name of the error, with its code, such as `BisimAPIError[UNKNOWN_CHANNEL]`.
   */
  public override get name(): string {
    return withDetail('BisimAPIError', this.code);
  }
}

/**
 * An HTTP error that came without a usable JSON body, or a server error (5xx) that kept failing after the
 * retries.
 */
export class HTTPError extends Error {
  /**
   * What was sent.
   */
  public readonly requestBody: RequestBody;

  public override name = HTTPError.name;

  /**
   * @param status - The HTTP status
   * @param statusText - The HTTP status text
   * @param method - The HTTP method
   * @param url - The URL of the request
   * @param bodyData - What was sent
   */
  public constructor(public readonly status: number, statusText: string, public readonly method: string, public readonly url: string, bodyData: SentData) {
    super(statusText || `HTTP ${status}`);
    this.requestBody = describeSent(bodyData);
  }
}

/**
 * Thrown instead of waiting when a request hits a rate limit that `rejectOnRateLimit` says to reject.
 */
export class RateLimitError extends Error implements RateLimitData {
  public timeToReset!: number;
  public limit!: number;
  public method!: string;
  public hash!: string;
  public url!: string;
  public route!: string;
  public majorParameter!: string;
  public global!: boolean;
  public retryAfter!: number;
  public sublimitTimeout!: number;
  public scope!: RateLimitData['scope'];

  /**
   * @param data - What the rate limit was
   */
  public constructor(data: RateLimitData) {
    super();
    const { timeToReset, limit, method, hash, url, route, majorParameter, global, retryAfter, sublimitTimeout, scope } = data;
    Object.assign(this, { timeToReset, limit, method, hash, url, route, majorParameter, global, retryAfter, sublimitTimeout, scope });
  }

  /**
   * The name of the error, with the route, such as `RateLimitError[/channels/:id/messages]`.
   */
  public override get name(): string {
    return withDetail('RateLimitError', this.route);
  }
}

/** What a request carried, as the errors keep it. */
type SentData = Pick<InternalRequest, 'body' | 'files'>;

function describeSent(sent: SentData): RequestBody {
  return { json: sent.body, files: sent.files as RawFile[] | undefined };
}

function withDetail(kind: string, detail: string | number): string {
  return `${kind}[${detail}]`;
}

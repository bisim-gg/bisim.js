import type { Readable } from 'node:stream';

/**
 * An HTTP method.
 */
export enum RequestMethod {
  Delete = 'DELETE',
  Get = 'GET',
  Patch = 'PATCH',
  Post = 'POST',
  Put = 'PUT',
}

/**
 * A route path, such as `/channels/123/messages`.
 */
export type RouteLike = `/${string}`;

/**
 * A file to upload with a message. bisim.js sends it through Bisim's presigned upload: it asks the api for
 * an upload address, puts the bytes there, then sends the message with the attachment.
 */
export interface RawFile {
  /** The name of the file. */
  name: string;
  /** Ignored on Bisim (kept for the discord.js shape). */
  key?: string;
  /** The bytes. */
  data: Buffer | Uint8Array | ArrayBuffer | string | Readable | Blob;
  /** The content type, guessed from the name when left out. */
  contentType?: string;
  /** Alt text for the file. */
  description?: string;
  /** Whether the file is shown behind a spoiler. */
  spoiler?: boolean;
}

/**
 * The options of a request.
 */
export interface RequestData {
  /** Accepted for compatibility, not used. */
  appendToFormData?: boolean;
  /** Whether to send the bot token, `true` by default. */
  auth?: boolean | 'Bot' | 'Bearer';
  /** The prefix of the authorization header, `Bot` by default. */
  authPrefix?: 'Bot' | 'Bearer';
  /** The JSON body. For the bulk command routes an array is wrapped as `{ commands: [...] }`. */
  body?: unknown;
  /** Files to upload with a message. */
  files?: RawFile[];
  /** Extra headers. */
  headers?: Record<string, string>;
  /** Send `body` as it is, without encoding it as JSON. */
  passThroughBody?: boolean;
  /** The query string. */
  query?: URLSearchParams | Record<string, string | number | boolean | null | undefined>;
  /** The audit log reason, sent as the `X-Audit-Log-Reason` header (and in the body where Bisim reads it). */
  reason?: string | null;
  /** A signal to abort the request. */
  signal?: AbortSignal | null;
  /** Accepted for compatibility: Bisim's paths have no version. */
  versioned?: boolean;
}

/**
 * A request as the manager handles it.
 */
export interface InternalRequest extends RequestData {
  fullRoute: RouteLike;
  method: RequestMethod | `${RequestMethod}`;
}

/**
 * What was sent with a request, as errors report it.
 */
export interface RequestBody {
  files: RawFile[] | undefined;
  json: unknown;
}

/**
 * The rate limit a request ran into.
 */
export interface RateLimitData {
  /** How long until the limit lifts, in milliseconds. */
  timeToReset: number;
  /** How many requests the limit allows. */
  limit: number;
  /** The HTTP method. */
  method: string;
  /** The bucket the request was in. */
  hash: string;
  /** The full URL. */
  url: string;
  /** The route, with ids replaced. */
  route: string;
  /** The major parameter of the route (the channel, server, webhook or interaction id). */
  majorParameter: string;
  /** Whether this was the bot's global limit. */
  global: boolean;
  /** How long Bisim said to wait, in milliseconds. */
  retryAfter: number;
  /** Not used on Bisim, always 0. */
  sublimitTimeout: number;
  /** Which limit was hit. */
  scope: 'global' | 'shared' | 'user';
}

/**
 * Decides whether a rate limited request is rejected with a {@link RateLimitError} instead of waiting.
 */
export type RateLimitQueueFilter = (rateLimitData: RateLimitData) => boolean | Promise<boolean>;

/**
 * A request as the `response` event reports it.
 */
export interface APIRequest {
  method: string;
  path: RouteLike;
  route: string;
  options: RequestInit;
  data: Pick<InternalRequest, 'auth' | 'body' | 'files'>;
  retries: number;
}

/**
 * The options of a {@link REST} manager.
 */
export interface RESTOptions {
  /** Bisim's REST API, `https://api.bisim.gg/api` by default. */
  api: string;
  /** Bisim's CDN, `https://cdn.bisim.gg` by default. */
  cdn: string;
  /** Accepted for compatibility, Bisim's paths have no version. */
  version: string;
  /** The prefix of the authorization header, `Bot` by default. */
  authPrefix: 'Bot' | 'Bearer';
  /** How long a request may take before it is aborted and retried, in milliseconds. */
  timeout: number;
  /** How many times a failed request (network error or 5xx) is retried. */
  retries: number;
  /** Extra time to wait after a rate limit, in milliseconds. */
  offset: number;
  /** The most requests per second bisim.js sends, across all routes. Bisim allows 600 a minute per bot. */
  globalRequestsPerSecond: number;
  /** Rate limits to reject instead of waiting for. */
  rejectOnRateLimit: RateLimitQueueFilter | string[] | null;
  /** Text added to the user agent. */
  userAgentAppendix: string;
  /** Headers sent with every request. */
  headers: Record<string, string>;
  /** How long an unused bucket is kept, in milliseconds. */
  handlerSweepInterval: number;
  /** The fetch to use, the global one by default (handy for tests and proxies). */
  makeRequest: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * The events a {@link REST} manager emits.
 */
export interface RestEvents {
  rateLimited: [rateLimitInfo: RateLimitData];
  response: [request: APIRequest, response: Response];
  restDebug: [info: string];
  invalidRequestWarning: [invalidRequestInfo: { count: number; remainingTime: number }];
  handlerSweep: [sweptHandlers: Map<string, unknown>];
  hashSweep: [sweptHashes: Map<string, unknown>];
}

import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { DefaultURLs, DefaultUserAgent } from '../util/Constants.js';
import { toBisimCommand } from '../util/Transformers.js';
import { BisimAPIError, type BisimErrorData, HTTPError, RateLimitError } from './errors.js';
import { Routes, routeBucket } from './Routes.js';
import {
  type APIRequest,
  type InternalRequest,
  type RateLimitData,
  type RawFile,
  type RequestData,
  RequestMethod,
  type RESTOptions,
  type RestEvents,
  type RouteLike,
} from './types.js';

/**
 * The defaults of {@link RESTOptions}.
 */
export const DefaultRestOptions: RESTOptions = {
  api: DefaultURLs.api,
  cdn: DefaultURLs.cdn,
  version: '10',
  authPrefix: 'Bot',
  timeout: 15_000,
  retries: 3,
  offset: 50,
  globalRequestsPerSecond: 50,
  rejectOnRateLimit: null,
  userAgentAppendix: `Node.js ${process.version}`,
  headers: {},
  handlerSweepInterval: 3_600_000,
  makeRequest: (url, init) => fetch(url, init),
};

/**
 * An attachment as Bisim's message routes take it, after the upload.
 */
export interface UploadedAttachment {
  id: string;
  uploadFilename: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  description?: string;
  spoiler?: boolean;
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * A first in, first out lock: each request in a bucket waits for the one before it.
 */
class AsyncQueue {
  private readonly waiting: (() => void)[] = [];
  private busy = false;

  public get remaining(): number {
    return this.waiting.length + (this.busy ? 1 : 0);
  }

  public wait(): Promise<void> {
    if (!this.busy) {
      this.busy = true;
      return Promise.resolve();
    }
    return new Promise((resolve) => this.waiting.push(resolve));
  }

  public shift(): void {
    const next = this.waiting.shift();
    if (next) next();
    else this.busy = false;
  }
}

/**
 * One rate limit bucket: a route with its major parameter. Requests in it run one at a time, and wait when
 * the bucket is limited.
 */
class SequentialHandler {
  public resetAt = 0;
  public limit = Number.POSITIVE_INFINITY;
  public remaining = 1;
  public lastUsed = Date.now();
  private readonly queue = new AsyncQueue();

  public constructor(
    private readonly manager: REST,
    public readonly hash: string,
    public readonly majorParameter: string,
  ) {}

  public get inactive(): boolean {
    return this.queue.remaining === 0 && Date.now() > this.resetAt;
  }

  public async queueRequest(request: PreparedRequest): Promise<Response> {
    await this.queue.wait();
    try {
      return await this.runRequest(request, 0);
    } finally {
      this.lastUsed = Date.now();
      this.queue.shift();
    }
  }

  private async waitForLimits(request: PreparedRequest): Promise<void> {
    for (;;) {
      const now = Date.now();
      const globalWait = this.manager.globalReset - now;
      if (globalWait > 0) {
        this.manager.debug(`Waiting ${globalWait}ms for the global rate limit (${request.route})`);
        await sleep(globalWait);
        continue;
      }
      const bucketWait = this.resetAt - now;
      if (bucketWait > 0) {
        const data = this.rateLimitData(request, bucketWait, false);
        this.manager.emit('rateLimited', data);
        await this.maybeReject(data);
        await sleep(bucketWait);
        continue;
      }
      const { manager } = this;
      if (manager.globalWindowReset <= now) {
        // A new one second window: the global allowance starts over.
        manager.globalWindowReset = now + 1_000;
        manager.globalRemaining = manager.options.globalRequestsPerSecond;
      }
      if (manager.globalRemaining > 0) {
        manager.globalRemaining -= 1;
        return;
      }
      await sleep(Math.max(0, manager.globalWindowReset - now));
    }
  }

  private rateLimitData(request: PreparedRequest, wait: number, global: boolean): RateLimitData {
    const { method, url, route } = request;
    const { hash, majorParameter } = this;
    const limit = global ? this.manager.globalLimit : this.limit;
    return { timeToReset: wait, retryAfter: wait, sublimitTimeout: 0, limit, method, hash, url, route, majorParameter, global, scope: global ? 'global' : 'user' };
  }

  private async maybeReject(data: RateLimitData): Promise<void> {
    const filter = this.manager.options.rejectOnRateLimit;
    if (!filter) return;
    const reject =
      typeof filter === 'function'
        ? await filter(data)
        : filter.some((route) => data.route.startsWith(route.toLowerCase()) || data.url.includes(route));
    if (reject) throw new RateLimitError(data);
  }

  private async runRequest(request: PreparedRequest, retries: number): Promise<Response> {
    await this.waitForLimits(request);

    // One signal that fires on our timeout or when the caller's own signal aborts.
    const aborter = new AbortController();
    const abort = () => aborter.abort();
    const timeout = setTimeout(abort, this.manager.options.timeout);
    timeout.unref?.();
    const userSignal = request.data.signal;
    const onAbort = abort;
    if (userSignal?.aborted) abort();
    else userSignal?.addEventListener('abort', onAbort, { once: true });

    let res: Response;
    try {
      res = await this.manager.options.makeRequest(request.url, { ...request.init, signal: aborter.signal });
    } catch (error) {
      if (userSignal?.aborted) throw error;
      if (retries < this.manager.options.retries) {
        this.manager.debug(`Request to ${request.route} failed (${String(error)}), retry ${retries + 1}`);
        await sleep(Math.min(5_000, 500 * 2 ** retries));
        return this.runRequest(request, retries + 1);
      }
      throw error;
    } finally {
      clearTimeout(timeout);
      userSignal?.removeEventListener('abort', onAbort);
    }

    if (this.manager.listenerCount('response')) {
      const apiRequest: APIRequest = {
        method: request.method,
        path: request.path,
        route: request.route,
        options: request.init,
        data: { auth: request.data.auth, body: request.data.body, files: request.data.files },
        retries,
      };
      this.manager.emit('response', apiRequest, res.clone());
    }

    const limit = Number(res.headers.get('x-ratelimit-limit'));
    const remaining = res.headers.get('x-ratelimit-remaining');
    if (Number.isFinite(limit) && limit > 0) this.manager.globalLimit = limit;

    if (res.status === 429) {
      const raw = (await readBody(res)) as BisimErrorData | undefined;
      const headerWait = Number(res.headers.get('retry-after'));
      const bodyWait = typeof raw?.retryAfter === 'number' ? raw.retryAfter : Number.NaN;
      const seconds = Math.max(Number.isFinite(headerWait) ? headerWait : 0, Number.isFinite(bodyWait) ? bodyWait : 0) || 1;
      const wait = Math.ceil(seconds * 1_000) + this.manager.options.offset;
      // Bisim marks the bot's global limit with `global: true`; an exhausted global counter is the fallback.
      const global =
        raw?.global === true || res.headers.get('x-ratelimit-global') === 'true' || remaining === '0';
      const data = this.rateLimitData(request, wait, global);
      this.manager.emit('rateLimited', data);
      this.manager.debug(`429 on ${request.route}: waiting ${wait}ms (${global ? 'global' : 'route'})`);
      await this.maybeReject(data);
      if (global) this.manager.globalReset = Date.now() + wait;
      else this.resetAt = Date.now() + wait;
      return this.runRequest(request, retries);
    }

    if (res.status >= 500 && res.status < 600) {
      if (retries < this.manager.options.retries) {
        this.manager.debug(`${res.status} on ${request.route}, retry ${retries + 1}`);
        await sleep(Math.min(5_000, 1_000 * (retries + 1)));
        return this.runRequest(request, retries + 1);
      }
      throw new HTTPError(res.status, res.statusText, request.method, request.url, request.data);
    }

    if (!res.ok) {
      const raw = await readBody(res);
      if (raw && typeof raw === 'object' && !(raw instanceof ArrayBuffer)) {
        const data = raw as BisimErrorData;
        throw new BisimAPIError(data, data.code ?? res.status, res.status, request.method, request.url, request.data);
      }
      throw new HTTPError(res.status, res.statusText, request.method, request.url, request.data);
    }
    return res;
  }
}

interface PreparedRequest {
  method: string;
  url: string;
  path: RouteLike;
  route: string;
  init: RequestInit;
  data: InternalRequest;
}

async function readBody(res: Response): Promise<unknown> {
  const text = await res.text().catch(() => '');
  if (!text) return undefined;
  try {
    return JSON.parse(text);
  } catch {
    return new TextEncoder().encode(text).buffer;
  }
}

const CONTENT_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  avif: 'image/avif',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  mp3: 'audio/mpeg',
  ogg: 'audio/ogg',
  oga: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  m4a: 'audio/mp4',
  flac: 'audio/flac',
  txt: 'text/plain',
  md: 'text/markdown',
  csv: 'text/csv',
  log: 'text/plain',
  json: 'application/json',
  pdf: 'application/pdf',
  zip: 'application/zip',
  gz: 'application/gzip',
  html: 'text/html',
  js: 'text/javascript',
  ts: 'text/plain',
};

/**
 * Guesses a content type from a file name.
 *
 * @param name - The file name
 * @internal
 */
export function guessContentType(name: string): string {
  const extension = name.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPES[extension] ?? 'application/octet-stream';
}

/**
 * Reads file data of any supported kind into a Buffer.
 *
 * @internal
 */
export async function toBuffer(data: RawFile['data']): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  if (typeof data === 'string') return Buffer.from(data);
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (ArrayBuffer.isView(data)) return Buffer.from(data.buffer, data.byteOffset, data.byteLength);
  if (typeof Blob !== 'undefined' && data instanceof Blob) return Buffer.from(await data.arrayBuffer());
  if (data instanceof Readable || (data && typeof (data as unknown as Readable).pipe === 'function')) {
    const chunks: Buffer[] = [];
    for await (const chunk of data as unknown as Readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw new BisimjsError(ErrorCodes.ReqResourceType);
}

const BULK_COMMANDS_ROUTE = /^\/applications\/\d{1,20}(?:\/guilds\/\d{1,20})?\/commands$/;
const SINGLE_COMMAND_ROUTE = /^\/applications\/\d{1,20}(?:\/guilds\/\d{1,20})?\/commands\/\d{1,20}$/;
const MESSAGES_ROUTE = /^\/channels\/(\d{1,20})\/messages$/;
const REASON_IN_BODY = [
  /^DELETE \/guilds\/\d{1,20}\/members\/\d{1,20}$/,
  /^PUT \/guilds\/\d{1,20}\/bans\/\d{1,20}$/,
  /^PUT \/guilds\/\d{1,20}\/members\/\d{1,20}\/timeout$/,
];

/**
 * The REST manager: every request to Bisim's API goes through it, queued per route and paced by the rate
 * limits. Its methods take Bisim's paths, which {@link Routes} builds.
 *
 * @example
 * ```js
 * const { REST, Routes } = require('bisim.js');
 * const rest = new REST().setToken(process.env.TOKEN);
 * const me = await rest.get(Routes.user());
 * ```
 */
export class REST extends EventEmitter {
  /**
   * The options of this manager.
   */
  public readonly options: RESTOptions;

  /**
   * The rate limit buckets in use.
   */
  public readonly handlers = new Map<string, SequentialHandler>();

  /**
   * Until when every request waits, after Bisim answered a global 429 (a timestamp in milliseconds).
   */
  public globalReset = 0;

  /**
   * How many requests are left in the current second (see `globalRequestsPerSecond`).
   */
  public globalRemaining: number;

  /**
   * When the current second of `globalRequestsPerSecond` ends.
   *
   * @internal
   */
  public globalWindowReset = 0;

  /**
   * The global limit Bisim last reported in `X-RateLimit-Limit` (600 a minute for a bot).
   */
  public globalLimit = 600;

  private token: string | null = null;
  private sweeper: NodeJS.Timeout | null = null;

  /**
   * @param options - The options, all optional
   */
  public constructor(options: Partial<RESTOptions> = {}) {
    super();
    this.options = { ...DefaultRestOptions, ...options, headers: { ...DefaultRestOptions.headers, ...options.headers } };
    this.options.api = this.options.api.replace(/\/+$/, '');
    this.options.cdn = this.options.cdn.replace(/\/+$/, '');
    this.globalRemaining = this.options.globalRequestsPerSecond;
    if (this.options.handlerSweepInterval > 0 && Number.isFinite(this.options.handlerSweepInterval)) {
      this.sweeper = setInterval(() => this.sweepHandlers(), this.options.handlerSweepInterval);
      this.sweeper.unref?.();
    }
  }

  /**
   * Sets the bot token this manager sends.
   *
   * @param token - The bot token
   */
  public setToken(token: string): this {
    this.token = token.replace(/^(Bot|Bearer)\s+/i, '');
    return this;
  }

  /**
   * Stops the bucket sweeper. Call it when you are done with a manager you created yourself.
   */
  public clearHandlerSweeper(): void {
    if (this.sweeper) clearInterval(this.sweeper);
    this.sweeper = null;
  }

  private send(method: RequestMethod, fullRoute: RouteLike, options: RequestData): Promise<unknown> {
    return this.request({ ...options, method, fullRoute });
  }

  /**
   * Runs a GET request.
   *
   * @param fullRoute - The path, see {@link Routes}
   * @param options - The request options
   */
  public get(fullRoute: RouteLike, options: RequestData = {}): Promise<unknown> {
    return this.send(RequestMethod.Get, fullRoute, options);
  }

  /**
   * Runs a DELETE request.
   *
   * @param fullRoute - The path, see {@link Routes}
   * @param options - The request options
   */
  public delete(fullRoute: RouteLike, options: RequestData = {}): Promise<unknown> {
    return this.send(RequestMethod.Delete, fullRoute, options);
  }

  /**
   * Runs a POST request.
   *
   * @param fullRoute - The path, see {@link Routes}
   * @param options - The request options
   */
  public post(fullRoute: RouteLike, options: RequestData = {}): Promise<unknown> {
    return this.send(RequestMethod.Post, fullRoute, options);
  }

  /**
   * Runs a PUT request.
   *
   * @param fullRoute - The path, see {@link Routes}
   * @param options - The request options
   */
  public put(fullRoute: RouteLike, options: RequestData = {}): Promise<unknown> {
    return this.send(RequestMethod.Put, fullRoute, options);
  }

  /**
   * Runs a PATCH request.
   *
   * @param fullRoute - The path, see {@link Routes}
   * @param options - The request options
   */
  public patch(fullRoute: RouteLike, options: RequestData = {}): Promise<unknown> {
    return this.send(RequestMethod.Patch, fullRoute, options);
  }

  /**
   * Runs a request and parses the answer: JSON as an object, an empty answer as `undefined`, anything else as
   * an `ArrayBuffer`.
   *
   * @param options - The request
   */
  public async request(options: InternalRequest): Promise<unknown> {
    const res = await this.queueRequest(options);
    return parseResponse(res);
  }

  /**
   * Runs a request and returns the raw `Response`.
   *
   * @param options - The request
   */
  public raw(options: InternalRequest): Promise<Response> {
    return this.queueRequest(options);
  }

  /**
   * Uploads files to a channel through Bisim's presigned flow and returns what a message needs to carry them.
   *
   * @param channelId - The channel the files are for
   * @param files - The files
   */
  public async uploadFiles(channelId: string, files: RawFile[]): Promise<UploadedAttachment[]> {
    const prepared = await Promise.all(
      files.map(async (file) => {
        const data = await toBuffer(file.data);
        return { file, data, contentType: file.contentType ?? guessContentType(file.name) };
      }),
    );
    const presigned = (await this.post(Routes.channelAttachments(channelId), {
      body: {
        files: prepared.map(({ file, data, contentType }) => ({
          fileName: file.name,
          contentType,
          sizeBytes: data.byteLength,
        })),
      },
    })) as { attachments: { id: string; uploadUrl: string; uploadFilename: string }[] };
    const slots = presigned?.attachments ?? [];
    if (slots.length !== prepared.length) {
      throw new HTTPError(500, 'Bisim returned a different number of upload slots', 'POST', Routes.channelAttachments(channelId), {
        body: undefined,
        files,
      });
    }
    await Promise.all(
      slots.map(async (slot, index) => {
        const { file, data, contentType } = prepared[index]!;
        const res = await this.options.makeRequest(slot.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: data,
        });
        if (!res.ok) throw new HTTPError(res.status, res.statusText, 'PUT', slot.uploadUrl, { body: undefined, files: [file] });
      }),
    );
    return slots.map((slot, index) => {
      const { file, data, contentType } = prepared[index]!;
      const attachment: UploadedAttachment = {
        id: slot.id,
        uploadFilename: slot.uploadFilename,
        fileName: file.name,
        contentType,
        sizeBytes: data.byteLength,
      };
      if (file.description) attachment.description = file.description;
      if (file.spoiler || file.name.startsWith('SPOILER_')) attachment.spoiler = true;
      return attachment;
    });
  }

  /**
   * Writes a debug line.
   *
   * @internal
   */
  public debug(message: string): void {
    this.emit('restDebug', message);
  }

  private async queueRequest(request: InternalRequest): Promise<Response> {
    const prepared = await this.prepare(request);
    const { bucketRoute, majorParameter } = routeBucket(prepared.method, request.fullRoute);
    const key = `${bucketRoute}:${majorParameter}`;
    let handler = this.handlers.get(key);
    if (!handler) {
      handler = new SequentialHandler(this, bucketRoute, majorParameter);
      this.handlers.set(key, handler);
    }
    return handler.queueRequest(prepared);
  }

  private async prepare(request: InternalRequest): Promise<PreparedRequest> {
    const method = String(request.method).toUpperCase();
    const path = request.fullRoute;
    const routePath = path.split('?')[0]!;
    let body = request.body;

    if (BULK_COMMANDS_ROUTE.test(routePath) && method === 'PUT') {
      const list = Array.isArray(body) ? body : (body as { commands?: unknown[] } | undefined)?.commands;
      body = { commands: (list ?? []).map((command) => toBisimCommand(command)) };
    } else if (BULK_COMMANDS_ROUTE.test(routePath) && method === 'POST' && body && typeof body === 'object') {
      body = toBisimCommand(body);
    } else if (SINGLE_COMMAND_ROUTE.test(routePath) && method === 'PATCH' && body && typeof body === 'object') {
      body = toBisimCommand(body, true);
    }

    if (request.reason && REASON_IN_BODY.some((pattern) => pattern.test(`${method} ${routePath}`))) {
      body = { reason: request.reason, ...((body as object | undefined) ?? {}) };
    }

    if (request.files?.length) {
      const channelId = MESSAGES_ROUTE.exec(routePath)?.[1];
      if (!channelId || method !== 'POST') {
        throw new BisimjsError(ErrorCodes.NotSupported, `Uploading files with ${method} ${routePath}`);
      }
      const uploaded = await this.uploadFiles(channelId, request.files);
      const current = (body ?? {}) as { attachments?: unknown[] };
      body = { ...current, attachments: [...(current.attachments ?? []), ...uploaded] };
    }

    const userAgent = `${DefaultUserAgent} ${this.options.userAgentAppendix}`.trim();
    const headers: Record<string, string> = { 'User-Agent': userAgent, ...this.options.headers, ...request.headers };
    if (request.auth !== false) {
      if (!this.token) throw new BisimjsError(ErrorCodes.TokenMissing);
      const prefix = typeof request.auth === 'string' ? request.auth : (request.authPrefix ?? this.options.authPrefix);
      headers.Authorization = `${prefix} ${this.token}`;
    }
    if (request.reason) headers['X-Audit-Log-Reason'] = encodeURIComponent(request.reason);

    let payload: RequestInit['body'];
    if (body !== undefined && request.passThroughBody) {
      payload = body as RequestInit['body'];
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      headers['Content-Type'] = 'application/json';
    }

    let query = '';
    if (request.query) {
      const params =
        request.query instanceof URLSearchParams
          ? request.query
          : new URLSearchParams(
              Object.entries(request.query)
                .filter(([, value]) => value !== undefined && value !== null)
                .map(([key, value]) => [key, String(value)] as [string, string]),
            );
      const text = params.toString();
      if (text) query = `${path.includes('?') ? '&' : '?'}${text}`;
    }

    return {
      method,
      url: `${this.options.api}${path}${query}`,
      path,
      route: routeBucket(method, path).bucketRoute.slice(method.length + 1),
      init: { method, headers, body: payload },
      data: { ...request, body },
    };
  }

  private sweepHandlers(): void {
    const swept = new Map<string, unknown>();
    for (const [key, handler] of this.handlers) {
      if (handler.inactive && Date.now() - handler.lastUsed > this.options.handlerSweepInterval) {
        this.handlers.delete(key);
        swept.set(key, handler);
      }
    }
    if (swept.size) this.emit('handlerSweep', swept);
  }
}

/**
 * Parses a response: JSON as an object, an empty body as `undefined`, anything else as an `ArrayBuffer`.
 *
 * @param res - The response
 */
export async function parseResponse(res: Response): Promise<unknown> {
  if (res.headers.get('content-type')?.startsWith('application/json')) {
    const text = await res.text();
    return text ? JSON.parse(text) : undefined;
  }
  const buffer = await res.arrayBuffer();
  return buffer.byteLength ? buffer : undefined;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface REST {
  on<Event extends keyof RestEvents>(event: Event, listener: (...args: RestEvents[Event]) => void): this;
  once<Event extends keyof RestEvents>(event: Event, listener: (...args: RestEvents[Event]) => void): this;
  off<Event extends keyof RestEvents>(event: Event, listener: (...args: RestEvents[Event]) => void): this;
  emit<Event extends keyof RestEvents>(event: Event, ...args: RestEvents[Event]): boolean;
}

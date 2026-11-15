import { once } from 'node:events';
import type { AddressInfo } from 'node:net';
import { WebSocketServer, type WebSocket } from 'ws';
import { Client, type ClientOptions, GatewayIntentBits } from '../src/index.js';

export interface RecordedRequest {
  method: string;
  path: string;
  query: URLSearchParams;
  headers: Record<string, string>;
  body: any;
}

type RouteHandler = (request: RecordedRequest) => unknown | Response | Promise<unknown | Response>;

/**
 * A fake Bisim REST API: routes are `METHOD /path` with `:param` placeholders.
 */
export class FakeRest {
  public readonly requests: RecordedRequest[] = [];
  private readonly routes: { method: string; pattern: RegExp; handler: RouteHandler }[] = [];

  public on(route: string, handler: RouteHandler): this {
    const [method, path] = route.split(' ') as [string, string];
    const pattern = new RegExp(`^${path.replace(/:[a-zA-Z]+/g, '[^/]+')}$`);
    this.routes.unshift({ method, pattern, handler });
    return this;
  }

  public calls(route: string): RecordedRequest[] {
    const [method, path] = route.split(' ') as [string, string];
    const pattern = new RegExp(`^${path.replace(/:[a-zA-Z]+/g, '[^/]+')}$`);
    return this.requests.filter((request) => request.method === method && pattern.test(request.path));
  }

  public readonly fetch = async (url: string, init: RequestInit): Promise<Response> => {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/^\/api/, '');
    const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value]));
    let body: unknown = init.body;
    if (typeof body === 'string' && headers['content-type']?.includes('json')) body = JSON.parse(body);
    const request: RecordedRequest = { method: String(init.method ?? 'GET'), path, query: parsed.searchParams, headers, body };
    this.requests.push(request);
    const route = this.routes.find((candidate) => candidate.method === request.method && candidate.pattern.test(path));
    if (!route) {
      return new Response(JSON.stringify({ statusCode: 404, message: `Cannot ${request.method} /api${path}`, error: 'Not Found' }), {
        status: 404,
        headers: { 'content-type': 'application/json' },
      });
    }
    const result = await route.handler(request);
    if (result instanceof Response) return result;
    if (result === undefined) return new Response(null, { status: 204 });
    return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
  };
}

/**
 * A fake Bisim gateway: it says hello, answers heartbeats, confirms subscriptions with a presence snapshot,
 * and lets a test push events.
 */
export class FakeGateway {
  public readonly server: WebSocketServer;
  public readonly frames: any[] = [];
  public readonly tokens: string[] = [];
  public sockets: WebSocket[] = [];
  public refuseSubscribe = new Set<string>();
  /** Servers whose next subscribe is refused, once. */
  public refuseSubscribeOnce = new Set<string>();
  public heartbeatIntervalMs = 30_000;
  /** Whether a subscribe is answered with a presence snapshot (only with the GuildPresences intent on Bisim). */
  public presenceSnapshots = true;
  /** Close every new connection at once with this code, before hello, as Bisim does for refused intents. */
  public closeOnConnect: { code: number; reason: string } | null = null;

  public constructor() {
    this.server = new WebSocketServer({ port: 0, host: '127.0.0.1' });
    this.server.on('connection', (socket, request) => {
      const token = new URL(request.url ?? '/', 'http://localhost').searchParams.get('token') ?? '';
      this.tokens.push(token);
      this.sockets.push(socket);
      if (this.closeOnConnect) {
        socket.close(this.closeOnConnect.code, this.closeOnConnect.reason);
        return;
      }
      socket.send(JSON.stringify({ op: 1, d: { heartbeatIntervalMs: this.heartbeatIntervalMs } }));
      socket.on('message', (raw) => {
        const frame = JSON.parse(raw.toString());
        this.frames.push(frame);
        if (frame.op === 2) socket.send(JSON.stringify({ op: 3 }));
        if (frame.op === 4) {
          const guildId = frame.d.guildId as string;
          if (this.refuseSubscribe.has(guildId) || this.refuseSubscribeOnce.delete(guildId)) {
            socket.send(JSON.stringify({ op: 10, d: { message: 'forbidden', guildId } }));
            return;
          }
          if (!this.presenceSnapshots) return;
          this.dispatch('PRESENCE_SYNC', { guildId, presenceSync: { presences: [{ userId: '200', guildId, status: 'online' }] } }, socket);
        }
      });
    });
  }

  public async listening(): Promise<this> {
    if (!this.server.address()) await once(this.server, 'listening');
    return this;
  }

  public get url(): string {
    const { port } = this.server.address() as AddressInfo;
    return `ws://127.0.0.1:${port}/ws`;
  }

  public get socket(): WebSocket {
    return this.sockets[this.sockets.length - 1]!;
  }

  public dispatch(type: string, envelope: Record<string, unknown> = {}, socket: WebSocket = this.socket): void {
    socket.send(JSON.stringify({ op: 0, t: type, d: { type, ...envelope } }));
  }

  public send(frame: unknown, socket: WebSocket = this.socket): void {
    socket.send(JSON.stringify(frame));
  }

  public opFrames(op: number): any[] {
    return this.frames.filter((frame) => frame.op === op);
  }

  public async close(): Promise<void> {
    for (const socket of this.sockets) socket.terminate();
    this.server.close();
    await once(this.server, 'close').catch(() => undefined);
  }
}

export const BOT = { id: '100', username: 'testbot', displayName: 'Test Bot', avatarKey: null, bot: true };
export const GUILD_ID = '1000';
export const TEXT_ID = '1001';
export const VOICE_ID = '1002';
export const CATEGORY_ID = '1003';
export const ROLE_ID = '1100';

export function guildDetail(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: GUILD_ID,
    name: 'Test Server',
    iconKey: null,
    description: null,
    verificationLevel: 0,
    ownerId: '200',
    systemChannelId: TEXT_ID,
    afkChannelId: null,
    afkTimeout: 300,
    createdAt: '2026-06-02T00:00:00.000Z',
    permissions: String((1n << 10n) | (1n << 11n) | (1n << 13n)),
    myRoleIds: [GUILD_ID, ROLE_ID],
    memberCount: 42,
    roles: [
      { id: GUILD_ID, guildId: GUILD_ID, name: '@everyone', color: 0, position: 0, permissions: String((1n << 10n) | (1n << 11n)), hoist: false, mentionable: false, isEveryone: true },
      { id: ROLE_ID, guildId: GUILD_ID, name: 'Mods', color: 0xff0000, position: 1, permissions: String(1n << 13n), hoist: true, mentionable: true, isEveryone: false },
    ],
    channels: [
      { id: CATEGORY_ID, guildId: GUILD_ID, type: 'GUILD_CATEGORY', name: 'Text', topic: null, parentId: null, position: 0, nsfw: false, slowmodeSec: 0, lastMessageId: null, createdAt: '2026-06-02T00:00:00.000Z', permissions: '3072', isPrivate: false },
      { id: TEXT_ID, guildId: GUILD_ID, type: 'GUILD_TEXT', name: 'general', topic: 'Talk here', parentId: CATEGORY_ID, position: 0, nsfw: false, slowmodeSec: 0, lastMessageId: null, createdAt: '2026-06-02T00:00:00.000Z', permissions: '3072', isPrivate: false },
      { id: VOICE_ID, guildId: GUILD_ID, type: 'GUILD_VOICE', name: 'Lounge', topic: null, parentId: null, position: 1, nsfw: false, slowmodeSec: 0, lastMessageId: null, createdAt: '2026-06-02T00:00:00.000Z', permissions: '3072', isPrivate: false },
    ],
    ...overrides,
  };
}

export const MEMBERS = [
  { guildId: GUILD_ID, userId: BOT.id, nickname: null, roleIds: [GUILD_ID, ROLE_ID], joinedAt: '2026-07-01T00:00:00.000Z', timeoutUntil: null, user: BOT },
  { guildId: GUILD_ID, userId: '200', nickname: 'Owner', roleIds: [GUILD_ID], joinedAt: '2026-06-02T00:00:00.000Z', timeoutUntil: null, user: { id: '200', username: 'owner', displayName: 'The Owner', avatarKey: 'avatars/200.webp', bot: false } },
  { guildId: GUILD_ID, userId: '300', nickname: null, roleIds: [GUILD_ID], joinedAt: '2026-08-01T00:00:00.000Z', timeoutUntil: null, user: { id: '300', username: 'alice', displayName: null, avatarKey: null, bot: false } },
];

/**
 * A fake REST with the routes a bot needs to log in and load one server.
 */
export function standardRest(): FakeRest {
  const rest = new FakeRest();
  let pass = 0;
  rest
    .on('GET /auth/me', () => BOT)
    .on('GET /applications/@me', () => ({ id: BOT.id, name: 'Test Bot', description: 'A bot for tests', publicKey: 'ab'.repeat(32), interactionsUrl: null, botPublic: true }))
    .on('POST /applications/:id/gateway', () => ({ token: `pass-${++pass}`, expiresInMs: 900_000 }))
    .on('GET /guilds', () => [{ id: GUILD_ID, name: 'Test Server', ownerId: '200', iconKey: null, systemChannelId: TEXT_ID, afkChannelId: null, afkTimeout: 300, createdAt: '2026-06-02T00:00:00.000Z' }])
    .on('GET /guilds/:id', () => guildDetail())
    .on('GET /guilds/:id/members', () => MEMBERS)
    .on('GET /guilds/:id/members/:userId', (request) => MEMBERS.find((member) => request.path.endsWith(`/${member.userId}`)) ?? new Response(JSON.stringify({ code: 'UNKNOWN_MEMBER', message: 'Unknown member' }), { status: 404, headers: { 'content-type': 'application/json' } }))
    .on('GET /guilds/:id/emojis', () => [{ id: '1500', guildId: GUILD_ID, name: 'wave', objectKey: 'emojis/1500.png', creatorId: '200', createdAt: '2026-06-02T00:00:00.000Z' }])
    .on('GET /guilds/:id/voice-states', () => ({ states: [{ channelId: VOICE_ID, userId: '300', username: 'alice', displayName: 'alice', avatarKey: '', serverMuted: false, serverDeafened: false, selfMuted: true, selfDeafened: false, selfVideo: false, selfStream: false }] }))
    .on('GET /dms', () => []);
  return rest;
}

/**
 * Every intent, so a test client hears everything the fake gateway sends; tests about intents pass their own.
 */
export const ALL_INTENTS = Object.values(GatewayIntentBits).filter((bit): bit is number => typeof bit === 'number').reduce((all, bit) => all | bit, 0);

/**
 * Makes a client wired to the fakes.
 */
export function testClient(rest: FakeRest, gateway: FakeGateway, options: Partial<ClientOptions> = {}): Client {
  return new Client({
    intents: ALL_INTENTS,
    rest: { api: 'http://bisim.test/api', cdn: 'http://cdn.bisim.test', makeRequest: rest.fetch, offset: 0, handlerSweepInterval: 0 },
    ws: { gateway: gateway.url },
    ...options,
  });
}

export function waitFor<T = unknown>(emitter: { once(event: string, listener: (...args: any[]) => void): unknown }, event: string, timeout = 5_000): Promise<T[]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timed out waiting for ${event}`)), timeout);
    emitter.once(event, (...args: T[]) => {
      clearTimeout(timer);
      resolve(args);
    });
  });
}

export async function until(check: () => boolean, timeout = 5_000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeout) throw new Error('Timed out');
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

import { describe, expect, it, vi } from 'vitest';
import { BisimAPIError, HTTPError, REST, RateLimitError, Routes, SlashCommandBuilder } from '../src/index.js';
import type { RateLimitData } from '../src/index.js';

interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: unknown;
}

type Responder = (call: Call, index: number) => Response | Promise<Response>;

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? headers : { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

function fakeRest(responder: Responder, options: ConstructorParameters<typeof REST>[0] = {}) {
  const calls: Call[] = [];
  const rest = new REST({
    api: 'http://bisim.test/api',
    handlerSweepInterval: 0,
    retries: 2,
    offset: 0,
    ...options,
    makeRequest: async (url, init) => {
      const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>).map(([k, v]) => [k.toLowerCase(), v]));
      let body: unknown = init.body;
      if (typeof body === 'string' && headers['content-type']?.includes('json')) body = JSON.parse(body);
      const call = { url, method: String(init.method), headers, body };
      calls.push(call);
      return responder(call, calls.length - 1);
    },
  }).setToken('secret-token');
  return { rest, calls };
}

describe('REST', () => {
  it('sends the bot token and parses JSON', async () => {
    const { rest, calls } = fakeRest(() => json(200, { id: '1', username: 'bot' }));
    const me = await rest.get(Routes.user());
    expect(me).toEqual({ id: '1', username: 'bot' });
    expect(calls[0]!.url).toBe('http://bisim.test/api/auth/me');
    expect(calls[0]!.headers.authorization).toBe('Bot secret-token');
    expect(calls[0]!.headers['user-agent']).toMatch(/^BisimBot/);
  });

  it('adds the query string and omits auth when asked', async () => {
    const { rest, calls } = fakeRest(() => json(200, []));
    await rest.get(Routes.channelMessages('5'), { query: new URLSearchParams({ limit: '10', before: '9' }) });
    await rest.post(Routes.interactionCallback('7', 'tok'), { auth: false, body: { type: 4 } });
    expect(calls[0]!.url).toBe('http://bisim.test/api/channels/5/messages?limit=10&before=9');
    expect(calls[1]!.headers.authorization).toBeUndefined();
    expect(calls[1]!.body).toEqual({ type: 4 });
  });

  it('wraps the guide deploy script body for Bisim', async () => {
    const { rest, calls } = fakeRest((call) => json(200, (call.body as { commands: unknown[] }).commands.map((c, i) => ({ id: String(i), ...(c as object) }))));
    const commands = [
      new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!').toJSON(),
      { name: 'raw', description: 'Discord style', options: [{ type: 3, name: 'text', description: 'Text', required: true }] },
    ];
    const data = (await rest.put(Routes.applicationGuildCommands('100', '200'), { body: commands })) as unknown[];
    expect(data.length).toBe(2);
    expect(calls[0]!.method).toBe('PUT');
    expect(calls[0]!.url).toBe('http://bisim.test/api/applications/100/guilds/200/commands');
    expect(calls[0]!.body).toEqual({
      commands: [
        { name: 'ping', description: 'Replies with Pong!' },
        { name: 'raw', description: 'Discord style', options: [{ type: 'STRING', name: 'text', description: 'Text', required: true }] },
      ],
    });
  });

  it('puts the reason in the body where Bisim reads it', async () => {
    const { rest, calls } = fakeRest(() => json(200, { ok: true }));
    await rest.delete(Routes.guildMember('1', '2'), { reason: 'spam' });
    expect(calls[0]!.body).toEqual({ reason: 'spam' });
    expect(calls[0]!.headers['x-audit-log-reason']).toBe('spam');
  });

  it('throws BisimAPIError with the code Bisim sent', async () => {
    const { rest } = fakeRest(() => json(403, { message: 'Bots cannot call this', code: 'BOT_NOT_ALLOWED' }));
    const error = (await rest.get(Routes.guilds()).catch((err: unknown) => err)) as BisimAPIError;
    expect(error).toBeInstanceOf(BisimAPIError);
    expect(error.code).toBe('BOT_NOT_ALLOWED');
    expect(error.status).toBe(403);
    expect(error.method).toBe('GET');
    expect(error.message).toBe('Bots cannot call this');
    expect(error.name).toBe('BisimAPIError[BOT_NOT_ALLOWED]');
  });

  it('joins validation messages', async () => {
    const { rest } = fakeRest(() => json(400, { statusCode: 400, message: ['name is too long', 'bad type'], error: 'Bad Request' }));
    const error = (await rest.post(Routes.guildRoles('1'), { body: {} }).catch((err: unknown) => err)) as BisimAPIError;
    expect(error.code).toBe(400);
    expect(error.message).toBe('name is too long\nbad type');
  });

  it('waits on a route 429 using the body retryAfter, then retries', async () => {
    const limits: RateLimitData[] = [];
    const { rest, calls } = fakeRest((_call, index) =>
      index === 0
        ? json(429, { message: 'slow down', code: 'RATE_LIMITED', retryAfter: 0.05 }, { 'x-ratelimit-remaining': '420' })
        : json(200, { id: 'm1' }),
    );
    rest.on('rateLimited', (data) => limits.push(data));
    const started = Date.now();
    const message = await rest.post(Routes.channelMessages('9'), { body: { content: 'hi' } });
    expect(message).toEqual({ id: 'm1' });
    expect(calls).toHaveLength(2);
    expect(Date.now() - started).toBeGreaterThanOrEqual(45);
    expect(limits[0]!.global).toBe(false);
    expect(limits[0]!.majorParameter).toBe('9');
    expect(limits[0]!.route).toBe('/channels/:major/messages');
  });

  it('pauses every route on a global 429', async () => {
    let first = true;
    let limitedAt = 0;
    let meAt = 0;
    const { rest, calls } = fakeRest((call) => {
      if (first && call.url.endsWith('/guilds')) {
        first = false;
        limitedAt = Date.now();
        return json(429, { message: 'Too many requests', code: 'RATE_LIMITED', retryAfter: 0.1 }, { 'retry-after': '0.1', 'x-ratelimit-remaining': '0' });
      }
      if (call.url.endsWith('/auth/me')) meAt = Date.now();
      return json(200, { ok: true });
    });
    const limits: RateLimitData[] = [];
    rest.on('rateLimited', (data) => limits.push(data));
    const a = rest.get(Routes.guilds());
    while (limits.length === 0) await new Promise((resolve) => setTimeout(resolve, 2));
    await rest.get(Routes.user());
    expect(meAt - limitedAt).toBeGreaterThanOrEqual(95);
    await a;
    expect(limits[0]!.global).toBe(true);
    expect(calls.map((call) => call.url.replace('http://bisim.test/api', '')).sort()).toEqual(['/auth/me', '/guilds', '/guilds']);
  });

  it('rejects instead of waiting when rejectOnRateLimit says so', async () => {
    const { rest } = fakeRest(() => json(429, { message: 'slow', code: 'RATE_LIMITED', retryAfter: 5 }), {
      rejectOnRateLimit: ['/channels'],
    });
    await expect(rest.post(Routes.channelMessages('1'), { body: { content: 'x' } })).rejects.toBeInstanceOf(RateLimitError);
  });

  it('retries server errors, then throws HTTPError', async () => {
    const { rest, calls } = fakeRest((_call, index) => (index < 1 ? json(502, { message: 'bad gateway' }) : json(200, { ok: 1 })));
    await expect(rest.get(Routes.guild('1'))).resolves.toEqual({ ok: 1 });
    expect(calls).toHaveLength(2);

    const failing = fakeRest(() => json(503, { message: 'down' }), { retries: 1 });
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const promise = failing.rest.get(Routes.guild('1')).catch((err: unknown) => err);
    await vi.advanceTimersByTimeAsync(5_000);
    const error = await promise;
    vi.useRealTimers();
    expect(error).toBeInstanceOf(HTTPError);
    expect((error as HTTPError).status).toBe(503);
    expect(failing.calls).toHaveLength(2);
  });

  it('retries network errors', async () => {
    let attempts = 0;
    const { rest } = fakeRest(() => {
      attempts++;
      if (attempts === 1) throw new TypeError('fetch failed');
      return json(200, { ok: true });
    });
    await expect(rest.get(Routes.guilds())).resolves.toEqual({ ok: true });
    expect(attempts).toBe(2);
  });

  it('keeps requests of one bucket in order', async () => {
    const order: string[] = [];
    const { rest } = fakeRest(async (call) => {
      const content = (call.body as { content: string }).content;
      await new Promise((resolve) => setTimeout(resolve, content === 'first' ? 30 : 1));
      order.push(content);
      return json(200, { content });
    });
    await Promise.all([
      rest.post(Routes.channelMessages('1'), { body: { content: 'first' } }),
      rest.post(Routes.channelMessages('1'), { body: { content: 'second' } }),
    ]);
    expect(order).toEqual(['first', 'second']);
  });

  it('returns undefined for an empty answer', async () => {
    const { rest } = fakeRest(() => new Response(null, { status: 204 }));
    await expect(rest.delete(Routes.channelMessage('1', '2'))).resolves.toBeUndefined();
  });

  it('uploads files through the presigned flow', async () => {
    const { rest, calls } = fakeRest((call) => {
      if (call.url.endsWith('/channels/42/attachments')) {
        return json(201, { attachments: [{ id: 'a1', uploadUrl: 'https://s3.test/upload/a1', uploadFilename: 'a1-hello.txt' }] });
      }
      if (call.url.startsWith('https://s3.test/')) return new Response(null, { status: 200 });
      return json(201, { id: 'm1', attachments: [] });
    });
    await rest.post(Routes.channelMessages('42'), {
      body: { content: 'here' },
      files: [{ name: 'hello.txt', data: Buffer.from('hello'), description: 'greeting' }],
    });
    expect(calls).toHaveLength(3);
    expect(calls[0]!.body).toEqual({ files: [{ fileName: 'hello.txt', contentType: 'text/plain', sizeBytes: 5 }] });
    expect(calls[1]!.method).toBe('PUT');
    expect(calls[1]!.headers['content-type']).toBe('text/plain');
    expect(calls[1]!.headers.authorization).toBeUndefined();
    expect(calls[2]!.body).toEqual({
      content: 'here',
      attachments: [
        { id: 'a1', uploadFilename: 'a1-hello.txt', fileName: 'hello.txt', contentType: 'text/plain', sizeBytes: 5, description: 'greeting' },
      ],
    });
  });

  it('refuses files where Bisim takes none', async () => {
    const { rest } = fakeRest(() => json(200, {}));
    await expect(
      rest.post(Routes.guildRoles('1'), { body: { name: 'x' }, files: [{ name: 'a.txt', data: 'a' }] }),
    ).rejects.toThrow(/not supported on Bisim/);
  });

  it('throws when a route has no Bisim equivalent', () => {
    expect(() => Routes.threads('1')).toThrow(/not supported on Bisim/);
  });
});

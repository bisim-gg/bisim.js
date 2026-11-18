import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Client, Events } from '../src/index.js';
import { FakeGateway, FakeRest, GUILD_ID, standardRest, testClient, waitFor } from './helpers.js';

let gateway: FakeGateway;
let rest: FakeRest;
let client: Client<true>;

beforeEach(async () => {
  gateway = await new FakeGateway().listening();
  rest = standardRest();
  const instance = testClient(rest, gateway);
  const ready = waitFor(instance, Events.ClientReady);
  await instance.login('bot-token');
  await ready;
  client = instance as Client<true>;
});

afterEach(async () => {
  await client.destroy();
  await gateway.close();
});

/** A ban list that pages the way Bisim's does: by user id, ascending, at most 1000 a page. */
function serveBans(count: number): string[] {
  const ids = Array.from({ length: count }, (_, index) => String(5000 + index * 2));
  rest.on('GET /guilds/:id/bans', (request) => {
    const limit = Number(request.query.get('limit') ?? 1000);
    const after = request.query.get('after');
    const before = request.query.get('before');
    let rows = ids;
    if (before !== null && after === null) {
      rows = rows.filter((id) => BigInt(id) < BigInt(before)).slice(-limit);
    } else {
      rows = rows.filter((id) => BigInt(id) > BigInt(after ?? 0)).slice(0, limit);
    }
    return rows.map((userId) => ({ guildId: GUILD_ID, userId, reason: null, user: { id: userId, username: `u${userId}`, bot: false } }));
  });
  return ids;
}

describe('GuildBanManager.fetch', () => {
  it('reads every ban, a page of 1000 at a time after the last id', async () => {
    const ids = serveBans(2500);
    const bans = await client.guilds.cache.get(GUILD_ID)!.bans.fetch();
    expect([...bans.keys()]).toEqual(ids);
    const calls = rest.calls('GET /guilds/:id/bans');
    expect(calls.map((call) => [call.query.get('limit'), call.query.get('after')])).toEqual([
      ['1000', '0'],
      ['1000', ids[999]],
      ['1000', ids[1999]],
    ]);
  });

  it('stops after one call when the first page is short, and caches as asked', async () => {
    serveBans(3);
    const guild = client.guilds.cache.get(GUILD_ID)!;
    expect((await guild.bans.fetch({ cache: false })).size).toBe(3);
    expect(guild.bans.cache.size).toBe(0);
    expect(rest.calls('GET /guilds/:id/bans')).toHaveLength(1);
  });

  it('sends limit, before and after for one page', async () => {
    const ids = serveBans(50);
    const guild = client.guilds.cache.get(GUILD_ID)!;
    expect([...(await guild.bans.fetch({ limit: 10 })).keys()]).toEqual(ids.slice(0, 10));
    expect([...(await guild.bans.fetch({ limit: 5, after: ids[9] })).keys()]).toEqual(ids.slice(10, 15));
    expect([...(await guild.bans.fetch({ limit: 5, before: ids[30] })).keys()]).toEqual(ids.slice(25, 30));
    const calls = rest.calls('GET /guilds/:id/bans');
    expect(calls).toHaveLength(3);
    expect(Object.fromEntries(calls[1]!.query)).toEqual({ limit: '5', after: ids[9] });
    expect(Object.fromEntries(calls[2]!.query)).toEqual({ limit: '5', before: ids[30] });
  });

  it('does not loop on a server that ignores the cursor', async () => {
    const ids = Array.from({ length: 1000 }, (_, index) => String(7000 + index));
    rest.on('GET /guilds/:id/bans', () => ids.map((userId) => ({ guildId: GUILD_ID, userId, reason: null })));
    expect((await client.guilds.cache.get(GUILD_ID)!.bans.fetch()).size).toBe(1000);
    expect(rest.calls('GET /guilds/:id/bans')).toHaveLength(2);
  });

  it('finds one ban past the first page when the single ban route is missing', async () => {
    const ids = serveBans(1500);
    const ban = await client.guilds.cache.get(GUILD_ID)!.bans.fetch(ids[1400]!);
    expect(ban.user.id).toBe(ids[1400]);
  });
});

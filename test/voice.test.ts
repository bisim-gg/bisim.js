import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  Events,
  type Client,
  type GatewayVoiceServerUpdateDispatchData,
  type GatewayVoiceStateUpdateDispatchData,
  type InternalBisimGatewayAdapterImplementerMethods,
  type VoiceChannel,
} from '../src/index.js';
import { BOT, FakeGateway, type FakeRest, GUILD_ID, VOICE_ID, guildDetail, standardRest, testClient, until, waitFor } from './helpers.js';

const OTHER_VOICE = '1004';
const VIEW_CONNECT_SPEAK = String((1n << 10n) | (1n << 20n) | (1n << 21n));

let gateway: FakeGateway;
let rest: FakeRest;
let client: Client<true>;

/** What a voice library would see through the adapter. */
interface Seen {
  servers: GatewayVoiceServerUpdateDispatchData[];
  states: GatewayVoiceStateUpdateDispatchData[];
  destroyed: number;
  adapter: InternalBisimGatewayAdapterImplementerMethods;
}

function adapterOf(guildId = GUILD_ID): Seen {
  const guild = client.guilds.cache.get(guildId)!;
  const seen = { servers: [], states: [], destroyed: 0 } as unknown as Seen;
  seen.adapter = guild.voiceAdapterCreator({
    onVoiceServerUpdate: (data) => seen.servers.push(data),
    onVoiceStateUpdate: (data) => seen.states.push(data),
    destroy: () => {
      seen.destroyed++;
    },
  });
  return seen;
}

const op4 = (channelId: string | null, extra: Record<string, unknown> = {}) => ({
  op: 4,
  d: { guild_id: GUILD_ID, channel_id: channelId, self_mute: false, self_deaf: true, ...extra },
});

beforeEach(async () => {
  gateway = await new FakeGateway().listening();
  rest = standardRest();
  const voiceChannel = (id: string, name: string) => ({
    id,
    guildId: GUILD_ID,
    type: 'GUILD_VOICE',
    name,
    topic: null,
    parentId: null,
    position: 2,
    nsfw: false,
    slowmodeSec: 0,
    lastMessageId: null,
    createdAt: '2026-06-02T00:00:00.000Z',
    permissions: VIEW_CONNECT_SPEAK,
    isPrivate: false,
  });
  const detail = guildDetail();
  const channels = (detail.channels as Record<string, unknown>[]).filter((channel) => channel.id !== VOICE_ID);
  rest.on('GET /guilds/:id', () => ({ ...detail, channels: [...channels, voiceChannel(VOICE_ID, 'Lounge'), voiceChannel(OTHER_VOICE, 'Music')] }));
  rest.on('POST /channels/:id/voice/join', (request) => ({
    url: 'wss://voice.test',
    token: `lk-${request.path.split('/')[2]}`,
    canPublish: true,
    canVideo: false,
    canUseVoiceActivity: true,
    afkChannelId: null,
    afkTimeout: 300,
  }));
  rest.on('POST /channels/:id/voice/leave', () => ({ ok: true }));
  rest.on('PATCH /channels/:id/voice/state', () => ({ selfMuted: true, selfDeafened: false, selfVideo: false, selfStream: false }));
  rest.on('POST /channels/:id/soundboard/play', () => ({ ok: true }));
  client = testClient(rest, gateway) as Client<true>;
  const ready = waitFor(client, Events.ClientReady);
  await client.login('bot-token');
  await ready;
});

afterEach(async () => {
  await client?.destroy();
  await gateway.close();
});

describe('guild.voiceAdapterCreator', () => {
  it('joins over REST and hands the LiveKit address and token back, Discord-shaped', async () => {
    const seen = adapterOf();
    const servers: unknown[] = [];
    client.on(Events.VoiceServerUpdate, (data) => servers.push(data));
    expect(seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }))).toBe(true);
    await until(() => seen.servers.length === 1);
    expect(rest.calls('POST /channels/:id/voice/join')[0]!.body).toEqual({ selfMuted: false, selfDeafened: true });
    expect(seen.states[0]).toMatchObject({ guild_id: GUILD_ID, channel_id: VOICE_ID, user_id: BOT.id, self_deaf: true, self_mute: false });
    expect(seen.servers[0]).toEqual({ guild_id: GUILD_ID, channel_id: VOICE_ID, token: `lk-${VOICE_ID}`, endpoint: 'wss://voice.test', can_publish: true });
    expect(servers).toEqual([{ guildId: GUILD_ID, endpoint: 'wss://voice.test', token: `lk-${VOICE_ID}` }]);
    expect(client.voice.adapters.has(GUILD_ID)).toBe(true);
  });

  it('only updates the state for a change in the same channel, and joins again when asked to connect', async () => {
    const seen = adapterOf();
    seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }));
    await until(() => seen.servers.length === 1);
    seen.adapter.sendPayload(op4(VOICE_ID, { self_mute: true, self_deaf: false }));
    await until(() => rest.calls('PATCH /channels/:id/voice/state').length === 1);
    expect(rest.calls('PATCH /channels/:id/voice/state')[0]!.body).toEqual({ selfMuted: true, selfDeafened: false });
    await until(() => seen.states.length === 2);
    expect(seen.states[1]).toMatchObject({ channel_id: VOICE_ID, self_mute: true, self_deaf: false });
    seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }));
    await until(() => seen.servers.length === 2);
    expect(rest.calls('POST /channels/:id/voice/join')).toHaveLength(2);
  });

  it('leaves over REST when asked for no channel', async () => {
    const seen = adapterOf();
    seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }));
    seen.adapter.sendPayload(op4(null));
    await until(() => rest.calls('POST /channels/:id/voice/leave').length === 1);
    expect(rest.calls('POST /channels/:id/voice/leave')[0]!.path).toBe(`/channels/${VOICE_ID}/voice/leave`);
    await until(() => seen.states.at(-1)?.channel_id === null);
  });

  it('answers a refused join with no endpoint and the error', async () => {
    rest.on('POST /channels/:id/voice/join', () => new Response(JSON.stringify({ statusCode: 403, message: 'Missing Permissions' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    const seen = adapterOf();
    seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }));
    await until(() => seen.servers.length === 1);
    expect(seen.servers[0]).toMatchObject({ channel_id: VOICE_ID, endpoint: null, token: '' });
    expect(seen.servers[0]!.error).toBeInstanceOf(Error);
  });

  it('keeps the bot where it is when a switch to another channel is refused', async () => {
    const seen = adapterOf();
    seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }));
    await until(() => seen.servers.length === 1);
    rest.on('POST /channels/:id/voice/join', () => new Response(JSON.stringify({ statusCode: 403, message: 'Missing Access' }), { status: 403, headers: { 'content-type': 'application/json' } }));
    seen.adapter.sendPayload(op4(OTHER_VOICE, { connect: true }));
    await until(() => seen.states.length === 2);
    expect(seen.states[1]).toMatchObject({ channel_id: VOICE_ID });
    expect(seen.states[1]!.error).toBeInstanceOf(Error);
    expect(seen.servers).toHaveLength(1);
  });

  it("follows VOICE_MOVE for the bot: the new channel first, then the join's answer", async () => {
    const seen = adapterOf();
    seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }));
    await until(() => seen.servers.length === 1);
    gateway.dispatch('VOICE_MOVE', { userId: BOT.id, voiceMove: { guildId: GUILD_ID, fromChannelId: VOICE_ID, toChannelId: OTHER_VOICE } });
    await until(() => seen.servers.length === 2);
    expect(seen.states.map((state) => state.channel_id)).toEqual([VOICE_ID, OTHER_VOICE, OTHER_VOICE]);
    expect(seen.servers[1]).toMatchObject({ channel_id: OTHER_VOICE, token: `lk-${OTHER_VOICE}` });
    expect(rest.calls('POST /channels/:id/voice/join').at(-1)!.path).toBe(`/channels/${OTHER_VOICE}/voice/join`);
  });

  it('ignores a move from a channel the bot is not in', async () => {
    const seen = adapterOf();
    gateway.dispatch('VOICE_MOVE', { userId: BOT.id, voiceMove: { guildId: GUILD_ID, fromChannelId: VOICE_ID, toChannelId: OTHER_VOICE } });
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(seen.states).toHaveLength(0);
    expect(rest.calls('POST /channels/:id/voice/join')).toHaveLength(0);
  });

  it("passes on the bot's own voice state in its channel, with a moderator's locks", async () => {
    const seen = adapterOf();
    seen.adapter.sendPayload(op4(VOICE_ID, { connect: true }));
    await until(() => seen.servers.length === 1);
    gateway.dispatch('VOICE_STATE_UPDATE', { guildId: GUILD_ID, channelId: VOICE_ID, voiceState: { userId: BOT.id, serverMuted: true, selfDeafened: true } });
    await until(() => seen.states.length === 2);
    expect(seen.states[1]).toMatchObject({ channel_id: VOICE_ID, mute: true, deaf: false, self_deaf: true });
    // Another channel's state is stale news, and a leave of the bot's channel reads as no channel.
    gateway.dispatch('VOICE_STATE_UPDATE', { guildId: GUILD_ID, channelId: OTHER_VOICE, voiceState: { userId: BOT.id } });
    gateway.dispatch('VOICE_STATE_UPDATE', { guildId: GUILD_ID, channelId: VOICE_ID, voiceState: { userId: BOT.id, left: true } });
    await until(() => seen.states.length === 3);
    expect(seen.states[2]).toMatchObject({ channel_id: null });
    expect(client.guilds.cache.get(GUILD_ID)!.members.me!.voice.channelId).toBeNull();
  });

  it('refuses a payload it cannot read, and destroys every adapter with the client', async () => {
    const seen = adapterOf();
    expect(seen.adapter.sendPayload({ op: 2 })).toBe(false);
    expect(seen.adapter.sendPayload(op4(VOICE_ID, { guild_id: 'another' }))).toBe(false);
    await client.destroy();
    expect(seen.destroyed).toBe(1);
    expect(client.voice.adapters.size).toBe(0);
    expect(seen.adapter.sendPayload(op4(VOICE_ID))).toBe(false);
  });
});

describe('voice channels', () => {
  it('knows whether the bot may join and speak', () => {
    const lounge = client.channels.cache.get(VOICE_ID) as VoiceChannel;
    expect(lounge.joinable).toBe(true);
    expect(lounge.speakable).toBe(true);
    lounge._myPermissions = 1n << 10n;
    expect(lounge.joinable).toBe(false);
    expect(lounge.speakable).toBe(false);
  });

  it('plays a soundboard sound with sendSoundboardSound', async () => {
    const lounge = client.channels.cache.get(VOICE_ID) as VoiceChannel;
    await lounge.sendSoundboardSound({ soundId: '777' });
    await lounge.sendSoundboardSound('778');
    await lounge.sendSoundboardSound({ id: '779' });
    const calls = rest.calls('POST /channels/:id/soundboard/play');
    expect(calls.map((call) => [call.path, call.body.soundId])).toEqual([
      [`/channels/${VOICE_ID}/soundboard/play`, '777'],
      [`/channels/${VOICE_ID}/soundboard/play`, '778'],
      [`/channels/${VOICE_ID}/soundboard/play`, '779'],
    ]);
  });
});

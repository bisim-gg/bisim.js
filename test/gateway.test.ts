import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ChannelType,
  ChatInputCommandInteraction,
  Client,
  Events,
  GuildMember,
  Message,
  MessageFlags,
  MessageReaction,
  Partials,
  Status,
  TextChannel,
  Typing,
  User,
  VoiceState,
} from '../src/index.js';
import {
  BOT,
  CATEGORY_ID,
  FakeGateway,
  FakeRest,
  GUILD_ID,
  ROLE_ID,
  TEXT_ID,
  VOICE_ID,
  guildDetail,
  standardRest,
  testClient,
  until,
  waitFor,
} from './helpers.js';

let gateway: FakeGateway;
let rest: FakeRest;
let client: Client;

async function login(options = {}): Promise<Client<true>> {
  client = testClient(rest, gateway, options);
  const ready = waitFor<Client<true>>(client, Events.ClientReady);
  await client.login('bot-token');
  const [readyClient] = await ready;
  return readyClient!;
}

beforeEach(async () => {
  gateway = await new FakeGateway().listening();
  rest = standardRest();
});

afterEach(async () => {
  await client?.destroy();
  await gateway.close();
});

describe('login and bootstrap', () => {
  it('logs in, loads the servers and emits ClientReady once', async () => {
    let readyCount = 0;
    let oldReady = 0;
    client = testClient(rest, gateway);
    client.on(Events.ClientReady, () => readyCount++);
    client.on('ready', () => oldReady++);
    const ready = waitFor<Client<true>>(client, Events.ClientReady);
    const token = await client.login('Bot bot-token');
    expect(token).toBe('bot-token');
    const [readyClient] = await ready;

    expect(readyClient).toBe(client);
    expect(readyCount).toBe(1);
    expect(oldReady).toBe(1);
    expect(client.isReady()).toBe(true);
    expect(client.readyAt).toBeInstanceOf(Date);
    expect(client.user?.tag).toBe('testbot');
    expect(client.user?.bot).toBe(true);
    expect(client.application?.id).toBe(BOT.id);

    expect(rest.calls('POST /applications/:id/gateway')[0]!.path).toBe(`/applications/${BOT.id}/gateway`);
    expect(rest.requests[0]!.headers.authorization).toBe('Bot bot-token');
    expect(gateway.tokens).toEqual(['pass-1']);

    const presence = gateway.opFrames(7)[0];
    expect(presence.d.status).toBe('online');
    expect(gateway.opFrames(4)).toEqual([{ op: 4, d: { guildId: GUILD_ID } }]);

    const guild = client.guilds.cache.get(GUILD_ID)!;
    expect(guild.name).toBe('Test Server');
    expect(guild.memberCount).toBe(42);
    expect(guild.members.cache.size).toBe(3);
    expect(client.application?.verifyKey).toBe('ab'.repeat(32));
    expect(guild.members.me?.id).toBe(BOT.id);
    expect(guild.members.me?.roles.cache.has(ROLE_ID)).toBe(true);
    expect(guild.roles.everyone.id).toBe(GUILD_ID);
    expect(guild.emojis.cache.get('1500')?.url).toBe('http://cdn.bisim.test/emojis/1500.png');
    expect(guild.presences.cache.get('200')?.status).toBe('online');
    expect(guild.voiceStates.cache.get('300')?.channelId).toBe(VOICE_ID);

    const text = client.channels.cache.get(TEXT_ID) as TextChannel;
    expect(text).toBeInstanceOf(TextChannel);
    expect(text.type).toBe(ChannelType.GuildText);
    expect(text.isTextBased()).toBe(true);
    expect(text.parent?.id).toBe(CATEGORY_ID);
    expect(text.topic).toBe('Talk here');
    expect(text.url).toBe(`https://bisim.gg/channels/${GUILD_ID}/${TEXT_ID}`);
    expect(client.channels.cache.get(VOICE_ID)?.isVoiceBased()).toBe(true);
    expect(client.channels.cache.get(VOICE_ID)?.isTextBased()).toBe(false);
    expect(client.ws.status).toBe(Status.Ready);
  });

  it('measures the ping from the heartbeat', async () => {
    await login();
    await until(() => client.ws.ping >= 0);
    expect(client.ws.ping).toBeGreaterThanOrEqual(0);
    expect(gateway.opFrames(2).length).toBeGreaterThanOrEqual(1);
  });

  it('rejects login with a bad token', async () => {
    rest.on('GET /auth/me', () => new Response(JSON.stringify({ statusCode: 401, message: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } }));
    client = testClient(rest, gateway);
    await expect(client.login('nope')).rejects.toThrow(/invalid token/i);
  });

  it('holds events that arrive while loading and emits them after ready', async () => {
    rest.on('GET /guilds/:id/members', async () => {
      gateway.dispatch('MESSAGE_CREATE', {
        guildId: GUILD_ID,
        channelId: TEXT_ID,
        message: { id: '5000', channelId: TEXT_ID, guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, content: 'early', createdAt: '2026-11-14T10:00:00.000Z' },
      });
      await new Promise((resolve) => setTimeout(resolve, 50));
      return [];
    });
    const order: string[] = [];
    client = testClient(rest, gateway);
    client.on(Events.ClientReady, () => order.push('ready'));
    client.on(Events.MessageCreate, (message) => order.push(`message:${message.content}`));
    const ready = waitFor(client, Events.ClientReady);
    await client.login('bot-token');
    await ready;
    await until(() => order.length === 2);
    expect(order).toEqual(['message:early', 'ready']);
  });
});

describe('event mapping', () => {
  it('maps messages, edits and deletes', async () => {
    await login();
    const created = waitFor<Message>(client, Events.MessageCreate);
    gateway.dispatch('MESSAGE_CREATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: {
        id: '6000',
        channelId: TEXT_ID,
        guildId: GUILD_ID,
        authorId: '300',
        author: { id: '300', username: 'alice' },
        content: 'hi <@200> and <@&1100> in <#1001> @everyone',
        createdAt: '2026-11-14T10:00:00.000Z',
        attachments: [{ id: '7000', fileName: 'cat.png', contentType: 'image/png', sizeBytes: '1234', url: 'https://cdn.bisim.test/a/cat.png', width: 10, height: 20 }],
        embeds: [{ type: 'rich', title: 'Card', color: 255, authorName: 'Author', footerText: 'Foot', fields: [{ name: 'a', value: 'b' }] }],
      },
    });
    const [message] = await created;
    expect(message).toBeInstanceOf(Message);
    expect(message!.content).toContain('hi');
    expect(message!.author?.username).toBe('alice');
    expect(message!.guild?.id).toBe(GUILD_ID);
    expect(message!.channel.id).toBe(TEXT_ID);
    expect(message!.member?.id).toBe('300');
    expect(message!.inGuild()).toBe(true);
    expect(message!.url).toBe(`https://bisim.gg/channels/${GUILD_ID}/${TEXT_ID}/6000`);
    expect(message!.mentions.users.has('200')).toBe(true);
    expect(message!.mentions.roles.has(ROLE_ID)).toBe(true);
    expect(message!.mentions.channels.has(TEXT_ID)).toBe(true);
    expect(message!.mentions.everyone).toBe(true);
    expect(message!.attachments.get('7000')?.size).toBe(1234);
    expect(message!.attachments.get('7000')?.name).toBe('cat.png');
    expect(message!.embeds[0]!.title).toBe('Card');
    expect(message!.embeds[0]!.author?.name).toBe('Author');
    expect(message!.embeds[0]!.footer?.text).toBe('Foot');
    expect(message!.createdAt.toISOString()).toBe('2026-11-14T10:00:00.000Z');
    expect((client.channels.cache.get(TEXT_ID) as TextChannel).lastMessageId).toBe('6000');

    const updated = waitFor<Message>(client, Events.MessageUpdate);
    gateway.dispatch('MESSAGE_UPDATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: { id: '6000', channelId: TEXT_ID, guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, content: 'edited', editedAt: '2026-11-14T10:01:00.000Z', createdAt: '2026-11-14T10:00:00.000Z' },
    });
    const [oldMessage, newMessage] = await updated;
    expect(oldMessage!.content).toContain('hi');
    expect(newMessage!.content).toBe('edited');
    expect(newMessage).toBe(message);
    expect(newMessage!.editedAt?.toISOString()).toBe('2026-11-14T10:01:00.000Z');

    const deleted = waitFor<Message>(client, Events.MessageDelete);
    gateway.dispatch('MESSAGE_DELETE', { guildId: GUILD_ID, channelId: TEXT_ID, messageDelete: { id: '6000', channelId: TEXT_ID, guildId: GUILD_ID } });
    const [gone] = await deleted;
    expect(gone).toBe(message);
    expect((client.channels.cache.get(TEXT_ID) as TextChannel).messages.cache.has('6000')).toBe(false);
  });

  it('emits partial messages for uncached deletes only with Partials.Message', async () => {
    await login({ partials: [Partials.Message] });
    const deleted = waitFor<Message>(client, Events.MessageDelete);
    gateway.dispatch('MESSAGE_DELETE', { guildId: GUILD_ID, channelId: TEXT_ID, messageDelete: { id: '6100', channelId: TEXT_ID, guildId: GUILD_ID } });
    const [message] = await deleted;
    expect(message!.partial).toBe(true);
    expect(message!.id).toBe('6100');
  });

  it('maps reactions to (reaction, user)', async () => {
    await login();
    gateway.dispatch('MESSAGE_CREATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: { id: '6200', channelId: TEXT_ID, guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, content: 'react to me' },
    });
    await waitFor(client, Events.MessageCreate);
    const added = waitFor<MessageReaction | User>(client, Events.MessageReactionAdd);
    gateway.dispatch('MESSAGE_REACTION_ADD', { guildId: GUILD_ID, channelId: TEXT_ID, reaction: { messageId: '6200', channelId: TEXT_ID, guildId: GUILD_ID, userId: '200', emoji: '<:wave:1500>' } });
    const [reaction, user, details] = (await added) as [MessageReaction, User, { type: number; burst: boolean }];
    expect(reaction).toBeInstanceOf(MessageReaction);
    expect(reaction.count).toBe(1);
    expect(reaction.emoji.id).toBe('1500');
    expect(reaction.emoji.name).toBe('wave');
    expect(reaction.message.id).toBe('6200');
    expect(user.id).toBe('200');
    expect(details).toEqual({ type: 0, burst: false });

    const removed = waitFor<MessageReaction | User>(client, Events.MessageReactionRemove);
    gateway.dispatch('MESSAGE_REACTION_REMOVE', { guildId: GUILD_ID, channelId: TEXT_ID, reaction: { messageId: '6200', channelId: TEXT_ID, guildId: GUILD_ID, userId: '200', emoji: '<:wave:1500>' } });
    const [removedReaction] = (await removed) as [MessageReaction];
    expect(removedReaction.count).toBe(0);
  });

  it('maps member updates to (oldMember, newMember)', async () => {
    await login();
    const updated = waitFor<GuildMember>(client, Events.GuildMemberUpdate);
    gateway.dispatch('GUILD_MEMBER_UPDATE', {
      guildId: GUILD_ID,
      userId: '300',
      guildMember: { member: { userId: '300', nickname: 'Ally', roleIds: [GUILD_ID, ROLE_ID], joinedAt: '2026-08-01T00:00:00.000Z', user: { id: '300', username: 'alice' } } },
    });
    const [oldMember, newMember] = await updated;
    expect(oldMember!.nickname).toBeNull();
    expect(newMember!.nickname).toBe('Ally');
    expect(newMember!.displayName).toBe('Ally');
    expect(oldMember!.roles.cache.has(ROLE_ID)).toBe(false);
    expect(newMember!.roles.cache.has(ROLE_ID)).toBe(true);

    const removed = waitFor<GuildMember>(client, Events.GuildMemberRemove);
    gateway.dispatch('GUILD_MEMBER_REMOVE', { guildId: GUILD_ID, userId: '300', guildMemberRemove: { userId: '300' } });
    const [member] = await removed;
    expect(member!.id).toBe('300');
    expect(client.guilds.cache.get(GUILD_ID)!.memberCount).toBe(41);
  });

  it('maps typing, presence and voice', async () => {
    await login();
    const typing = waitFor<Typing>(client, Events.TypingStart);
    gateway.dispatch('TYPING_START', { guildId: GUILD_ID, channelId: TEXT_ID, typing: { channelId: TEXT_ID, guildId: GUILD_ID, userId: '300', timestamp: '1763114400000' } });
    const [typed] = await typing;
    expect(typed).toBeInstanceOf(Typing);
    expect(typed!.user.id).toBe('300');
    expect(typed!.channel.id).toBe(TEXT_ID);
    expect(typed!.member?.id).toBe('300');
    expect(typed!.inGuild()).toBe(true);

    const presence = waitFor(client, Events.PresenceUpdate);
    gateway.dispatch('PRESENCE_UPDATE', { guildId: GUILD_ID, presence: { userId: '200', guildId: GUILD_ID, status: 'dnd', customText: 'busy', activityType: 3, activityName: 'the server' } });
    const [oldPresence, newPresence] = (await presence) as any[];
    expect(oldPresence.status).toBe('online');
    expect(newPresence.status).toBe('dnd');
    expect(newPresence.activities.map((a: { type: number; name: string; state: string | null }) => [a.type, a.name, a.state])).toEqual([
      [4, 'Custom Status', 'busy'],
      [3, 'the server', null],
    ]);

    const voice = waitFor<VoiceState>(client, Events.VoiceStateUpdate);
    gateway.dispatch('VOICE_STATE_UPDATE', { guildId: GUILD_ID, channelId: VOICE_ID, voiceState: { userId: '300', left: true } });
    const [oldState, newState] = await voice;
    expect(oldState!.channelId).toBe(VOICE_ID);
    expect(oldState!.selfMute).toBe(true);
    expect(newState!.channelId).toBeNull();
  });

  it('builds slash command interactions and answers them', async () => {
    await login();
    rest.on('POST /interactions/:id/:token/callback', (request) => ({
      id: '9100',
      channelId: TEXT_ID,
      authorId: BOT.id,
      author: BOT,
      type: 'DEFAULT',
      content: request.body.data.content,
      createdAt: '2026-11-14T10:00:00.000Z',
      interaction: { name: 'echo', userId: '300', username: 'alice' },
    }));
    const created = waitFor<ChatInputCommandInteraction>(client, Events.InteractionCreate);
    gateway.dispatch('INTERACTION_CREATE', {
      userId: BOT.id,
      interaction: {
        payloadJson: JSON.stringify({
          id: '9000',
          type: 2,
          token: 'itoken',
          applicationId: BOT.id,
          guildId: GUILD_ID,
          channelId: TEXT_ID,
          member: { userId: '300', username: 'alice', displayName: null, avatarKey: null },
          data: {
            id: '8000',
            name: 'echo',
            options: [
              { name: 'text', type: 'STRING', value: 'hello' },
              { name: 'times', type: 'INTEGER', value: '3' },
              { name: 'loud', type: 'BOOLEAN', value: true },
              { name: 'target', type: 'USER', value: '200' },
              { name: 'where', type: 'CHANNEL', value: TEXT_ID },
              { name: 'role', type: 'ROLE', value: ROLE_ID },
            ],
          },
        }),
      },
    });
    const [interaction] = await created;
    expect(interaction).toBeInstanceOf(ChatInputCommandInteraction);
    expect(interaction!.isChatInputCommand()).toBe(true);
    expect(interaction!.isRepliable()).toBe(true);
    expect(interaction!.commandName).toBe('echo');
    expect(interaction!.user.username).toBe('alice');
    expect(interaction!.member?.id).toBe('300');
    expect(interaction!.guild?.id).toBe(GUILD_ID);
    expect(interaction!.inCachedGuild()).toBe(true);
    expect(interaction!.options.getString('text')).toBe('hello');
    expect(interaction!.options.getInteger('times')).toBe(3);
    expect(interaction!.options.getBoolean('loud')).toBe(true);
    expect(interaction!.options.getUser('target')?.username).toBe('owner');
    expect(interaction!.options.getMember('target')?.nickname).toBe('Owner');
    expect(interaction!.options.getChannel('where')?.id).toBe(TEXT_ID);
    expect(interaction!.options.getRole('role')?.name).toBe('Mods');
    expect(interaction!.toString()).toBe('/echo text:hello times:3 loud:true target:200 where:1001 role:1100');

    const reply = await interaction!.reply({ content: 'hello back', ephemeral: true, fetchReply: true });
    expect(reply).toBeInstanceOf(Message);
    expect(interaction!.replied).toBe(true);
    expect(interaction!.ephemeral).toBe(true);
    const callback = rest.calls('POST /interactions/:id/:token/callback')[0]!;
    expect(callback.path).toBe('/interactions/9000/itoken/callback');
    expect(callback.headers.authorization).toBeUndefined();
    expect(callback.body).toEqual({ type: 4, data: { content: 'hello back', flags: MessageFlags.Ephemeral } });
    await expect(interaction!.reply('again')).rejects.toThrow(/already been sent or deferred/);
  });

  it('maps user updates', async () => {
    await login();
    const updated = waitFor<User>(client, Events.UserUpdate);
    gateway.dispatch('USER_UPDATE', { userId: '300', userUpdate: { user: { id: '300', username: 'alice2', displayName: 'Alice' } } });
    const [oldUser, newUser] = await updated;
    expect(oldUser!.username).toBe('alice');
    expect(newUser!.username).toBe('alice2');
    expect(newUser!.displayName).toBe('Alice');
  });
});

describe('server changes', () => {
  it('diffs a GUILD_RESYNC and subscribes again', async () => {
    await login();
    rest.on('GET /guilds/:id', () =>
      guildDetail({
        name: 'Renamed',
        roles: [
          (guildDetail().roles as any[])[0],
          { ...(guildDetail().roles as any[])[1], name: 'Moderators' },
          { id: '1101', guildId: GUILD_ID, name: 'New Role', color: 0, position: 2, permissions: '0', hoist: false, mentionable: false, isEveryone: false },
        ],
        channels: [
          (guildDetail().channels as any[])[0],
          (guildDetail().channels as any[])[1],
          { id: '1004', guildId: GUILD_ID, type: 'GUILD_TEXT', name: 'news', topic: null, parentId: CATEGORY_ID, position: 1, nsfw: false, slowmodeSec: 0, lastMessageId: null, permissions: '3072' },
        ],
      }),
    );
    const events: string[] = [];
    client.on(Events.GuildUpdate, (_old, guild) => events.push(`guildUpdate:${guild.name}`));
    client.on(Events.GuildRoleUpdate, (oldRole, role) => events.push(`roleUpdate:${oldRole.name}->${role.name}`));
    client.on(Events.GuildRoleCreate, (role) => events.push(`roleCreate:${role.name}`));
    client.on(Events.ChannelCreate, (channel) => events.push(`channelCreate:${(channel as TextChannel).name}`));
    client.on(Events.ChannelDelete, (channel) => events.push(`channelDelete:${(channel as TextChannel).name}`));
    const subscribes = gateway.opFrames(4).length;
    gateway.dispatch('GUILD_RESYNC', { guildId: GUILD_ID, guildResync: {} });
    await until(() => gateway.opFrames(4).length === subscribes + 1 && events.length >= 5);
    expect(events.sort()).toEqual(['channelCreate:news', 'channelDelete:Lounge', 'guildUpdate:Renamed', 'roleCreate:New Role', 'roleUpdate:Mods->Moderators'].sort());
    expect(client.channels.cache.has(VOICE_ID)).toBe(false);
    expect(client.channels.cache.has('1004')).toBe(true);
  });

  it('refetches a server without subscribing again when an event names an unknown channel', async () => {
    await login();
    rest.on('GET /guilds/:id', () =>
      guildDetail({
        channels: [
          ...(guildDetail().channels as any[]),
          { id: '1005', guildId: GUILD_ID, type: 'GUILD_TEXT', name: 'fresh', topic: null, parentId: null, position: 3, nsfw: false, slowmodeSec: 0, lastMessageId: null, permissions: '3072' },
        ],
      }),
    );
    const subscribes = gateway.opFrames(4).length;
    const created = waitFor(client, Events.ChannelCreate);
    gateway.dispatch('MESSAGE_CREATE', {
      guildId: GUILD_ID,
      channelId: '1005',
      message: { id: '6300', channelId: '1005', guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, content: 'in a new channel' },
    });
    const [channel] = (await created) as TextChannel[];
    expect(channel!.name).toBe('fresh');
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(gateway.opFrames(4).length).toBe(subscribes);
  });

  it('treats a 404 on resync as GuildDelete', async () => {
    await login();
    rest.on('GET /guilds/:id', () => new Response(JSON.stringify({ message: 'Guild not found', statusCode: 404 }), { status: 404, headers: { 'content-type': 'application/json' } }));
    const deleted = waitFor(client, Events.GuildDelete);
    gateway.dispatch('GUILD_RESYNC', { guildId: GUILD_ID, guildResync: {} });
    const [guild] = (await deleted) as any[];
    expect(guild.id).toBe(GUILD_ID);
    expect(client.guilds.cache.has(GUILD_ID)).toBe(false);
    expect(client.channels.cache.has(TEXT_ID)).toBe(false);
  });

  it('loads and emits a server the bot joins', async () => {
    await login();
    rest.on('GET /guilds/:id', (request) =>
      request.path.endsWith('/2000')
        ? guildDetail({ id: '2000', name: 'Second', roles: [{ id: '2000', name: '@everyone', position: 0, permissions: '3072', isEveryone: true }], channels: [] })
        : guildDetail(),
    );
    const created = waitFor(client, Events.GuildCreate);
    gateway.dispatch('GUILD_JOIN', { userId: BOT.id, guildJoin: { guildId: '2000' } });
    const [guild] = (await created) as any[];
    expect(guild.name).toBe('Second');
    expect(client.guilds.cache.has('2000')).toBe(true);
    expect(gateway.opFrames(4).some((frame) => frame.d.guildId === '2000')).toBe(true);
  });
});

describe('reconnecting', () => {
  it('reconnects on op 9 with a new pass and resumes', async () => {
    await login();
    const reconnecting = waitFor(client, Events.ShardReconnecting);
    const resumed = waitFor(client, Events.ShardResume, 8_000);
    gateway.send({ op: 9 });
    await reconnecting;
    await resumed;
    expect(gateway.tokens).toEqual(['pass-1', 'pass-2']);
    expect(gateway.opFrames(4).filter((frame) => frame.d.guildId === GUILD_ID).length).toBe(2);
    expect(client.isReady()).toBe(true);
  });
});

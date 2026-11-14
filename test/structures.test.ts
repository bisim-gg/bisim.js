import { generateKeyPairSync, sign } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  ActionRowBuilder,
  AttachmentBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  Client,
  CommandInteractionOptionResolver,
  ApplicationCommandOptionType,
  Events,
  GuildMember,
  Message,
  ModalBuilder,
  ModalSubmitInteraction,
  OAuth2Scopes,
  OverwriteType,
  PermissionFlagsBits,
  PermissionsBitField,
  TextChannel,
  TextInputBuilder,
  TextInputStyle,
  AutocompleteInteraction,
  ActivityType,
  verifyKey,
  verifyKeySync,
  ComponentType,
  ChannelType,
} from '../src/index.js';
import { BOT, FakeGateway, FakeRest, GUILD_ID, ROLE_ID, TEXT_ID, standardRest, testClient, until, waitFor } from './helpers.js';

let gateway: FakeGateway;
let rest: FakeRest;
let client: Client<true>;

const messageData = (id: string, content: string, extra: Record<string, unknown> = {}) => ({
  id,
  channelId: TEXT_ID,
  authorId: BOT.id,
  author: BOT,
  type: 'DEFAULT',
  content,
  referencedMessageId: null,
  pinned: false,
  editedAt: null,
  createdAt: '2026-11-14T10:00:00.000Z',
  attachments: [],
  embeds: [],
  reactions: [],
  ...extra,
});

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

function dispatchInteraction(payload: Record<string, unknown>): void {
  gateway.dispatch('INTERACTION_CREATE', { userId: BOT.id, interaction: { payloadJson: JSON.stringify(payload) } });
}

describe('channels and messages', () => {
  it('sends, replies, edits, reacts and pins', async () => {
    let counter = 0;
    rest.on('POST /channels/:id/messages', (request) => messageData(String(9_000 + ++counter), request.body.content, { referencedMessageId: request.body.referencedMessageId ?? null }));
    rest.on('PATCH /channels/:id/messages/:mid', (request) => messageData(request.path.split('/').pop()!, request.body.content, { editedAt: '2026-11-14T10:05:00.000Z' }));
    rest.on('PUT /channels/:id/messages/:mid/reactions/:emoji', () => ({ ok: true }));
    rest.on('PUT /channels/:id/pins/:mid', () => ({ ok: true }));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;

    const sent = await channel.send('hello');
    expect(sent).toBeInstanceOf(Message);
    expect(sent.content).toBe('hello');
    expect(sent.guildId).toBe(GUILD_ID);

    const reply = await sent.reply({ content: 'a reply', embeds: [{ title: 'T' }] });
    expect(rest.calls('POST /channels/:id/messages')[1]!.body).toEqual({ content: 'a reply', embeds: [{ title: 'T' }], referencedMessageId: sent.id });
    expect(reply.reference?.messageId).toBe(sent.id);

    const edited = await sent.edit('changed');
    expect(edited.content).toBe('changed');
    expect(edited.editedTimestamp).not.toBeNull();

    const reaction = await sent.react('👍');
    expect(reaction.count).toBe(1);
    expect(reaction.me).toBe(true);
    expect(rest.calls('PUT /channels/:id/messages/:mid/reactions/:emoji')[0]!.path).toBe(`/channels/${TEXT_ID}/messages/${sent.id}/reactions/${encodeURIComponent('👍')}`);
    await sent.react('<:wave:1500>');
    expect(rest.calls('PUT /channels/:id/messages/:mid/reactions/:emoji')[1]!.path).toContain(encodeURIComponent('<:wave:1500>'));

    gateway.dispatch('MESSAGE_REACTION_ADD', { guildId: GUILD_ID, channelId: TEXT_ID, reaction: { messageId: sent.id, channelId: TEXT_ID, guildId: GUILD_ID, userId: BOT.id, emoji: '👍' } });
    await waitFor(client, Events.MessageReactionAdd);
    expect(sent.reactions.cache.get('👍')?.count).toBe(1);

    await sent.pin();
    expect(sent.pinned).toBe(true);
  });

  it('uploads files through the presigned flow when sending', async () => {
    rest.on('POST /channels/:id/attachments', (request) => ({
      attachments: request.body.files.map((file: { fileName: string }, index: number) => ({ id: `a${index}`, uploadUrl: `http://s3.test/upload/${index}`, uploadFilename: `u-${file.fileName}` })),
    }));
    const uploads: string[] = [];
    const original = rest.fetch;
    const wrapped = async (url: string, init: RequestInit) => {
      if (url.startsWith('http://s3.test/')) {
        uploads.push(`${init.method} ${url} ${(init.headers as Record<string, string>)['Content-Type']}`);
        return new Response(null, { status: 200 });
      }
      return original(url, init);
    };
    client.rest.options.makeRequest = wrapped;
    rest.on('POST /channels/:id/messages', (request) => messageData('9500', request.body.content ?? '', { attachments: [] }));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    await channel.send({ content: 'files', files: [new AttachmentBuilder(Buffer.from('abc'), { name: 'a.txt' }), { attachment: Buffer.from('png'), name: 'b.png' }] });
    expect(uploads).toEqual(['PUT http://s3.test/upload/0 text/plain', 'PUT http://s3.test/upload/1 image/png']);
    const body = rest.calls('POST /channels/:id/messages')[0]!.body;
    expect(body.attachments).toEqual([
      { id: 'a0', uploadFilename: 'u-a.txt', fileName: 'a.txt', contentType: 'text/plain', sizeBytes: 3 },
      { id: 'a1', uploadFilename: 'u-b.png', fileName: 'b.png', contentType: 'image/png', sizeBytes: 3 },
    ]);
  });

  it('fetches messages newest first and falls back when the single route is missing', async () => {
    rest.on('GET /channels/:id/messages', (request) => {
      if (request.query.get('around')) return [messageData('8002', 'around')];
      return [messageData('8001', 'older'), messageData('8003', 'newest'), messageData('8002', 'middle')];
    });
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const messages = await channel.messages.fetch({ limit: 3 });
    expect([...messages.keys()]).toEqual(['8003', '8002', '8001']);
    expect(rest.calls('GET /channels/:id/messages')[0]!.query.get('limit')).toBe('3');
    channel.messages.cache.clear();
    const single = await channel.messages.fetch('8002');
    expect(single.content).toBe('around');
  });

  it('bulk deletes, falling back to single deletes', async () => {
    rest.on('DELETE /channels/:id/messages/:mid', () => ({ ok: true }));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const deleted = await channel.bulkDelete(['1', '2']);
    expect([...deleted.keys()]).toEqual(['1', '2']);
    expect(rest.calls('POST /channels/:id/messages/bulk-delete')).toHaveLength(1);
    expect(rest.calls('DELETE /channels/:id/messages/:mid')).toHaveLength(2);
  });

  it('computes permissions with overwrites', async () => {
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    rest.on('GET /guilds/:g/channels/:c/overwrites', () => [
      { channelId: TEXT_ID, targetId: GUILD_ID, type: OverwriteType.Role, allow: '0', deny: String(PermissionFlagsBits.SendMessages) },
      { channelId: TEXT_ID, targetId: '300', type: OverwriteType.Member, allow: String(PermissionFlagsBits.SendMessages), deny: '0' },
    ]);
    await channel.permissionOverwrites.fetch();
    const owner = channel.guild.members.cache.get('200')!;
    const alice = channel.guild.members.cache.get('300')!;
    expect(channel.permissionsFor(owner)!.has(PermissionFlagsBits.Administrator)).toBe(true);
    expect(channel.permissionsFor(alice)!.has(PermissionFlagsBits.SendMessages)).toBe(true);
    expect(channel.permissionsFor(channel.guild.roles.everyone)!.has(PermissionFlagsBits.SendMessages)).toBe(false);
    expect(channel.permissionsFor(channel.guild.roles.everyone)!.has(PermissionFlagsBits.ViewChannel)).toBe(true);
    expect(channel.permissionsFor(client.user)!.has(PermissionFlagsBits.ViewChannel)).toBe(true);
    expect(alice.permissionsIn(channel).has(PermissionFlagsBits.SendMessages)).toBe(true);
    expect(alice.permissions).toBeInstanceOf(PermissionsBitField);
  });

  it('opens a DM and sends to a user', async () => {
    rest.on('POST /dms', (request) => ({ id: '4000', type: 'DM', name: null, lastMessageId: null, ownerId: null, iconKey: null, participants: [BOT, { id: request.body.userId, username: 'alice' }], requestGate: false, createdAt: '2026-11-14T10:00:00.000Z' }));
    rest.on('POST /channels/:id/messages', (request) => messageData('9700', request.body.content, { channelId: '4000' }));
    const alice = client.users.cache.get('300')!;
    const message = await alice.send('hi there');
    expect(message.channelId).toBe('4000');
    expect(alice.dmChannel?.recipientId).toBe('300');
    expect(message.inGuild()).toBe(false);
    expect(message.url).toBe('https://bisim.gg/channels/@me/4000/9700');
  });
});

describe('expressions', () => {
  it('uploads an emoji as multipart', async () => {
    rest.on('POST /guilds/:g/emojis', () => ({ id: '1600', guildId: GUILD_ID, name: 'party', objectKey: 'emojis/1600.png', creatorId: BOT.id, createdAt: '2026-11-14T10:00:00.000Z' }));
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const emoji = await guild.emojis.create({ attachment: Buffer.from([0x89, 0x50, 0x4e, 0x47]), name: 'party' });
    expect(emoji.toString()).toBe('<:party:1600>');
    expect(client.emojis.cache.get('1600')).toBe(emoji);
    const request = rest.calls('POST /guilds/:g/emojis')[0]!;
    expect(request.body).toBeInstanceOf(FormData);
    expect((request.body as FormData).get('name')).toBe('party');
    expect(((request.body as FormData).get('file') as Blob).size).toBe(4);
    expect(request.headers['content-type']).toBeUndefined();
  });
});

describe('members and roles', () => {
  it('adds a role with the single role route, and falls back to replacing the set', async () => {
    const alice = client.guilds.cache.get(GUILD_ID)!.members.cache.get('300')!;
    rest.on('PATCH /guilds/:g/members/:u', (request) => ({ guildId: GUILD_ID, userId: '300', nickname: null, roleIds: [GUILD_ID, ...request.body.roleIds], joinedAt: '2026-08-01T00:00:00.000Z', timeoutUntil: null, user: { id: '300', username: 'alice' } }));
    await alice.roles.add(ROLE_ID, 'promote');
    expect(rest.calls('PUT /guilds/:g/members/:u/roles/:r')).toHaveLength(1);
    expect(rest.calls('PATCH /guilds/:g/members/:u')[0]!.body).toEqual({ roleIds: [ROLE_ID] });
    expect(alice.roles.cache.has(ROLE_ID)).toBe(true);

    rest.on('PUT /guilds/:g/members/:u/roles/:r', () => ({ guildId: GUILD_ID, userId: '300', nickname: null, roleIds: [GUILD_ID, ROLE_ID, '1101'], joinedAt: '2026-08-01T00:00:00.000Z', timeoutUntil: null }));
    await alice.roles.add('1101');
    expect(alice._roles).toEqual([ROLE_ID, '1101']);
  });

  it('kicks, bans and times out with the reason in the body', async () => {
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const alice = guild.members.cache.get('300')!;
    rest.on('DELETE /guilds/:g/members/:u', () => ({ ok: true }));
    rest.on('PUT /guilds/:g/bans/:u', () => ({ ok: true }));
    rest.on('PUT /guilds/:g/members/:u/timeout', (request) => ({ guildId: GUILD_ID, userId: '300', nickname: null, roleIds: [GUILD_ID], joinedAt: '2026-08-01T00:00:00.000Z', timeoutUntil: request.body.until }));
    await alice.kick('spam');
    expect(rest.calls('DELETE /guilds/:g/members/:u')[0]!.body).toEqual({ reason: 'spam' });
    await alice.ban({ reason: 'more spam', deleteMessageSeconds: 3600 });
    expect(rest.calls('PUT /guilds/:g/bans/:u')[0]!.body).toEqual({ reason: 'more spam', deleteMessageSeconds: 3600 });
    await alice.timeout(60_000, 'cool down');
    expect(rest.calls('PUT /guilds/:g/members/:u/timeout')[0]!.body.reason).toBe('cool down');
    expect(alice.isCommunicationDisabled()).toBe(true);
    await alice.disableCommunicationDisabled();
    expect(rest.calls('PUT /guilds/:g/members/:u/timeout')[1]!.body.until).toBeNull();
    expect(alice.isCommunicationDisabled()).toBe(false);
  });

  it('knows role order and manageability', () => {
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const mods = guild.roles.cache.get(ROLE_ID)!;
    expect(mods.comparePositionTo(guild.roles.everyone)).toBeGreaterThan(0);
    expect(mods.position).toBe(1);
    expect(guild.roles.highest.id).toBe(ROLE_ID);
    expect(mods.toString()).toBe(`<@&${ROLE_ID}>`);
    expect(guild.roles.everyone.toString()).toBe('@everyone');
    const alice = guild.members.cache.get('300')!;
    expect(alice.manageable).toBe(true);
    expect(guild.members.cache.get('200')!.manageable).toBe(false);
  });
});

describe('interactions', () => {
  const base = {
    id: '9900',
    token: 'tok',
    applicationId: BOT.id,
    guildId: GUILD_ID,
    channelId: TEXT_ID,
    member: { userId: '300', username: 'alice', displayName: null, avatarKey: null },
  };

  it('defers then edits the reply, with a followup when @original is missing', async () => {
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    rest.on('POST /interactions/:id/:token/followup', (request) => messageData('9901', request.body.content));
    const created = waitFor<any>(client, Events.InteractionCreate);
    dispatchInteraction({ ...base, type: 2, data: { id: '1', name: 'slow', options: [] } });
    const [interaction] = await created;
    await interaction.deferReply({ ephemeral: true });
    expect(interaction.deferred).toBe(true);
    expect(rest.calls('POST /interactions/:id/:token/callback')[0]!.body).toEqual({ type: 5, data: { flags: 64 } });
    const message = await interaction.editReply('done');
    expect(message.content).toBe('done');
    expect(rest.calls('PATCH /interactions/:id/:token/messages/:mid')).toHaveLength(1);
    expect(rest.calls('POST /interactions/:id/:token/followup')[0]!.body).toEqual({ content: 'done', flags: 64 });
    const followUp = await interaction.followUp({ content: 'more' });
    expect(followUp).toBeInstanceOf(Message);
  });

  it('uses @original when the server has it', async () => {
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    rest.on('PATCH /interactions/:id/:token/messages/:mid', (request) => messageData('9902', request.body.content));
    const created = waitFor<any>(client, Events.InteractionCreate);
    dispatchInteraction({ ...base, id: '9910', type: 2, data: { id: '1', name: 'slow', options: [] } });
    const [interaction] = await created;
    await interaction.deferReply();
    await interaction.editReply({ content: 'filled', components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('b').setLabel('B').setStyle(ButtonStyle.Primary))] });
    const patch = rest.calls('PATCH /interactions/:id/:token/messages/:mid')[0]!;
    expect(patch.path).toBe('/interactions/9910/tok/messages/@original');
    expect(patch.body).toEqual({ content: 'filled', components: [{ type: 1, components: [{ type: 2, style: 1, label: 'B', customId: 'b' }] }] });
    expect(rest.calls('POST /interactions/:id/:token/followup')).toHaveLength(0);
  });

  it('handles buttons, updates and collectors', async () => {
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const message = channel.messages._add({ ...messageData('9950', 'pick one'), guildId: GUILD_ID, components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Yes', customId: 'yes' }] }] });
    const awaited = message.awaitMessageComponent({ time: 2_000, componentType: ComponentType.Button });
    dispatchInteraction({
      ...base,
      id: '9951',
      type: 3,
      message: { ...messageData('9950', 'pick one'), components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Yes', customId: 'yes' }] }] },
      data: { componentType: 2, customId: 'yes' },
    });
    const interaction = (await awaited) as ButtonInteraction;
    expect(interaction).toBeInstanceOf(ButtonInteraction);
    expect(interaction.isButton()).toBe(true);
    expect(interaction.customId).toBe('yes');
    expect(interaction.message.id).toBe('9950');
    expect(interaction.component?.data.label).toBe('Yes');
    await interaction.update({ content: 'chosen', components: [] });
    expect(rest.calls('POST /interactions/:id/:token/callback')[0]!.body).toEqual({ type: 7, data: { content: 'chosen', components: [] } });
  });

  it('shows a modal and reads the submission', async () => {
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    const created = waitFor<any>(client, Events.InteractionCreate);
    dispatchInteraction({ ...base, id: '9960', type: 2, data: { id: '1', name: 'form', options: [] } });
    const [command] = await created;
    const modal = new ModalBuilder()
      .setCustomId('feedback')
      .setTitle('Feedback')
      .addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder().setCustomId('text').setLabel('Text').setStyle(TextInputStyle.Paragraph)));
    await command.showModal(modal);
    expect(rest.calls('POST /interactions/:id/:token/callback')[0]!.body.type).toBe(9);
    const submitted = command.awaitModalSubmit({ time: 2_000, filter: (i: ModalSubmitInteraction) => i.customId === 'feedback' });
    dispatchInteraction({ ...base, id: '9961', type: 5, data: { customId: 'feedback', fields: [{ customId: 'text', value: 'great library' }] } });
    const submission = (await submitted) as ModalSubmitInteraction;
    expect(submission.isModalSubmit()).toBe(true);
    expect(submission.fields.getTextInputValue('text')).toBe('great library');
    expect(() => submission.fields.getTextInputValue('missing')).toThrow(/not found/);
  });

  it('answers autocomplete', async () => {
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    const created = waitFor<AutocompleteInteraction>(client, Events.InteractionCreate);
    dispatchInteraction({ ...base, id: '9970', type: 4, data: { id: '1', name: 'search', options: [{ name: 'query', type: 'STRING', value: 'bi', focused: true }] } });
    const [interaction] = await created;
    expect(interaction!.isAutocomplete()).toBe(true);
    expect(interaction!.options.getFocused()).toBe('bi');
    await interaction!.respond([{ name: 'bisim', value: 'bisim' }]);
    expect(rest.calls('POST /interactions/:id/:token/callback')[0]!.body).toEqual({ type: 8, data: { choices: [{ name: 'bisim', value: 'bisim' }] } });
  });

  it('reads subcommands and refuses missing options', () => {
    const resolver = new CommandInteractionOptionResolver(client, [
      {
        name: 'server',
        type: ApplicationCommandOptionType.SubcommandGroup,
        options: [{ name: 'roles', type: ApplicationCommandOptionType.Subcommand, options: [{ name: 'limit', type: ApplicationCommandOptionType.Integer, value: 5 }] }],
      },
    ]);
    expect(resolver.getSubcommandGroup()).toBe('server');
    expect(resolver.getSubcommand()).toBe('roles');
    expect(resolver.getInteger('limit')).toBe(5);
    expect(resolver.getString('missing')).toBeNull();
    expect(() => resolver.getString('missing', true)).toThrow(/Required option "missing" not found/);
    expect(() => resolver.getString('limit')).toThrow(/is of type/);
    expect(() => new CommandInteractionOptionResolver(client, []).getSubcommand()).toThrow(/No subcommand/);
  });

  it('builds DM interactions and context menu targets', async () => {
    const created = waitFor<any>(client, Events.InteractionCreate);
    dispatchInteraction({
      id: '9980',
      type: 2,
      token: 'tok',
      applicationId: BOT.id,
      channelId: '4100',
      user: { id: '300', username: 'alice' },
      data: { id: '2', name: 'User Info', type: 2, targetId: '200' },
    });
    const [interaction] = await created;
    expect(interaction.isUserContextMenuCommand()).toBe(true);
    expect(interaction.inGuild()).toBe(false);
    expect(interaction.member).toBeNull();
    expect(interaction.channel?.type).toBe(ChannelType.DM);
    expect(interaction.targetUser.username).toBe('owner');
  });
});

describe('client helpers', () => {
  it('generates the install link', () => {
    const link = client.generateInvite({ scopes: [OAuth2Scopes.Bot, OAuth2Scopes.ApplicationsCommands], permissions: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ViewChannel] });
    expect(link).toBe(`https://bisim.gg/oauth2/authorize?client_id=${BOT.id}&permissions=3072&scope=bot+applications.commands`);
    expect(() => client.generateInvite({ scopes: [] })).toThrow();
  });

  it('sends the presence with an activity', async () => {
    client.user.setActivity('with bisim.js', { type: ActivityType.Competing });
    await until(() => gateway.opFrames(7).length >= 2);
    expect(gateway.opFrames(7).at(-1).d).toEqual({ status: 'online', activity: { type: 5, name: 'with bisim.js' } });
    client.user.setPresence({ status: 'dnd', activities: [{ name: 'Custom Status', type: ActivityType.Custom, state: 'Coding' }] });
    await until(() => gateway.opFrames(7).length >= 3);
    expect(gateway.opFrames(7).at(-1).d).toEqual({ status: 'dnd', customText: 'Coding' });
    expect(client.user.presence.status).toBe('dnd');
  });

  it('registers commands with a bulk write', async () => {
    rest.on('PUT /applications/:id/guilds/:g/commands', (request) => request.body.commands.map((command: object, index: number) => ({ id: String(500 + index), appId: BOT.id, guildId: GUILD_ID, ...command })));
    const commands = await client.application.commands.set(
      [{ name: 'ping', description: 'Pong', options: [{ type: ApplicationCommandOptionType.String, name: 'x', description: 'X', required: true }] }],
      GUILD_ID,
    );
    expect(rest.calls('PUT /applications/:id/guilds/:g/commands')[0]!.body).toEqual({
      commands: [{ name: 'ping', description: 'Pong', options: [{ type: 'STRING', name: 'x', description: 'X', required: true }] }],
    });
    const ping = commands.first()!;
    expect(ping.name).toBe('ping');
    expect(ping.options[0]!.type).toBe(ApplicationCommandOptionType.String);
  });

  it('creates one command by rewriting the set when the single route is missing', async () => {
    rest.on('GET /applications/:id/commands', () => [{ id: '600', appId: BOT.id, guildId: null, name: 'old', description: 'Old', options: [], defaultMemberPermissions: null }]);
    rest.on('PUT /applications/:id/commands', (request) => request.body.commands.map((command: object, index: number) => ({ id: String(600 + index), appId: BOT.id, guildId: null, ...command })));
    const created = await client.application.commands.create({ name: 'new', description: 'New' });
    expect(created.name).toBe('new');
    expect(rest.calls('PUT /applications/:id/commands')[0]!.body.commands.map((command: { name: string }) => command.name)).toEqual(['old', 'new']);
  });
});

describe('verifyKey', () => {
  it('verifies Ed25519 signatures the way Bisim signs', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(12).toString('hex');
    const body = JSON.stringify({ type: 1 });
    const timestamp = '1763114400';
    const signature = sign(null, Buffer.from(timestamp + body), privateKey).toString('hex');
    await expect(verifyKey(body, signature, timestamp, raw)).resolves.toBe(true);
    expect(verifyKeySync(body, signature, '1763114401', raw)).toBe(false);
    expect(verifyKeySync(`${body} `, signature, timestamp, raw)).toBe(false);
    expect(verifyKeySync(body, 'zz', timestamp, raw)).toBe(false);
  });

  it('turns an Interactions URL body into an interaction', async () => {
    expect(client.handleInteraction({ id: '1', type: 1, token: 't', applicationId: BOT.id })).toEqual({ type: 1 });
    const created = waitFor<any>(client, Events.InteractionCreate);
    client.handleInteraction(JSON.stringify({ id: '2', type: 2, token: 't', applicationId: BOT.id, guildId: GUILD_ID, channelId: TEXT_ID, member: { userId: '300', username: 'alice' }, data: { id: '1', name: 'ping' } }));
    const [interaction] = await created;
    expect(interaction.commandName).toBe('ping');
    expect(interaction.member).toBeInstanceOf(GuildMember);
  });
});

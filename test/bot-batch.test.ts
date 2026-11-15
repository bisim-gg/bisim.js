import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AttachmentBuilder,
  AutoModerationActionType,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  BisimjsError,
  ChannelSelectMenuBuilder,
  Client,
  EmbedBuilder,
  ErrorCodes,
  Events,
  MentionableSelectMenuBuilder,
  Message,
  MessageFlags,
  REST,
  RoleSelectMenuBuilder,
  Routes,
  SoundboardSound,
  StringSelectMenuBuilder,
  TextChannel,
  UserSelectMenuBuilder,
  UserSelectMenuComponent,
  VoiceChannel,
  VoiceChannelEffect,
  WebhookClient,
  toBisimComponent,
} from '../src/index.js';
import type { RateLimitData } from '../src/index.js';
import { BOT, FakeGateway, FakeRest, GUILD_ID, TEXT_ID, VOICE_ID, standardRest, testClient, waitFor } from './helpers.js';

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
  createdAt: '2026-11-15T10:00:00.000Z',
  attachments: [],
  embeds: [],
  reactions: [],
  ...extra,
});

const attachmentData = (id: string, fileName: string) => ({
  id,
  kind: 'IMAGE',
  url: `http://cdn.bisim.test/attachments/${id}/${fileName}`,
  fileName,
  contentType: 'image/png',
  sizeBytes: 3,
  width: null,
  height: null,
  description: null,
  spoiler: false,
});

const interactionBase = {
  token: 'tok',
  applicationId: BOT.id,
  guildId: GUILD_ID,
  channelId: TEXT_ID,
  member: { userId: '300', username: 'alice', displayName: null, avatarKey: null },
};

/** Upload slots for the presigned flow, and the PUTs that follow them. */
function withUploads(): string[] {
  const puts: string[] = [];
  const slots = (request: { body: { files: { fileName: string }[] } }) => ({
    attachments: request.body.files.map((file, index) => ({ id: `u${index}`, uploadUrl: `http://s3.test/upload/${index}`, uploadFilename: `up-${file.fileName}` })),
  });
  rest.on('POST /channels/:id/attachments', slots);
  rest.on('POST /interactions/:id/:token/attachments', slots);
  rest.on('POST /webhooks/:id/:token/attachments', slots);
  rest.on('PUT /upload/:n', (request) => {
    puts.push(`${request.path} ${request.headers['content-type']}`);
    return new Response(null, { status: 200 });
  });
  return puts;
}

async function interaction(id: string, type = 2, extra: Record<string, unknown> = {}): Promise<any> {
  const created = waitFor<any>(client, Events.InteractionCreate);
  gateway.dispatch('INTERACTION_CREATE', {
    userId: BOT.id,
    interaction: { payloadJson: JSON.stringify({ ...interactionBase, id, type, data: { id: '1', name: 'cmd', options: [] }, ...extra }) },
  });
  const [created0] = await created;
  return created0;
}

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

describe('files in interaction answers, webhooks and edits', () => {
  it('uploads a reply\'s files with the interaction token and lets an embed show one by attachment://', async () => {
    const puts = withUploads();
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    const command = await interaction('9800');
    const embed = new EmbedBuilder().setTitle('Chart').setImage('attachment://chart.png').setThumbnail('attachment://missing.png');
    await command.reply({ embeds: [embed], files: [new AttachmentBuilder(Buffer.from('png'), { name: 'chart.png' })] });
    const slots = rest.calls('POST /interactions/:id/:token/attachments')[0]!;
    expect(slots.path).toBe('/interactions/9800/tok/attachments');
    expect(slots.headers.authorization).toBeUndefined();
    expect(slots.body).toEqual({ files: [{ fileName: 'chart.png', contentType: 'image/png', sizeBytes: 3 }] });
    expect(puts).toEqual(['/upload/0 image/png']);
    expect(rest.calls('POST /interactions/:id/:token/callback')[0]!.body).toEqual({
      type: 4,
      data: {
        embeds: [{ title: 'Chart', image: { url: 'attachment://chart.png' } }],
        attachments: [{ id: 'u0', uploadFilename: 'up-chart.png', fileName: 'chart.png', contentType: 'image/png', sizeBytes: 3 }],
      },
    });
  });

  it('fills a deferral with a file, keeps the files it names, and follows up with a poll', async () => {
    withUploads();
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    rest.on('PATCH /interactions/:id/:token/messages/:mid', (request) => messageData('9811', request.body.content ?? ''));
    rest.on('POST /interactions/:id/:token/followup', () => messageData('9812', ''));
    const command = await interaction('9810');
    await command.deferReply();
    await command.editReply({ content: 'report', files: [{ attachment: Buffer.from('abc'), name: 'report.txt' }] });
    expect(rest.calls('PATCH /interactions/:id/:token/messages/:mid')[0]!.body).toEqual({
      content: 'report',
      attachments: [{ id: 'u0', uploadFilename: 'up-report.txt', fileName: 'report.txt', contentType: 'text/plain', sizeBytes: 3 }],
    });
    await command.editReply({ attachments: ['555'], files: [{ attachment: Buffer.from('png'), name: 'b.png' }] });
    expect(rest.calls('PATCH /interactions/:id/:token/messages/:mid')[1]!.body.attachments).toEqual([
      { id: '555' },
      { id: 'u0', uploadFilename: 'up-b.png', fileName: 'b.png', contentType: 'image/png', sizeBytes: 3 },
    ]);
    await command.editReply('text only');
    expect(rest.calls('PATCH /interactions/:id/:token/messages/:mid')[2]!.body).toEqual({ content: 'text only' });

    await command.followUp({ poll: { question: { text: 'Lunch?' }, answers: [{ text: 'Pizza', emoji: '🍕' }, { text: 'Salad' }], duration: 2, allowMultiselect: false } });
    expect(rest.calls('POST /interactions/:id/:token/followup')[0]!.body).toEqual({
      poll: { question: 'Lunch?', answers: [{ text: 'Pizza', emoji: '🍕' }, { text: 'Salad' }], multiselect: false, durationHours: 2 },
    });
  });

  it('updates a component message with a new file', async () => {
    withUploads();
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    const button = await interaction('9820', 3, {
      message: messageData('9821', 'pick', { attachments: [attachmentData('700', 'old.png')], components: [{ type: 1, components: [{ type: 2, style: 1, label: 'Go', customId: 'go' }] }] }),
      data: { componentType: 2, customId: 'go' },
    });
    await button.update({ embeds: [new EmbedBuilder().setImage('attachment://old.png')], files: [{ attachment: Buffer.from('x'), name: 'new.txt' }], attachments: button.message.attachments.map((file: { id: string }) => file) });
    const body = rest.calls('POST /interactions/:id/:token/callback')[0]!.body;
    expect(body.type).toBe(7);
    expect(body.data.embeds).toEqual([{ image: { url: 'attachment://old.png' } }]);
    expect(body.data.attachments).toEqual([
      { id: '700' },
      { id: 'u0', uploadFilename: 'up-new.txt', fileName: 'new.txt', contentType: 'text/plain', sizeBytes: 1 },
    ]);
  });

  it('edits a bot message with files, and removes its files', async () => {
    withUploads();
    rest.on('PATCH /channels/:id/messages/:mid', (request) => messageData('9830', request.body.content ?? 'x'));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const message = channel.messages._add({ ...messageData('9830', 'x', { attachments: [attachmentData('701', 'keep.png')] }), guildId: GUILD_ID });
    await message.edit({ content: 'more', files: [{ attachment: Buffer.from('y'), name: 'add.txt' }], attachments: [message.attachments.first()!] });
    const first = rest.calls('PATCH /channels/:id/messages/:mid')[0]!;
    expect(rest.calls('POST /channels/:id/attachments')[0]!.headers.authorization).toMatch(/^Bot /);
    expect(first.body.attachments).toEqual([
      { id: '701' },
      { id: 'u0', uploadFilename: 'up-add.txt', fileName: 'add.txt', contentType: 'text/plain', sizeBytes: 1 },
    ]);
    await message.removeAttachments();
    expect(rest.calls('PATCH /channels/:id/messages/:mid')[1]!.body).toEqual({ attachments: [] });
  });

  it('sends, fetches, edits and deletes a webhook\'s messages with its token', async () => {
    withUploads();
    rest.on('POST /webhooks/:id/:token', (request) => messageData('9840', request.body.content ?? '', { webhookId: '880' }));
    rest.on('GET /webhooks/:id/:token/messages/:mid', () => messageData('9840', 'hi', { webhookId: '880', attachments: [attachmentData('702', 'a.png')] }));
    rest.on('PATCH /webhooks/:id/:token/messages/:mid', (request) => messageData('9840', request.body.content ?? 'hi', { webhookId: '880' }));
    rest.on('DELETE /webhooks/:id/:token/messages/:mid', () => ({ ok: true }));
    rest.on('GET /webhooks/:id', () => ({ id: '880', guildId: GUILD_ID, channelId: TEXT_ID, name: 'Hook', avatarKey: null, token: 'whtoken-0123456789abcdef' }));
    const webhook = await client.fetchWebhook('880');
    await webhook.send({ content: 'with a file', files: [{ attachment: Buffer.from('z'), name: 'z.txt' }], flags: MessageFlags.SuppressNotifications });
    const execute = rest.calls('POST /webhooks/:id/:token')[0]!;
    expect(execute.query.get('wait')).toBe('true');
    expect(execute.body).toEqual({
      content: 'with a file',
      flags: 4096,
      attachments: [{ id: 'u0', uploadFilename: 'up-z.txt', fileName: 'z.txt', contentType: 'text/plain', sizeBytes: 1 }],
    });
    expect(rest.calls('POST /webhooks/:id/:token/attachments')[0]!.headers.authorization).toBeUndefined();

    const fetched = await webhook.fetchMessage('9840');
    expect(fetched).toBeInstanceOf(Message);
    expect(fetched.attachments.first()?.name).toBe('a.png');
    const edited = await webhook.editMessage('9840', { content: 'changed', embeds: [new EmbedBuilder().setImage('attachment://a.png')], flags: MessageFlags.SuppressEmbeds });
    expect(edited.content).toBe('changed');
    expect(rest.calls('PATCH /webhooks/:id/:token/messages/:mid')[0]!.body).toEqual({ content: 'changed', embeds: [{ image: { url: 'attachment://a.png' } }], flags: 4 });
    await webhook.deleteMessage(fetched);
    expect(rest.calls('DELETE /webhooks/:id/:token/messages/:mid')[0]!.path).toBe('/webhooks/880/whtoken-0123456789abcdef/messages/9840');
    await expect(webhook.fetchMessage('9840', { threadId: '1' })).rejects.toThrow(/not supported on Bisim/);
  });

  it('gives a WebhookClient the same message routes and its allowedMentions', async () => {
    const calls = new FakeRest();
    calls.on('POST /webhooks/:id/:token', (request) => messageData('1', request.body.content));
    calls.on('PATCH /webhooks/:id/:token/messages/:mid', (request) => messageData('1', request.body.content));
    calls.on('GET /webhooks/:id/:token/messages/:mid', () => messageData('1', 'x'));
    const hook = new WebhookClient(
      { url: 'http://bisim.test/api/webhooks/880/whtoken-0123456789abcdef' },
      { allowedMentions: { parse: [] }, rest: { makeRequest: calls.fetch, handlerSweepInterval: 0 } },
    );
    await hook.send('hello @everyone');
    expect(calls.calls('POST /webhooks/:id/:token')[0]!.body).toEqual({ content: 'hello @everyone', allowedMentions: { parse: [] } });
    await hook.editMessage('1', { content: 'edited', allowedMentions: { users: ['300'] } });
    expect(calls.calls('PATCH /webhooks/:id/:token/messages/:mid')[0]!.body).toEqual({ content: 'edited', allowedMentions: { users: ['300'] } });
    expect((await hook.fetchMessage('1')).content).toBe('x');
    hook.destroy();
  });
});

describe('allowedMentions and flags', () => {
  it('sends the client default and lets a message override it', async () => {
    await client.destroy();
    client = testClient(rest, gateway, { allowedMentions: { parse: ['users'], repliedUser: false } }) as Client<true>;
    const ready = waitFor(client, Events.ClientReady);
    await client.login('bot-token');
    await ready;
    rest.on('POST /channels/:id/messages', (request) => messageData('9900', request.body.content));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    await channel.send('hi <@300> @everyone');
    await channel.send({ content: 'hi <@300>', allowedMentions: { users: ['300', '300', { id: '400' } as never], roles: [] } });
    const [first, second] = rest.calls('POST /channels/:id/messages');
    expect(first!.body.allowedMentions).toEqual({ parse: ['users'], repliedUser: false });
    expect(second!.body.allowedMentions).toEqual({ users: ['300', '400'], roles: [] });
  });

  it('sends silent and embedless messages, and reads the flags back', async () => {
    rest.on('POST /channels/:id/messages', (request) => messageData('9910', request.body.content, { flags: request.body.flags ?? 0 }));
    rest.on('PATCH /channels/:id/messages/:mid', (request) => messageData('9910', 'x', { flags: request.body.flags }));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const sent = await channel.send({ content: 'quiet', flags: MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications });
    expect(rest.calls('POST /channels/:id/messages')[0]!.body.flags).toBe(4100);
    expect(sent.flags.has(MessageFlags.SuppressNotifications)).toBe(true);
    await sent.suppressEmbeds(false);
    await sent.suppressEmbeds();
    const edits = rest.calls('PATCH /channels/:id/messages/:mid');
    expect(edits[0]!.body).toEqual({ flags: 0 });
    expect(edits[1]!.body).toEqual({ flags: 4 });
    await sent.edit({ content: 'edit', flags: MessageFlags.SuppressNotifications | MessageFlags.SuppressEmbeds });
    expect(edits.length).toBe(2);
    expect(rest.calls('PATCH /channels/:id/messages/:mid')[2]!.body).toEqual({ content: 'edit', flags: 4 });

    const created = waitFor<Message>(client, Events.MessageCreate);
    gateway.dispatch('MESSAGE_CREATE', { guildId: GUILD_ID, channelId: TEXT_ID, message: { ...messageData('9911', 'hidden'), guildId: GUILD_ID, flags: 4, embeds: undefined } });
    const [message] = await created;
    expect(message!.flags.has(MessageFlags.SuppressEmbeds)).toBe(true);
  });

  it('answers an interaction silently and ephemerally', async () => {
    rest.on('POST /interactions/:id/:token/callback', () => undefined);
    const command = await interaction('9920');
    await command.reply({ content: 'shh', flags: MessageFlags.Ephemeral | MessageFlags.SuppressNotifications, allowedMentions: { parse: [] } });
    expect(rest.calls('POST /interactions/:id/:token/callback')[0]!.body).toEqual({
      type: 4,
      data: { content: 'shh', allowedMentions: { parse: [] }, flags: 4160 },
    });
  });
});

describe('select menu default values', () => {
  it('builds them the discord.js way', () => {
    expect(new UserSelectMenuBuilder().setCustomId('u').addDefaultUsers('1', { id: '2' }).toJSON().defaultValues).toEqual([
      { id: '1', type: 'user' },
      { id: '2', type: 'user' },
    ]);
    expect(new RoleSelectMenuBuilder().setCustomId('r').addDefaultRoles(['3']).setDefaultRoles('4').toJSON().defaultValues).toEqual([{ id: '4', type: 'role' }]);
    expect(new ChannelSelectMenuBuilder().setCustomId('c').setDefaultChannels(TEXT_ID).toJSON().defaultValues).toEqual([{ id: TEXT_ID, type: 'channel' }]);
    const mentionable = new MentionableSelectMenuBuilder().setCustomId('m').addDefaultUsers('1').addDefaultRoles('2').addDefaultValues({ id: '3', type: 'user' });
    expect(mentionable.toJSON().defaultValues).toEqual([
      { id: '1', type: 'user' },
      { id: '2', type: 'role' },
      { id: '3', type: 'user' },
    ]);
    expect(() => new UserSelectMenuBuilder().setCustomId('u').addDefaultUsers(Array.from({ length: 26 }, (_, index) => String(index)))).toThrow(RangeError);
    expect(toBisimComponent({ type: 5, custom_id: 'u', default_values: [{ id: 9, type: 'user' }] })).toEqual({ type: 5, customId: 'u', defaultValues: [{ id: '9', type: 'user' }] });
    expect(new StringSelectMenuBuilder({ custom_id: 's', options: [{ label: 'A', value: 'a', default: true }] }).toJSON().options).toEqual([{ label: 'A', value: 'a', default: true }]);
  });

  it('reads them back from REST and from events', async () => {
    const row = { type: 1, components: [{ type: 5, customId: 'who', minValues: 1, maxValues: 2, defaultValues: [{ id: '300', type: 'user' }] }] };
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const message = channel.messages._add({ ...messageData('9930', 'pick', { components: [row] }), guildId: GUILD_ID });
    const component = message.components[0]!.components[0] as UserSelectMenuComponent;
    expect(component).toBeInstanceOf(UserSelectMenuComponent);
    expect(component.defaultValues).toEqual([{ id: '300', type: 'user' }]);

    const created = waitFor<Message>(client, Events.MessageCreate);
    gateway.dispatch('MESSAGE_CREATE', { guildId: GUILD_ID, channelId: TEXT_ID, message: { ...messageData('9931', 'pick'), guildId: GUILD_ID, components: [row] } });
    const [event] = await created;
    expect((event!.components[0]!.components[0] as UserSelectMenuComponent).defaultValues).toEqual([{ id: '300', type: 'user' }]);
  });
});

describe('reactions, bans, expressions and profiles', () => {
  it('removes every reaction of one emoji', async () => {
    rest.on('DELETE /channels/:id/messages/:mid/reactions/:emoji/all', () => ({ ok: true }));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const message = channel.messages._add({ ...messageData('9940', 'react', { reactions: [{ emoji: '👍', count: 2, me: false }, { emoji: '<:wave:1500>', count: 1, me: true }] }), guildId: GUILD_ID });
    const thumbs = message.reactions.cache.get('👍')!;
    expect(await thumbs.remove()).toBe(thumbs);
    await message.reactions.cache.get('1500')!.remove();
    const calls = rest.calls('DELETE /channels/:id/messages/:mid/reactions/:emoji/all');
    expect(calls[0]!.path).toBe(`/channels/${TEXT_ID}/messages/9940/reactions/${encodeURIComponent('👍')}/all`);
    expect(calls[1]!.path).toBe(`/channels/${TEXT_ID}/messages/9940/reactions/${encodeURIComponent('<:wave:1500>')}/all`);
    expect(Routes.channelMessageReactionAll('1', '2', 'x')).toBe('/channels/1/messages/2/reactions/x/all');
  });

  it('bans many users at once', async () => {
    rest.on('POST /guilds/:id/bulk-ban', (request) => ({ bannedUsers: request.body.userIds.slice(0, 1), failedUsers: request.body.userIds.slice(1) }));
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const result = await guild.bans.bulkCreate(['300', client.users.cache.get('200')!], { deleteMessageSeconds: 3600.7, reason: 'raid' });
    expect(result).toEqual({ bannedUsers: ['300'], failedUsers: ['200'] });
    const call = rest.calls('POST /guilds/:id/bulk-ban')[0]!;
    expect(call.body).toEqual({ userIds: ['300', '200'], deleteMessageSeconds: 3600, reason: 'raid' });
    expect(call.headers['x-audit-log-reason']).toBe('raid');
    const empty = (await guild.bans.bulkCreate([]).catch((error: unknown) => error)) as BisimjsError;
    expect(empty.code).toBe(ErrorCodes.BulkBanUsersOptionEmpty);
    expect(Routes.guildBulkBan(GUILD_ID)).toBe(`/guilds/${GUILD_ID}/bulk-ban`);
  });

  it('renames emoji and stickers, and still refuses what Bisim lacks', async () => {
    rest.on('PATCH /guilds/:id/emojis/:eid', (request) => ({ id: '1500', guildId: GUILD_ID, name: request.body.name, objectKey: 'emojis/1500.png', creatorId: '200' }));
    rest.on('PATCH /guilds/:id/stickers/:sid', (request) => ({ id: '1600', guildId: GUILD_ID, name: request.body.name, objectKey: 'stickers/1600.png', creatorId: '200' }));
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const emoji = guild.emojis.cache.get('1500')!;
    expect((await emoji.edit({ name: 'hello', reason: 'tidy' })).name).toBe('hello');
    expect(rest.calls('PATCH /guilds/:id/emojis/:eid')[0]!.headers['x-audit-log-reason']).toBe('tidy');
    expect((await emoji.setName('hi')).name).toBe('hi');
    await expect(emoji.edit({ roles: ['1'] })).rejects.toThrow(/not supported on Bisim/);
    const sticker = guild.stickers._add({ id: '1600', name: 'cat', objectKey: 'stickers/1600.png' });
    expect((await sticker.edit({ name: 'happy_cat' })).name).toBe('happy_cat');
    expect(rest.calls('PATCH /guilds/:id/stickers/:sid')[0]!.body).toEqual({ name: 'happy_cat' });
    await expect(guild.stickers.edit('1600', { tags: 'x' })).rejects.toThrow(/not supported on Bisim/);
  });

  it('sets and removes the bot\'s picture and banner, and a webhook\'s picture', async () => {
    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0]);
    rest.on('POST /users/@me/avatar', () => ({ ...BOT, avatarKey: 'avatars/100.webp', bannerKey: null }));
    rest.on('DELETE /users/@me/avatar', () => ({ ...BOT, avatarKey: null, bannerKey: null }));
    rest.on('POST /users/@me/banner', () => ({ ...BOT, avatarKey: null, bannerKey: 'banners/100.webp' }));
    await client.user.setAvatar(png);
    const upload = rest.calls('POST /users/@me/avatar')[0]!;
    expect(upload.headers.authorization).toMatch(/^Bot /);
    expect(upload.body).toBeInstanceOf(FormData);
    const file = (upload.body as FormData).get('file') as File;
    expect(file.name).toBe('image.png');
    expect(file.type).toBe('image/png');
    expect(client.user.avatar).toBe('avatars/100.webp');
    await client.user.setAvatar(null);
    expect(client.user.avatar).toBeNull();
    await client.user.edit({ banner: 'data:image/jpeg;base64,/9j/AA==' });
    expect(((rest.calls('POST /users/@me/banner')[0]!.body as FormData).get('file') as File).type).toBe('image/jpeg');
    expect(client.user.banner).toBe('banners/100.webp');

    const webhookData = { id: '880', guildId: GUILD_ID, channelId: TEXT_ID, name: 'Hook', avatarKey: null, token: 'whtoken-0123456789abcdef' };
    rest.on('POST /channels/:id/webhooks', (request) => ({ ...webhookData, name: request.body.name }));
    rest.on('POST /webhooks/:id/avatar', () => ({ ...webhookData, avatarKey: 'webhooks/880.webp' }));
    rest.on('DELETE /webhooks/:id/avatar', () => webhookData);
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const webhook = await channel.createWebhook({ name: 'Hook', avatar: png });
    expect(webhook.avatar).toBe('webhooks/880.webp');
    expect(rest.calls('POST /webhooks/:id/avatar')[0]!.headers.authorization).toMatch(/^Bot /);
    await webhook.edit({ avatar: null });
    expect(webhook.avatar).toBeNull();
    expect(rest.calls('PATCH /webhooks/:id')).toHaveLength(0);
  });

  it('sets a voice channel\'s status', async () => {
    rest.on('PUT /channels/:id/voice-status', (request) => ({ channelId: VOICE_ID, status: request.body.status }));
    const voice = client.channels.cache.get(VOICE_ID) as VoiceChannel;
    expect(await voice.setStatus('Now playing: tests', 'music')).toBe(voice);
    const call = rest.calls('PUT /channels/:id/voice-status')[0]!;
    expect(call.body).toEqual({ status: 'Now playing: tests' });
    expect(call.headers['x-audit-log-reason']).toBe('music');
  });
});

describe('soundboard events', () => {
  it('caches sounds from events and emits discord.js\'s soundboard events', async () => {
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const sound = { id: '7700', guildId: GUILD_ID, name: 'airhorn', objectKey: 'sounds/7700.ogg', emojiName: '📣', volume: 80, durationMs: 1200, creatorId: '200' };
    const created = waitFor<SoundboardSound>(client, Events.GuildSoundboardSoundCreate);
    gateway.dispatch('GUILD_SOUND_CREATE', { guildId: GUILD_ID, sound });
    const [made] = await created;
    expect(made).toBeInstanceOf(SoundboardSound);
    expect(made!.soundId).toBe('7700');
    expect(made!.volume).toBe(0.8);
    expect(made!.emoji?.name).toBe('📣');
    expect(made!.url).toBe('http://cdn.bisim.test/sounds/7700.ogg');
    expect(guild.soundboardSounds.cache.get('7700')).toBe(made);

    const updated = waitFor<any>(client, Events.GuildSoundboardSoundUpdate);
    gateway.dispatch('GUILD_SOUND_UPDATE', { guildId: GUILD_ID, sound: { ...sound, name: 'horn', volume: undefined, emojiName: undefined } });
    const [old, now] = await updated;
    expect(old.name).toBe('airhorn');
    expect(now.name).toBe('horn');
    expect(now.volume).toBe(0);
    expect(now.emoji).toBeNull();

    const played = waitFor<VoiceChannelEffect>(client, Events.VoiceChannelEffectSend);
    gateway.dispatch('SOUNDBOARD_PLAY', { guildId: GUILD_ID, channelId: VOICE_ID, userId: '300', soundboardPlay: { userId: '300', sound } });
    const [effect] = await played;
    expect(effect).toBeInstanceOf(VoiceChannelEffect);
    expect(effect!.soundId).toBe('7700');
    expect(effect!.soundVolume).toBe(0.8);
    expect(effect!.userId).toBe('300');
    expect(effect!.channel?.id).toBe(VOICE_ID);
    expect(effect!.soundboardSound?.name).toBe('airhorn');

    const deleted = waitFor<SoundboardSound>(client, Events.GuildSoundboardSoundDelete);
    gateway.dispatch('GUILD_SOUND_DELETE', { guildId: GUILD_ID, soundDelete: { soundId: '7700' } });
    const [gone] = await deleted;
    expect(gone!.soundId).toBe('7700');
    expect(guild.soundboardSounds.cache.has('7700')).toBe(false);
  });

  it('fetches and edits sounds through the guild', async () => {
    rest.on('GET /guilds/:id/sounds', () => [{ id: '7701', guildId: GUILD_ID, name: 'boop', objectKey: 'sounds/7701.ogg', emojiName: null, volume: 100, durationMs: 400, creatorId: null }]);
    rest.on('PATCH /guilds/:id/sounds/:sid', (request) => ({ id: '7701', guildId: GUILD_ID, name: request.body.name ?? 'boop', objectKey: 'sounds/7701.ogg', emojiName: null, volume: request.body.volume ?? 100, durationMs: 400, creatorId: null }));
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const boop = await guild.soundboardSounds.fetch('7701');
    expect(boop.volume).toBe(1);
    await boop.edit({ volume: 0.25, name: 'beep' });
    expect(rest.calls('PATCH /guilds/:id/sounds/:sid')[0]!.body).toEqual({ name: 'beep', volume: 25 });
    expect(boop.name).toBe('beep');
    await expect(boop.edit({ emojiId: '1' })).rejects.toThrow(/not supported on Bisim/);
  });
});

describe('AutoMod rules', () => {
  const ruleData = (overrides: Record<string, unknown> = {}) => ({
    id: '5100',
    guildId: GUILD_ID,
    name: 'No invites',
    enabled: true,
    eventType: 'MESSAGE_SEND',
    triggerType: 'KEYWORD',
    keywords: ['*discord.gg*'],
    regexPatterns: [],
    presets: [],
    allowList: [],
    mentionLimit: null,
    blockMessage: true,
    blockReason: 'No invites here',
    alertChannelId: null,
    timeoutSec: null,
    exemptRoles: [],
    exemptChannels: [],
    creatorId: BOT.id,
    createdAt: '2026-11-15T10:00:00.000Z',
    updatedAt: '2026-11-15T10:00:00.000Z',
    ...overrides,
  });

  it('creates, fetches, edits and deletes rules in Discord\'s words', async () => {
    rest.on('POST /guilds/:id/automod/rules', (request) => ruleData({ ...request.body, id: '5100' }));
    rest.on('GET /guilds/:id/automod/rules', () => [ruleData(), ruleData({ id: '5101', triggerType: 'KEYWORD_PRESET', presets: ['PROFANITY', 'SLURS'], keywords: [] })]);
    rest.on('PATCH /guilds/:id/automod/rules/:rid', (request) => ruleData({ ...request.body }));
    rest.on('DELETE /guilds/:id/automod/rules/:rid', () => ({ ok: true }));
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const rule = await guild.autoModerationRules.create({
      name: 'No invites',
      eventType: AutoModerationRuleEventType.MessageSend,
      triggerType: AutoModerationRuleTriggerType.Keyword,
      triggerMetadata: { keywordFilter: ['*discord.gg*'] },
      actions: [{ type: AutoModerationActionType.BlockMessage, metadata: { customMessage: 'No invites here' } }],
      exemptRoles: [{ id: '1100' }],
      reason: 'spam',
    });
    expect(rest.calls('POST /guilds/:id/automod/rules')[0]!.body).toEqual({
      name: 'No invites',
      triggerType: 'KEYWORD',
      eventType: 'MESSAGE_SEND',
      keywords: ['*discord.gg*'],
      blockMessage: true,
      blockReason: 'No invites here',
      exemptRoles: ['1100'],
    });
    expect(rest.calls('POST /guilds/:id/automod/rules')[0]!.headers['x-audit-log-reason']).toBe('spam');
    expect(rule.triggerType).toBe(AutoModerationRuleTriggerType.Keyword);
    expect(rule.actions[0]!.metadata.customMessage).toBe('No invites here');

    const rules = await guild.autoModerationRules.fetch();
    expect(rules.size).toBe(2);
    expect(rules.get('5101')!.triggerMetadata.presets).toEqual([AutoModerationRuleKeywordPresetType.Profanity, AutoModerationRuleKeywordPresetType.Slurs]);
    expect(guild.autoModerationRules.cache.get('5100')).toBe(rule);

    await rule.setActions([
      { type: AutoModerationActionType.SendAlertMessage, metadata: { channel: TEXT_ID } },
      { type: AutoModerationActionType.Timeout, metadata: { durationSeconds: 60 } },
    ]);
    expect(rest.calls('PATCH /guilds/:id/automod/rules/:rid')[0]!.body).toEqual({ blockMessage: false, blockReason: '', alertChannelId: TEXT_ID, timeoutSec: 60 });
    await rule.setEnabled(false);
    expect(rest.calls('PATCH /guilds/:id/automod/rules/:rid')[1]!.body).toEqual({ enabled: false });
    await expect(rule.setEventType(AutoModerationRuleEventType.MemberUpdate)).rejects.toThrow(/not supported on Bisim/);
    await expect(rule.setMentionRaidProtectionEnabled(true)).rejects.toThrow(/not supported on Bisim/);
    await expect(rule.setActions([{ type: AutoModerationActionType.BlockMemberInteraction }])).rejects.toThrow(/not supported on Bisim/);
    await rule.delete('done');
    expect(rest.calls('DELETE /guilds/:id/automod/rules/:rid')[0]!.headers['x-audit-log-reason']).toBe('done');
    expect(guild.autoModerationRules.cache.has('5100')).toBe(false);
  });

  it('makes a member profile rule a keyword rule on member updates', async () => {
    rest.on('POST /guilds/:id/automod/rules', (request) => ruleData({ ...request.body, id: '5102' }));
    const guild = client.guilds.cache.get(GUILD_ID)!;
    await guild.autoModerationRules.create({
      name: 'Names',
      eventType: AutoModerationRuleEventType.MemberUpdate,
      triggerType: AutoModerationRuleTriggerType.MemberProfile,
      triggerMetadata: { keywordFilter: ['bad'], mentionRaidProtectionEnabled: false },
      actions: [{ type: AutoModerationActionType.BlockMessage }],
    });
    expect(rest.calls('POST /guilds/:id/automod/rules')[0]!.body).toEqual({
      name: 'Names',
      triggerType: 'KEYWORD',
      eventType: 'MEMBER_UPDATE',
      keywords: ['bad'],
      blockMessage: true,
    });
  });
});

describe('rate limit buckets', () => {
  function bucketRest(responder: (url: string, index: number) => Response) {
    let index = 0;
    const limits: RateLimitData[] = [];
    const urls: string[] = [];
    const manager = new REST({ api: 'http://bisim.test/api', handlerSweepInterval: 0, offset: 0, makeRequest: async (url) => {
      urls.push(url);
      return responder(url, index++);
    } }).setToken('t');
    manager.on('rateLimited', (data) => limits.push(data));
    return { manager, limits, urls };
  }

  const ok = (headers: Record<string, string>) =>
    new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json', ...headers } });

  it('waits for the reset when a bucket has nothing left, across every route in it', async () => {
    const { manager, limits } = bucketRest((url) =>
      url.endsWith('/guilds')
        ? ok({ 'x-ratelimit-bucket': 'shared', 'x-ratelimit-limit': '5', 'x-ratelimit-remaining': '3', 'x-ratelimit-reset-after': '0.15' })
        : ok({ 'x-ratelimit-bucket': 'shared', 'x-ratelimit-limit': '5', 'x-ratelimit-remaining': '0', 'x-ratelimit-reset-after': '0.15' }),
    );
    await manager.get(Routes.guilds());
    await manager.get(Routes.user());
    expect(manager.buckets.get('shared')).toMatchObject({ limit: 5, remaining: 0 });
    const started = Date.now();
    await manager.get(Routes.guilds());
    expect(Date.now() - started).toBeGreaterThanOrEqual(120);
    expect(limits[0]).toMatchObject({ hash: 'shared', limit: 5, global: false, route: '/guilds' });
    manager.clearHandlerSweeper();
  });

  it('does not wait while the bucket has requests left, and reads the epoch reset too', async () => {
    const reset = String((Date.now() + 10_000) / 1000);
    const { manager, limits } = bucketRest(() => ok({ 'x-ratelimit-bucket': 'b2', 'x-ratelimit-limit': '600', 'x-ratelimit-remaining': '599', 'x-ratelimit-reset': reset }));
    const started = Date.now();
    await Promise.all([manager.get(Routes.guilds()), manager.get(Routes.guilds()), manager.get(Routes.guilds())]);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(limits).toHaveLength(0);
    expect(manager.hashes.get('GET:/guilds')?.value).toBe('b2');
  });

  it('marks a bucket empty on a route 429 and reports the scope', async () => {
    const { manager, limits } = bucketRest((_url, index) =>
      index === 0
        ? new Response(JSON.stringify({ code: 'RATE_LIMITED', retryAfter: 0.05, global: false }), {
            status: 429,
            headers: { 'content-type': 'application/json', 'retry-after': '0.05', 'x-ratelimit-scope': 'user', 'x-ratelimit-bucket': 'b3', 'x-ratelimit-remaining': '2' },
          })
        : ok({ 'x-ratelimit-bucket': 'b3', 'x-ratelimit-remaining': '9', 'x-ratelimit-reset-after': '1' }),
    );
    await manager.get(Routes.guild('1'));
    expect(limits[0]).toMatchObject({ hash: 'b3', scope: 'user', global: false });
    expect(manager.buckets.get('b3')?.remaining).toBe(9);
  });
});

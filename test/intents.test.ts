import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  AuditLogEvent,
  AutoModerationActionExecution,
  AutoModerationActionType,
  AutoModerationRule,
  AutoModerationRuleEventType,
  AutoModerationRuleKeywordPresetType,
  AutoModerationRuleTriggerType,
  BisimjsError,
  Client,
  ErrorCodes,
  Events,
  GatewayIntentBits,
  GuildAuditLogsEntry,
  GuildBan,
  Invite,
  Message,
  MessageReaction,
  Partials,
  TextChannel,
} from '../src/index.js';
import { ALL_INTENTS, BOT, FakeGateway, FakeRest, GUILD_ID, MEMBERS, ROLE_ID, TEXT_ID, guildDetail, standardRest, testClient, until, waitFor } from './helpers.js';

let gateway: FakeGateway;
let rest: FakeRest;
let client: Client;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function login(options: Record<string, unknown> = {}): Promise<Client<true>> {
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

describe('intents', () => {
  it('sends the intents when it takes its gateway pass', async () => {
    await login({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });
    const pass = rest.calls('POST /applications/:id/gateway')[0]!;
    expect(pass.body).toEqual({ intents: (1 << 0) | (1 << 9) | (1 << 15) });
  });

  it('rejects login with DisallowedIntents on 4014 and never reconnects', async () => {
    gateway.closeOnConnect = { code: 4014, reason: 'Disallowed intent(s).' };
    client = testClient(rest, gateway, { intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    let reconnecting = 0;
    client.on(Events.ShardReconnecting, () => reconnecting++);
    const error = await client.login('bot-token').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BisimjsError);
    expect((error as BisimjsError).code).toBe(ErrorCodes.DisallowedIntents);
    expect((error as BisimjsError).message).toMatch(/not enabled or whitelisted/);
    expect((error as BisimjsError).message).toMatch(/bisim\.gg\/developers/);
    await sleep(1_300);
    expect(gateway.tokens).toHaveLength(1);
    expect(rest.calls('POST /applications/:id/gateway')).toHaveLength(1);
    expect(reconnecting).toBe(0);
  });

  it('rejects login with InvalidIntents on 4013', async () => {
    gateway.closeOnConnect = { code: 4013, reason: 'Invalid intent(s).' };
    client = testClient(rest, gateway, { intents: [GatewayIntentBits.Guilds] });
    await expect(client.login('bot-token')).rejects.toMatchObject({ code: ErrorCodes.InvalidIntents });
    await sleep(300);
    expect(gateway.tokens).toHaveLength(1);
  });

  it('stops for good when a reconnect is refused for its intents', async () => {
    await login();
    const errors: Error[] = [];
    client.on(Events.Error, (error) => errors.push(error));
    const disconnected = waitFor<{ code: number }>(client, Events.ShardDisconnect, 8_000);
    gateway.closeOnConnect = { code: 4014, reason: 'Disallowed intent(s).' };
    gateway.send({ op: 9 });
    const [event] = await disconnected;
    expect(event!.code).toBe(4014);
    expect(errors.map((error) => (error as BisimjsError).code)).toEqual([ErrorCodes.DisallowedIntents]);
    await sleep(1_500);
    expect(gateway.tokens).toHaveLength(2);
  });

  it('does not reconnect when an open connection is closed with 4013', async () => {
    await login();
    const disconnected = waitFor<{ code: number }>(client, Events.ShardDisconnect);
    gateway.socket.close(4013, 'Invalid intent(s).');
    const [event] = await disconnected;
    expect(event!.code).toBe(4013);
    await sleep(1_300);
    expect(gateway.tokens).toHaveLength(1);
  });

  it('loads only its own member without GuildMembers, and readies without presence snapshots', async () => {
    gateway.presenceSnapshots = false;
    const started = Date.now();
    await login({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    expect(Date.now() - started).toBeLessThan(3_000);
    expect(rest.calls('GET /guilds/:id/members')).toHaveLength(0);
    expect(rest.calls('GET /guilds/:id/members/:userId').map((request) => request.path)).toEqual([`/guilds/${GUILD_ID}/members/${BOT.id}`]);
    const guild = client.guilds.cache.get(GUILD_ID)!;
    expect(guild.members.cache.map((member) => member.id)).toEqual([BOT.id]);
    expect(guild.members.me?.joinedAt?.toISOString()).toBe('2026-07-01T00:00:00.000Z');
    expect(client.ws.isSubscribed(GUILD_ID)).toBe(true);
    await until(() => gateway.opFrames(4).length === 1);
    expect(gateway.opFrames(4)).toEqual([{ op: 4, d: { guildId: GUILD_ID } }]);
  });

  it('still loads the member list with GuildMembers', async () => {
    await login({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers] });
    expect(rest.calls('GET /guilds/:id/members')).toHaveLength(1);
    expect(client.guilds.cache.get(GUILD_ID)!.members.cache.size).toBe(MEMBERS.length);
  });

  it('turns a 403 MISSING_INTENT on the member list into MissingIntent', async () => {
    await login({ intents: [GatewayIntentBits.Guilds] });
    rest.on('GET /guilds/:id/members', () =>
      new Response(JSON.stringify({ code: 'MISSING_INTENT', message: 'Listing members needs the Server Members intent', statusCode: 403 }), {
        status: 403,
        headers: { 'content-type': 'application/json' },
      }),
    );
    const guild = client.guilds.cache.get(GUILD_ID)!;
    const error = await guild.members.fetch().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(BisimjsError);
    expect((error as BisimjsError).code).toBe(ErrorCodes.MissingIntent);
    expect((error as BisimjsError).message).toMatch(/Server Members Intent/);
    await expect(guild.members.fetch('300')).resolves.toMatchObject({ id: '300' });
  });

  it('subscribes again when the gateway refuses a subscription it could not confirm', async () => {
    gateway.presenceSnapshots = false;
    gateway.refuseSubscribeOnce.add(GUILD_ID);
    await login({ intents: [GatewayIntentBits.Guilds] });
    await until(() => gateway.opFrames(4).length === 2);
    expect(rest.calls('GET /guilds/:id').length).toBeGreaterThanOrEqual(2);
    await until(() => client.ws.isSubscribed(GUILD_ID));
  });

  it('gives up on a subscription the gateway keeps refusing, with a warning', async () => {
    gateway.presenceSnapshots = false;
    gateway.refuseSubscribe.add(GUILD_ID);
    const warnings: string[] = [];
    client = testClient(rest, gateway, { intents: [GatewayIntentBits.Guilds] });
    client.on(Events.Warn, (warning) => warnings.push(warning));
    const ready = waitFor(client, Events.ClientReady);
    await client.login('bot-token');
    await ready;
    await until(() => warnings.some((warning) => warning.includes(`subscription to server ${GUILD_ID}`)));
    expect(gateway.opFrames(4)).toHaveLength(3);
    expect(client.ws.isSubscribed(GUILD_ID)).toBe(false);
  });
});

describe('the new events', () => {
  it('maps bans', async () => {
    await login();
    const added = waitFor<GuildBan>(client, Events.GuildBanAdd);
    gateway.dispatch('GUILD_BAN_ADD', { guildId: GUILD_ID, guildBan: { guildId: GUILD_ID, user: { id: '300', username: 'alice', bot: false } } });
    const [ban] = await added;
    expect(ban).toBeInstanceOf(GuildBan);
    expect(ban!.user.username).toBe('alice');
    expect(ban!.guild.id).toBe(GUILD_ID);
    expect(ban!.partial).toBe(true);
    expect(client.guilds.cache.get(GUILD_ID)!.bans.cache.has('300')).toBe(true);

    const removed = waitFor<GuildBan>(client, Events.GuildBanRemove);
    gateway.dispatch('GUILD_BAN_REMOVE', { guildId: GUILD_ID, guildBan: { guildId: GUILD_ID, user: { id: '300', username: 'alice' } } });
    const [lifted] = await removed;
    expect(lifted!.user.id).toBe('300');
    expect(client.guilds.cache.get(GUILD_ID)!.bans.cache.has('300')).toBe(false);
  });

  it('maps invites', async () => {
    await login();
    const created = waitFor<Invite>(client, Events.InviteCreate);
    gateway.dispatch('INVITE_CREATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      invite: {
        code: 'abc123',
        guildId: GUILD_ID,
        channelId: TEXT_ID,
        inviter: { id: '200', username: 'owner' },
        maxUses: 5,
        maxAge: 3600,
        createdAt: '2026-11-15T10:00:00.000Z',
        expiresAt: '2026-11-15T11:00:00.000Z',
      },
    });
    const [invite] = await created;
    expect(invite).toBeInstanceOf(Invite);
    expect(invite!.code).toBe('abc123');
    expect(invite!.channel?.id).toBe(TEXT_ID);
    expect(invite!.inviter?.username).toBe('owner');
    expect(invite!.maxUses).toBe(5);
    expect(invite!.uses).toBe(0);
    expect(invite!.maxAge).toBe(3600);
    expect(invite!.expiresAt?.toISOString()).toBe('2026-11-15T11:00:00.000Z');
    expect(invite!.url).toBe('https://bisim.gg/abc123');

    const deleted = waitFor<Invite>(client, Events.InviteDelete);
    gateway.dispatch('INVITE_DELETE', { guildId: GUILD_ID, channelId: TEXT_ID, inviteDelete: { code: 'abc123', guildId: GUILD_ID, channelId: TEXT_ID } });
    const [gone] = await deleted;
    expect(gone).toBe(invite);
    expect(client.guilds.cache.get(GUILD_ID)!.invites.cache.has('abc123')).toBe(false);
  });

  it('maps audit log entries to Discord action numbers', async () => {
    await login();
    const created = waitFor<GuildAuditLogsEntry>(client, Events.GuildAuditLogEntryCreate);
    gateway.dispatch('GUILD_AUDIT_LOG_ENTRY_CREATE', {
      guildId: GUILD_ID,
      auditLogEntry: {
        id: '9900',
        guildId: GUILD_ID,
        userId: '200',
        action: 'MEMBER_BAN',
        targetType: 'member',
        targetId: '300',
        metaJson: JSON.stringify({ reason: 'Spam', deleteMessageSeconds: 0 }),
        createdAt: '2026-11-15T10:00:00.000Z',
        reason: 'Spam',
      },
    });
    const [entry, guild] = (await created) as unknown as [GuildAuditLogsEntry, { id: string }];
    expect(entry).toBeInstanceOf(GuildAuditLogsEntry);
    expect(guild.id).toBe(GUILD_ID);
    expect(entry.action).toBe(AuditLogEvent.MemberBanAdd);
    expect(entry.actionName).toBe('MEMBER_BAN');
    expect(entry.actionType).toBe('Delete');
    expect(entry.targetType).toBe('User');
    expect(entry.executorId).toBe('200');
    expect(entry.executor?.username).toBe('owner');
    expect(entry.target).toMatchObject({ id: '300' });
    expect(entry.reason).toBe('Spam');
    expect(entry.extra).toEqual({ reason: 'Spam', deleteMessageSeconds: 0 });
    expect(entry.createdAt.toISOString()).toBe('2026-11-15T10:00:00.000Z');

    const automod = waitFor<GuildAuditLogsEntry>(client, Events.GuildAuditLogEntryCreate);
    gateway.dispatch('GUILD_AUDIT_LOG_ENTRY_CREATE', {
      guildId: GUILD_ID,
      auditLogEntry: { id: '9901', guildId: GUILD_ID, action: 'AUTOMOD_ACTION', targetType: 'member', targetId: '300', metaJson: '{"blocked":true}', createdAt: '2026-11-15T10:00:00.000Z' },
    });
    const [blocked] = await automod;
    expect(blocked!.action).toBe(AuditLogEvent.AutoModerationBlockMessage);
    expect(blocked!.executorId).toBeNull();
  });

  it('maps a webhook change to webhooksUpdate, and the deprecated webhookUpdate', async () => {
    await login();
    const both: string[] = [];
    client.on('webhookUpdate', (channel) => both.push(`old:${channel.id}`));
    const updated = waitFor<TextChannel>(client, Events.WebhooksUpdate);
    gateway.dispatch('WEBHOOKS_UPDATE', { guildId: GUILD_ID, channelId: TEXT_ID, webhooksUpdate: { guildId: GUILD_ID, channelId: TEXT_ID } });
    const [channel] = await updated;
    expect(channel!.id).toBe(TEXT_ID);
    await until(() => both.length === 1);
    expect(both).toEqual([`old:${TEXT_ID}`]);
  });

  it('maps AutoMod rules and actions with Discord numbers', async () => {
    await login();
    const rule = {
      id: '8800',
      guildId: GUILD_ID,
      name: 'No bad words',
      creatorId: '200',
      eventType: 'MESSAGE_SEND',
      triggerType: 'KEYWORD_PRESET',
      presets: ['PROFANITY', 'SEXUAL'],
      allowList: ['scunthorpe'],
      blockMessage: true,
      blockReason: 'Please be kind',
      alertChannelId: TEXT_ID,
      timeoutSec: 60,
      enabled: true,
      exemptRoles: [ROLE_ID],
    };
    const created = waitFor<AutoModerationRule>(client, Events.AutoModerationRuleCreate);
    gateway.dispatch('AUTO_MODERATION_RULE_CREATE', { guildId: GUILD_ID, automodRule: rule });
    const [made] = await created;
    expect(made).toBeInstanceOf(AutoModerationRule);
    expect(made!.name).toBe('No bad words');
    expect(made!.eventType).toBe(AutoModerationRuleEventType.MessageSend);
    expect(made!.triggerType).toBe(AutoModerationRuleTriggerType.KeywordPreset);
    expect(made!.triggerMetadata.presets).toEqual([AutoModerationRuleKeywordPresetType.Profanity, AutoModerationRuleKeywordPresetType.SexualContent]);
    expect(made!.triggerMetadata.allowList).toEqual(['scunthorpe']);
    expect(made!.actions).toEqual([
      { type: AutoModerationActionType.BlockMessage, metadata: { channelId: null, durationSeconds: null, customMessage: 'Please be kind' } },
      { type: AutoModerationActionType.SendAlertMessage, metadata: { channelId: TEXT_ID, durationSeconds: null, customMessage: null } },
      { type: AutoModerationActionType.Timeout, metadata: { channelId: null, durationSeconds: 60, customMessage: null } },
    ]);
    expect(made!.exemptRoles.map((role) => role.id)).toEqual([ROLE_ID]);
    expect(made!.enabled).toBe(true);

    const updated = waitFor<AutoModerationRule | null>(client, Events.AutoModerationRuleUpdate);
    gateway.dispatch('AUTO_MODERATION_RULE_UPDATE', { guildId: GUILD_ID, automodRule: { ...rule, name: 'Kind words only', enabled: false } });
    const [oldRule, newRule] = await updated;
    expect(oldRule!.name).toBe('No bad words');
    expect(newRule!.name).toBe('Kind words only');
    expect(newRule!.enabled).toBe(false);
    expect(newRule).toBe(made);

    const executed = waitFor<AutoModerationActionExecution>(client, Events.AutoModerationActionExecution);
    gateway.dispatch('AUTO_MODERATION_ACTION_EXECUTION', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      automodAction: { guildId: GUILD_ID, actionType: 3, ruleId: '8800', ruleTriggerType: 'KEYWORD_PRESET', userId: '300', channelId: TEXT_ID, matchedKeyword: 'darn', durationSeconds: 60 },
    });
    const [execution] = await executed;
    expect(execution).toBeInstanceOf(AutoModerationActionExecution);
    expect(execution!.action).toEqual({ type: AutoModerationActionType.Timeout, metadata: { channelId: null, durationSeconds: 60, customMessage: null } });
    expect(execution!.ruleTriggerType).toBe(AutoModerationRuleTriggerType.KeywordPreset);
    expect(execution!.autoModerationRule).toBe(made);
    expect(execution!.user?.username).toBe('alice');
    expect(execution!.channel?.id).toBe(TEXT_ID);
    expect(execution!.content).toBe('');
    expect(execution!.matchedContent).toBeNull();
    expect(execution!.messageId).toBeNull();

    const deleted = waitFor<AutoModerationRule>(client, Events.AutoModerationRuleDelete);
    gateway.dispatch('AUTO_MODERATION_RULE_DELETE', { guildId: GUILD_ID, automodRule: rule });
    const [gone] = await deleted;
    expect(gone).toBe(made);
  });

  it('gives an uncached member who leaves the user from the event', async () => {
    await login({ partials: [Partials.GuildMember] });
    const removed = waitFor(client, Events.GuildMemberRemove);
    gateway.dispatch('GUILD_MEMBER_REMOVE', { guildId: GUILD_ID, userId: '777', guildMemberRemove: { userId: '777', user: { id: '777', username: 'stranger', displayName: 'Stranger' } } });
    const [member] = (await removed) as any[];
    expect(member.id).toBe('777');
    expect(member.user.username).toBe('stranger');
    expect(client.users.cache.get('777')?.globalName).toBe('Stranger');
  });

  it('maps emoji updates and removing one emoji from a message', async () => {
    await login();
    const updated = waitFor(client, Events.GuildEmojiUpdate);
    gateway.dispatch('GUILD_EMOJI_UPDATE', { guildId: GUILD_ID, emoji: { id: '1500', guildId: GUILD_ID, name: 'hello', objectKey: 'emojis/1500.png' } });
    const [oldEmoji, newEmoji] = (await updated) as any[];
    expect(oldEmoji.name).toBe('wave');
    expect(newEmoji.name).toBe('hello');

    gateway.dispatch('MESSAGE_CREATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: { id: '6400', channelId: TEXT_ID, guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, content: 'react' },
    });
    await waitFor(client, Events.MessageCreate);
    gateway.dispatch('MESSAGE_REACTION_ADD', { guildId: GUILD_ID, channelId: TEXT_ID, reaction: { messageId: '6400', channelId: TEXT_ID, guildId: GUILD_ID, userId: '200', emoji: '👍' } });
    await waitFor(client, Events.MessageReactionAdd);
    const removed = waitFor<MessageReaction>(client, Events.MessageReactionRemoveEmoji);
    gateway.dispatch('MESSAGE_REACTION_REMOVE_EMOJI', { guildId: GUILD_ID, channelId: TEXT_ID, reactionRemoveEmoji: { messageId: '6400', channelId: TEXT_ID, guildId: GUILD_ID, emoji: '👍' } });
    const [reaction] = await removed;
    expect(reaction!.emoji.name).toBe('👍');
    expect(reaction!.message.reactions.cache.size).toBe(0);
  });
});

describe('channels made and deleted', () => {
  const NEWS = { id: '1004', guildId: GUILD_ID, type: 'GUILD_TEXT', name: 'news', parentId: '1003', position: 1, permissionsSynced: true };
  const withNews = () => guildDetail({ channels: [...(guildDetail().channels as any[]), { ...NEWS, topic: null, nsfw: false, slowmodeSec: 0, lastMessageId: null, permissions: '3072' }] });

  it('emits channelCreate once when GUILD_RESYNC follows CHANNEL_CREATE', async () => {
    await login();
    const created: string[] = [];
    const updated: string[] = [];
    client.on(Events.ChannelCreate, (channel) => created.push(channel.id));
    client.on(Events.ChannelUpdate, (_old, channel) => updated.push(channel.id));
    gateway.dispatch('CHANNEL_CREATE', { guildId: GUILD_ID, channelId: NEWS.id, channelUpdate: NEWS });
    await until(() => created.length === 1);
    const channel = client.channels.cache.get(NEWS.id) as TextChannel;
    expect(channel).toBeInstanceOf(TextChannel);
    expect(channel.name).toBe('news');
    expect(channel.parentId).toBe('1003');

    rest.on('GET /guilds/:id', withNews);
    const subscribes = gateway.opFrames(4).length;
    gateway.dispatch('GUILD_RESYNC', { guildId: GUILD_ID, guildResync: {} });
    await until(() => gateway.opFrames(4).length === subscribes + 1);
    await sleep(50);
    expect(created).toEqual([NEWS.id]);
    expect(updated).toEqual([]);
  });

  it('emits channelCreate once when the refresh comes first', async () => {
    await login();
    const created: string[] = [];
    client.on(Events.ChannelCreate, (channel) => created.push(channel.id));
    rest.on('GET /guilds/:id', withNews);
    const subscribes = gateway.opFrames(4).length;
    gateway.dispatch('GUILD_RESYNC', { guildId: GUILD_ID, guildResync: {} });
    await until(() => gateway.opFrames(4).length === subscribes + 1);
    gateway.dispatch('CHANNEL_CREATE', { guildId: GUILD_ID, channelId: NEWS.id, channelUpdate: NEWS });
    await sleep(100);
    expect(created).toEqual([NEWS.id]);
  });

  it('emits channelDelete once when GUILD_RESYNC follows CHANNEL_DELETE', async () => {
    await login();
    const deleted: string[] = [];
    client.on(Events.ChannelDelete, (channel) => deleted.push(channel.id));
    gateway.dispatch('CHANNEL_DELETE', { guildId: GUILD_ID, channelId: TEXT_ID, channelUpdate: { id: TEXT_ID, guildId: GUILD_ID, type: 'GUILD_TEXT', name: 'general' } });
    await until(() => deleted.length === 1);
    expect(client.channels.cache.has(TEXT_ID)).toBe(false);
    rest.on('GET /guilds/:id', () => guildDetail({ channels: (guildDetail().channels as any[]).filter((channel) => channel.id !== TEXT_ID) }));
    const subscribes = gateway.opFrames(4).length;
    gateway.dispatch('GUILD_RESYNC', { guildId: GUILD_ID, guildResync: {} });
    await until(() => gateway.opFrames(4).length === subscribes + 1);
    await sleep(50);
    expect(deleted).toEqual([TEXT_ID]);
  });
});

describe('messages', () => {
  it('takes mentions and the member from the event, even without the text', async () => {
    await login({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages] });
    const created = waitFor<Message>(client, Events.MessageCreate);
    gateway.dispatch('MESSAGE_CREATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: {
        id: '6500',
        channelId: TEXT_ID,
        guildId: GUILD_ID,
        authorId: '400',
        author: { id: '400', username: 'neo' },
        createdAt: '2026-11-15T10:00:00.000Z',
        mentions: [{ id: '300', username: 'alice' }, { id: BOT.id, username: BOT.username, bot: true }],
        mentionRoleIds: [ROLE_ID],
        mentionEveryone: true,
        member: { userId: '400', nickname: 'The One', roleIds: [GUILD_ID, ROLE_ID], joinedAt: '2026-10-01T00:00:00.000Z' },
      },
    });
    const [message] = await created;
    expect(message!.content).toBe('');
    expect(message!.partial).toBe(false);
    expect(message!.member?.nickname).toBe('The One');
    expect(message!.member?.roles.cache.has(ROLE_ID)).toBe(true);
    expect(message!.member?.joinedAt?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
    expect([...message!.mentions.users.keys()]).toEqual(['300', BOT.id]);
    expect(message!.mentions.has(client.user!)).toBe(true);
    expect(message!.mentions.roles.has(ROLE_ID)).toBe(true);
    expect(message!.mentions.everyone).toBe(true);
    expect(message!.mentions.parsedUsers.size).toBe(0);
  });

  it('keeps a message whose content, embeds and files were left out', async () => {
    await login();
    const created = waitFor<Message>(client, Events.MessageCreate);
    gateway.dispatch('MESSAGE_CREATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: { id: '6600', channelId: TEXT_ID, guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, createdAt: '2026-11-15T10:00:00.000Z' },
    });
    const [message] = await created;
    expect(message).toBeInstanceOf(Message);
    expect(message!.content).toBe('');
    expect(message!.embeds).toEqual([]);
    expect(message!.attachments.size).toBe(0);
    expect(message!.components).toEqual([]);
    expect(message!.poll).toBeNull();
    expect(message!.mentions.users.size).toBe(0);
    expect(message!.mentions.everyone).toBe(false);
    expect(message!.cleanContent).toBe('');

    const updated = waitFor<Message>(client, Events.MessageUpdate);
    gateway.dispatch('MESSAGE_UPDATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: { id: '6600', channelId: TEXT_ID, guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, editedAt: '2026-11-15T10:01:00.000Z' },
    });
    const [, edited] = await updated;
    expect(edited!.content).toBe('');
    expect(edited!.editedAt?.toISOString()).toBe('2026-11-15T10:01:00.000Z');
  });

  it('reads the mention lists REST sends', async () => {
    await login();
    rest.on('GET /channels/:id/messages/:messageId', () => ({
      id: '6700',
      channelId: TEXT_ID,
      guildId: GUILD_ID,
      authorId: '300',
      author: { id: '300', username: 'alice' },
      type: 'DEFAULT',
      content: '',
      createdAt: '2026-11-15T10:00:00.000Z',
      mentionIds: ['200', '999'],
      mentionRoleIds: [ROLE_ID, '4242'],
      mentionEveryone: false,
    }));
    const channel = client.channels.cache.get(TEXT_ID) as TextChannel;
    const message = await channel.messages.fetch('6700');
    expect(message.mentions.users.get('200')?.username).toBe('owner');
    expect(message.mentions.users.get('999')?.id).toBe('999');
    expect([...message.mentions.roles.keys()]).toEqual([ROLE_ID]);
    expect(message.mentions.everyone).toBe(false);
  });

  it('falls back to the text when the server sends no mention lists', async () => {
    await login({ intents: ALL_INTENTS });
    const created = waitFor<Message>(client, Events.MessageCreate);
    gateway.dispatch('MESSAGE_CREATE', {
      guildId: GUILD_ID,
      channelId: TEXT_ID,
      message: { id: '6800', channelId: TEXT_ID, guildId: GUILD_ID, authorId: '300', author: { id: '300', username: 'alice' }, content: 'hey <@200> <@&1100>' },
    });
    const [message] = await created;
    expect(message!.mentions.users.has('200')).toBe(true);
    expect(message!.mentions.roles.has(ROLE_ID)).toBe(true);
  });
});

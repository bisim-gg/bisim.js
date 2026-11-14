import { BisimjsError, ErrorCodes } from '../errors/index.js';
import type { RouteLike } from './types.js';

type Id = string | number | bigint;

const notOnBisim =
  (name: string) =>
  (..._args: unknown[]): never => {
    throw new BisimjsError(ErrorCodes.NotSupported, `Routes.${name}`);
  };

/**
 * The paths of Bisim's REST API, under discord.js's names. `Routes.channelMessages(id)` gives Bisim's path
 * for what Discord's route of the same name does, so the guide's raw REST code works:
 *
 * @example
 * ```js
 * const rest = new REST().setToken(token);
 * await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: commands });
 * ```
 *
 * A few routes have no Bisim equivalent (threads, stages, scheduled events...): calling them throws a
 * {@link BisimjsError} that says so. Bisim's own routes (`guildChannel`, `guildMemberTimeout`...) are added.
 */
export const Routes = {
  // Users
  /** `GET /users/:id`; `Routes.user()` or `Routes.user('@me')` is the bot itself, `GET /auth/me`. */
  user: (userId: Id | '@me' = '@me'): RouteLike => (userId === '@me' ? '/auth/me' : `/users/${userId}`),
  /** `GET /dms`, `POST /dms` (open a DM with `{ userId }`). */
  userChannels: (): RouteLike => '/dms',
  /** `GET /guilds`: the servers the bot is in. */
  userGuilds: (): RouteLike => '/guilds',
  /** `DELETE /guilds/:id/members/@me`: leave a server. */
  userGuild: (guildId: Id): RouteLike => `/guilds/${guildId}/members/@me`,

  // Guilds
  /** `GET /guilds`. */
  guilds: (): RouteLike => '/guilds',
  /** `GET` / `PATCH /guilds/:id`. */
  guild: (guildId: Id): RouteLike => `/guilds/${guildId}`,
  /** `GET` / `POST /guilds/:id/channels`. */
  guildChannels: (guildId: Id): RouteLike => `/guilds/${guildId}/channels`,
  /** Bisim: `PATCH` / `DELETE /guilds/:id/channels/:channelId`. */
  guildChannel: (guildId: Id, channelId: Id): RouteLike => `/guilds/${guildId}/channels/${channelId}`,
  /** Bisim: `PATCH /guilds/:id/channels/positions` with `{ channels: [{ id, position, parentId }] }`. */
  guildChannelPositions: (guildId: Id): RouteLike => `/guilds/${guildId}/channels/positions`,
  /** Bisim: `GET /guilds/:id/channels/:channelId/overwrites`. */
  guildChannelOverwrites: (guildId: Id, channelId: Id): RouteLike => `/guilds/${guildId}/channels/${channelId}/overwrites`,
  /** Bisim: `PUT` / `DELETE /guilds/:id/channels/:channelId/overwrites/:targetId`. */
  guildChannelOverwrite: (guildId: Id, channelId: Id, targetId: Id): RouteLike =>
    `/guilds/${guildId}/channels/${channelId}/overwrites/${targetId}`,
  /** `GET /guilds/:id/members` (`?limit=&after=`). */
  guildMembers: (guildId: Id): RouteLike => `/guilds/${guildId}/members`,
  /** `GET /guilds/:id/members/search?query=&limit=`. */
  guildMembersSearch: (guildId: Id): RouteLike => `/guilds/${guildId}/members/search`,
  /** `GET` / `PATCH` / `DELETE /guilds/:id/members/:userId` (`DELETE` is a kick). */
  guildMember: (guildId: Id, userId: Id | '@me' = '@me'): RouteLike => `/guilds/${guildId}/members/${userId}`,
  /** `PATCH /guilds/:id/members/@me/nickname`. */
  guildCurrentMemberNickname: (guildId: Id): RouteLike => `/guilds/${guildId}/members/@me/nickname`,
  /** `PUT` / `DELETE /guilds/:id/members/:userId/roles/:roleId`. */
  guildMemberRole: (guildId: Id, userId: Id, roleId: Id): RouteLike => `/guilds/${guildId}/members/${userId}/roles/${roleId}`,
  /** Bisim: `PUT /guilds/:id/members/:userId/timeout` with `{ until, reason }`. */
  guildMemberTimeout: (guildId: Id, userId: Id): RouteLike => `/guilds/${guildId}/members/${userId}/timeout`,
  /** `GET` / `POST /guilds/:id/roles`. */
  guildRoles: (guildId: Id): RouteLike => `/guilds/${guildId}/roles`,
  /** `PATCH` / `DELETE /guilds/:id/roles/:roleId`. */
  guildRole: (guildId: Id, roleId: Id): RouteLike => `/guilds/${guildId}/roles/${roleId}`,
  /** Bisim: `PATCH /guilds/:id/roles/positions` with `{ roles: [{ id, position }] }`. */
  guildRolePositions: (guildId: Id): RouteLike => `/guilds/${guildId}/roles/positions`,
  /** `GET /guilds/:id/bans`. */
  guildBans: (guildId: Id): RouteLike => `/guilds/${guildId}/bans`,
  /** `GET` / `PUT` / `DELETE /guilds/:id/bans/:userId`. */
  guildBan: (guildId: Id, userId: Id): RouteLike => `/guilds/${guildId}/bans/${userId}`,
  /** `GET` / `POST /guilds/:id/invites`. */
  guildInvites: (guildId: Id): RouteLike => `/guilds/${guildId}/invites`,
  /** Bisim: `DELETE /guilds/:id/invites/:code`. */
  guildInvite: (guildId: Id, code: string): RouteLike => `/guilds/${guildId}/invites/${encodeURIComponent(code)}`,
  /** `GET` / `POST /guilds/:id/emojis` (creating one is a multipart upload). */
  guildEmojis: (guildId: Id): RouteLike => `/guilds/${guildId}/emojis`,
  /** `DELETE /guilds/:id/emojis/:emojiId`. */
  guildEmoji: (guildId: Id, emojiId: Id): RouteLike => `/guilds/${guildId}/emojis/${emojiId}`,
  /** `GET` / `POST /guilds/:id/stickers`. */
  guildStickers: (guildId: Id): RouteLike => `/guilds/${guildId}/stickers`,
  /** `DELETE /guilds/:id/stickers/:stickerId`. */
  guildSticker: (guildId: Id, stickerId: Id): RouteLike => `/guilds/${guildId}/stickers/${stickerId}`,
  /** `GET` / `POST /guilds/:id/sounds`. */
  guildSoundboardSounds: (guildId: Id): RouteLike => `/guilds/${guildId}/sounds`,
  /** `PATCH` / `DELETE /guilds/:id/sounds/:soundId`. */
  guildSoundboardSound: (guildId: Id, soundId: Id): RouteLike => `/guilds/${guildId}/sounds/${soundId}`,
  /** `GET /guilds/:id/webhooks`. */
  guildWebhooks: (guildId: Id): RouteLike => `/guilds/${guildId}/webhooks`,
  /** `GET /guilds/:id/audit-log?before=`. */
  guildAuditLog: (guildId: Id): RouteLike => `/guilds/${guildId}/audit-log`,
  /** Bisim: `GET /guilds/:id/voice-states`. */
  guildVoiceStates: (guildId: Id): RouteLike => `/guilds/${guildId}/voice-states`,
  /** Bisim: `GET /guilds/:id/commands`, the commands members can run there. */
  guildCommands: (guildId: Id): RouteLike => `/guilds/${guildId}/commands`,

  // Channels
  /** `GET /channels/:id`. */
  channel: (channelId: Id): RouteLike => `/channels/${channelId}`,
  /** `GET` / `POST /channels/:id/messages`. */
  channelMessages: (channelId: Id): RouteLike => `/channels/${channelId}/messages`,
  /** `GET` / `PATCH` / `DELETE /channels/:id/messages/:messageId`. */
  channelMessage: (channelId: Id, messageId: Id): RouteLike => `/channels/${channelId}/messages/${messageId}`,
  /** `POST /channels/:id/messages/bulk-delete` with `{ messages }`. */
  channelBulkDelete: (channelId: Id): RouteLike => `/channels/${channelId}/messages/bulk-delete`,
  /** `GET /channels/:id/messages/search`. */
  channelMessagesSearch: (channelId: Id): RouteLike => `/channels/${channelId}/messages/search`,
  /** `PUT` / `DELETE` the bot's own reaction: `/channels/:id/messages/:messageId/reactions/:emoji`. */
  channelMessageOwnReaction: (channelId: Id, messageId: Id, emoji: string): RouteLike =>
    `/channels/${channelId}/messages/${messageId}/reactions/${emoji}`,
  /** `DELETE` someone's reaction: `/channels/:id/messages/:messageId/reactions/:emoji/:userId`. */
  channelMessageUserReaction: (channelId: Id, messageId: Id, emoji: string, userId: Id): RouteLike =>
    `/channels/${channelId}/messages/${messageId}/reactions/${emoji}/${userId}`,
  /** `GET` who reacted with an emoji: `/channels/:id/messages/:messageId/reactions/:emoji`. */
  channelMessageReaction: (channelId: Id, messageId: Id, emoji: string): RouteLike =>
    `/channels/${channelId}/messages/${messageId}/reactions/${emoji}`,
  /** `DELETE` every reaction: `/channels/:id/messages/:messageId/reactions`. */
  channelMessageAllReactions: (channelId: Id, messageId: Id): RouteLike => `/channels/${channelId}/messages/${messageId}/reactions`,
  /** `GET /channels/:id/pins`. */
  channelPins: (channelId: Id): RouteLike => `/channels/${channelId}/pins`,
  /** `PUT` / `DELETE /channels/:id/pins/:messageId`. */
  channelPin: (channelId: Id, messageId: Id): RouteLike => `/channels/${channelId}/pins/${messageId}`,
  /** The same as {@link Routes.channelPins}. */
  channelMessagesPins: (channelId: Id): RouteLike => `/channels/${channelId}/pins`,
  /** The same as {@link Routes.channelPin}. */
  channelMessagesPin: (channelId: Id, messageId: Id): RouteLike => `/channels/${channelId}/pins/${messageId}`,
  /** `POST /channels/:id/typing`. */
  channelTyping: (channelId: Id): RouteLike => `/channels/${channelId}/typing`,
  /** `GET` / `POST /channels/:id/webhooks`. */
  channelWebhooks: (channelId: Id): RouteLike => `/channels/${channelId}/webhooks`,
  /** `POST /channels/:id/attachments`: ask for upload addresses. */
  channelAttachments: (channelId: Id): RouteLike => `/channels/${channelId}/attachments`,
  /** Bisim: `GET /channels/:id/voice-states`. */
  channelVoiceStates: (channelId: Id): RouteLike => `/channels/${channelId}/voice-states`,
  /** Bisim: `PATCH` (`{ mute, deafen }`) / `DELETE` (disconnect) `/channels/:id/voice/members/:userId`. */
  channelVoiceMember: (channelId: Id, userId: Id): RouteLike => `/channels/${channelId}/voice/members/${userId}`,
  /** Bisim: `POST /channels/:id/voice/members/:userId/move` with `{ channelId }`. */
  channelVoiceMemberMove: (channelId: Id, userId: Id): RouteLike => `/channels/${channelId}/voice/members/${userId}/move`,
  /** Bisim: `POST /channels/:id/voice/join` with `{ selfMuted, selfDeafened }`: the LiveKit address and token. */
  channelVoiceJoin: (channelId: Id): RouteLike => `/channels/${channelId}/voice/join`,
  /** Bisim: `POST /channels/:id/voice/leave`. */
  channelVoiceLeave: (channelId: Id): RouteLike => `/channels/${channelId}/voice/leave`,
  /** Bisim: `PATCH /channels/:id/voice/state` with `{ selfMuted, selfDeafened }`, while in that channel. */
  channelVoiceSelfState: (channelId: Id): RouteLike => `/channels/${channelId}/voice/state`,
  /** `POST`: plays a soundboard sound in the voice channel the bot is in (Bisim: `/channels/:id/soundboard/play`). */
  sendSoundboardSound: (channelId: Id): RouteLike => `/channels/${channelId}/soundboard/play`,
  /** Bisim: `PUT /channels/:id/messages/:messageId/poll/votes` with `{ answerIds }`. */
  pollVotes: (channelId: Id, messageId: Id): RouteLike => `/channels/${channelId}/messages/${messageId}/poll/votes`,
  /** `GET` the voters of one answer. */
  pollAnswerVoters: (channelId: Id, messageId: Id, answerId: Id): RouteLike =>
    `/channels/${channelId}/messages/${messageId}/poll/answers/${answerId}/voters`,
  /** `POST` end a poll now. */
  expirePoll: (channelId: Id, messageId: Id): RouteLike => `/channels/${channelId}/messages/${messageId}/poll/end`,

  // Invites
  /** `GET /invites/:code`. */
  invite: (code: string): RouteLike => `/invites/${encodeURIComponent(code)}`,

  // Webhooks
  /** `GET` / `PATCH` / `DELETE /webhooks/:id`, or with a token `POST /webhooks/:id/:token` to send. */
  webhook: (webhookId: Id, webhookToken?: string): RouteLike =>
    webhookToken ? `/webhooks/${webhookId}/${webhookToken}` : `/webhooks/${webhookId}`,
  /** `/webhooks/:id/:token/messages/:messageId` (not on Bisim yet: editing past webhook messages). */
  webhookMessage: (webhookId: Id, webhookToken: string, messageId: Id | '@original' = '@original'): RouteLike =>
    `/webhooks/${webhookId}/${webhookToken}/messages/${messageId}`,
  /** Bisim: `POST /webhooks/:id/token`, a new token. */
  webhookToken: (webhookId: Id): RouteLike => `/webhooks/${webhookId}/token`,

  // Applications and commands
  /** `GET /applications/@me`. */
  currentApplication: (): RouteLike => '/applications/@me',
  /** `GET` / `PATCH /applications/:id`. */
  application: (applicationId: Id): RouteLike => `/applications/${applicationId}`,
  /** Bisim: `POST /applications/:id/gateway`, a pass for the gateway. */
  applicationGateway: (applicationId: Id): RouteLike => `/applications/${applicationId}/gateway`,
  /** `GET` / `PUT` (bulk) / `POST` (one) `/applications/:id/commands`. */
  applicationCommands: (applicationId: Id): RouteLike => `/applications/${applicationId}/commands`,
  /** `GET` / `PATCH` / `DELETE /applications/:id/commands/:commandId`. */
  applicationCommand: (applicationId: Id, commandId: Id): RouteLike => `/applications/${applicationId}/commands/${commandId}`,
  /** `GET` / `PUT` (bulk) / `POST` (one) `/applications/:id/guilds/:guildId/commands`. */
  applicationGuildCommands: (applicationId: Id, guildId: Id): RouteLike =>
    `/applications/${applicationId}/guilds/${guildId}/commands`,
  /** `GET` / `PATCH` / `DELETE /applications/:id/guilds/:guildId/commands/:commandId`. */
  applicationGuildCommand: (applicationId: Id, guildId: Id, commandId: Id): RouteLike =>
    `/applications/${applicationId}/guilds/${guildId}/commands/${commandId}`,

  // Interactions
  /** `POST /interactions/:id/:token/callback`. */
  interactionCallback: (interactionId: Id, interactionToken: string): RouteLike =>
    `/interactions/${interactionId}/${interactionToken}/callback`,
  /** Bisim: `POST /interactions/:id/:token/followup`. */
  interactionFollowup: (interactionId: Id, interactionToken: string): RouteLike =>
    `/interactions/${interactionId}/${interactionToken}/followup`,
  /** Bisim: `GET` / `PATCH` / `DELETE /interactions/:id/:token/messages/:messageId` (`@original` for the reply). */
  interactionMessage: (interactionId: Id, interactionToken: string, messageId: Id | '@original' = '@original'): RouteLike =>
    `/interactions/${interactionId}/${interactionToken}/messages/${messageId}`,

  // Misc
  /** Bisim: `GET /client-config` (upload limits and switches). */
  clientConfig: (): RouteLike => '/client-config',

  // Discord routes Bisim does not have
  /** Not on Bisim. */
  gateway: notOnBisim('gateway (use Routes.applicationGateway)'),
  /** Not on Bisim. */
  gatewayBot: notOnBisim('gatewayBot (use Routes.applicationGateway)'),
  /** Not on Bisim. */
  channelPermission: notOnBisim('channelPermission (use Routes.guildChannelOverwrite)'),
  /** Not on Bisim. */
  channelInvites: notOnBisim('channelInvites (use Routes.guildInvites)'),
  /** Not on Bisim. */
  channelFollowers: notOnBisim('channelFollowers'),
  /** Not on Bisim. */
  channelCrosspost: notOnBisim('channelCrosspost'),
  /** Not on Bisim. */
  channelRecipient: notOnBisim('channelRecipient'),
  /** Not on Bisim. */
  threads: notOnBisim('threads'),
  /** Not on Bisim. */
  channelThreads: notOnBisim('channelThreads'),
  /** Not on Bisim. */
  channelThreadMembers: notOnBisim('channelThreadMembers'),
  /** Not on Bisim. */
  threadMembers: notOnBisim('threadMembers'),
  /** Not on Bisim. */
  guildActiveThreads: notOnBisim('guildActiveThreads'),
  /** Not on Bisim. */
  stageInstances: notOnBisim('stageInstances'),
  /** Not on Bisim. */
  stageInstance: notOnBisim('stageInstance'),
  /** Not on Bisim. */
  guildScheduledEvents: notOnBisim('guildScheduledEvents'),
  /** Not on Bisim. */
  guildScheduledEvent: notOnBisim('guildScheduledEvent'),
  /** Not on Bisim. */
  guildPrune: notOnBisim('guildPrune'),
  /** Not on Bisim. */
  guildIntegrations: notOnBisim('guildIntegrations'),
  /** Not on Bisim. */
  guildWidgetSettings: notOnBisim('guildWidgetSettings'),
  /** Not on Bisim. */
  guildVanityUrl: notOnBisim('guildVanityUrl'),
  /** Not on Bisim. */
  guildWelcomeScreen: notOnBisim('guildWelcomeScreen'),
  /** Not on Bisim. */
  guildPreview: notOnBisim('guildPreview'),
  /** Not on Bisim. */
  guildTemplates: notOnBisim('guildTemplates'),
  /** Not on Bisim. */
  guildBulkBan: notOnBisim('guildBulkBan'),
  /** Not on Bisim. */
  guildApplicationCommandsPermissions: notOnBisim('guildApplicationCommandsPermissions'),
  /** Not on Bisim. */
  applicationCommandPermissions: notOnBisim('applicationCommandPermissions'),
  /** Not on Bisim. */
  stickerPacks: notOnBisim('stickerPacks'),
  /** Not on Bisim. */
  sticker: notOnBisim('sticker'),
  /** Not on Bisim. */
  voiceRegions: notOnBisim('voiceRegions'),
  /** Not on Bisim. */
  entitlements: notOnBisim('entitlements'),
  /** Not on Bisim. */
  skus: notOnBisim('skus'),
  /** Not on Bisim. */
  oauth2CurrentApplication: notOnBisim('oauth2CurrentApplication'),
  /** Not on Bisim. */
  oauth2CurrentAuthorization: notOnBisim('oauth2CurrentAuthorization'),
  /** Not on Bisim. */
  guildMemberVerification: notOnBisim('guildMemberVerification'),
  /** Not on Bisim. */
  guildOnboarding: notOnBisim('guildOnboarding'),
  /** Not on Bisim. */
  guildMFA: notOnBisim('guildMFA'),
} as const;

/**
 * The OAuth2 addresses, with Bisim's install page.
 */
export const OAuth2Routes = {
  /** The page that adds a bot to a server. */
  authorizationURL: 'https://bisim.gg/oauth2/authorize',
} as const;

/**
 * The route templates and their major parameter, used to group requests into rate limit buckets.
 *
 * @internal
 */
export function routeBucket(method: string, fullRoute: string): { bucketRoute: string; majorParameter: string } {
  const segments = fullRoute.split('?')[0]!.split('/').slice(1);
  const root = segments[0];
  let majorParameter = 'global';
  const out: string[] = [];
  segments.forEach((segment, index) => {
    const previous = segments[index - 1];
    if (index === 1 && /^(channels|guilds|webhooks|interactions)$/.test(root ?? '') && /^\d{1,20}$/.test(segment)) {
      majorParameter = segment;
      out.push(':major');
    } else if (index === 2 && (root === 'webhooks' || root === 'interactions')) {
      out.push(':token');
    } else if (previous === 'reactions') {
      out.push(':emoji');
    } else if (root === 'invites' && index === 1) {
      out.push(':code');
    } else if (/^\d{1,20}$/.test(segment)) {
      out.push(':id');
    } else {
      out.push(segment);
    }
  });
  return { bucketRoute: `${method}:/${out.join('/')}`, majorParameter };
}

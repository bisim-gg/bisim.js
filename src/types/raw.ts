/**
 * The shapes Bisim's REST API and gateway send, as bisim.js reads them. They are Bisim's own (camelCase, ids
 * as strings); the structures turn them into the objects a discord.js bot knows. Fields a proto3-JSON event
 * leaves out (false, 0, "" and []) are optional here, and the gateway layer fills them back in before a
 * structure sees them.
 *
 * @packageDocumentation
 */

/** A user as Bisim embeds it in other objects. */
export interface RawUserData {
  id: string;
  username: string;
  displayName?: string | null;
  avatarKey?: string | null;
  bannerKey?: string | null;
  bot?: boolean;
  createdAt?: string;
  bio?: string | null;
  pronouns?: string | null;
  locale?: string;
  badges?: string[];
}

/** A server, as `GET /guilds` and `GET /guilds/:id` send it. */
export interface RawGuildData {
  id: string;
  name: string;
  iconKey?: string | null;
  bannerKey?: string | null;
  splashKey?: string | null;
  description?: string | null;
  verificationLevel?: number;
  ownerId: string;
  systemChannelId?: string | null;
  afkChannelId?: string | null;
  afkTimeout?: number;
  createdAt?: string;
  /** Only on `GET /guilds/:id`. */
  roles?: RawRoleData[];
  /** Only on `GET /guilds/:id`. */
  channels?: RawChannelData[];
  /** The caller's own permissions in the server (only on `GET /guilds/:id`). */
  permissions?: string;
  /** The caller's own roles (only on `GET /guilds/:id`). */
  myRoleIds?: string[];
  /** How many members the server has (on `GET /guilds/:id`). */
  memberCount?: number;
}

/** A role. */
export interface RawRoleData {
  id: string;
  guildId?: string;
  name: string;
  color?: number;
  position?: number;
  permissions?: string;
  hoist?: boolean;
  mentionable?: boolean;
  isEveryone?: boolean;
  managed?: boolean;
  createdAt?: string;
}

/** Bisim's channel types. */
export type RawChannelType = 'GUILD_CATEGORY' | 'GUILD_TEXT' | 'GUILD_VOICE' | 'DM' | 'GROUP_DM';

/** A permission overwrite. */
export interface RawOverwriteData {
  /** The role or member id (Bisim calls it `targetId` in some places). */
  id?: string;
  targetId?: string;
  channelId?: string;
  type: number;
  allow: string;
  deny: string;
}

/** A channel, in a server or a DM. */
export interface RawChannelData {
  id: string;
  guildId?: string | null;
  type: RawChannelType;
  name?: string | null;
  topic?: string | null;
  parentId?: string | null;
  permissionsSynced?: boolean;
  position?: number;
  nsfw?: boolean;
  slowmodeSec?: number;
  lastMessageId?: string | null;
  createdAt?: string;
  /** The caller's own permissions in the channel. */
  permissions?: string;
  isPrivate?: boolean;
  permissionOverwrites?: RawOverwriteData[];
  /** DMs only. */
  participants?: RawUserData[];
  ownerId?: string | null;
  iconKey?: string | null;
}

/** A member of a server. */
export interface RawMemberData {
  guildId?: string;
  userId: string;
  nickname?: string | null;
  roleIds?: string[];
  joinedAt?: string | null;
  timeoutUntil?: string | null;
  user?: RawUserData | null;
  permissions?: string;
}

/** An attachment on a message. */
export interface RawAttachmentData {
  id: string;
  kind?: 'IMAGE' | 'VIDEO' | 'AUDIO' | 'FILE' | string;
  fileName: string;
  contentType?: string | null;
  sizeBytes?: number | string;
  width?: number | null;
  height?: number | null;
  description?: string | null;
  spoiler?: boolean;
  url: string;
  blocked?: boolean;
  durationSecs?: number | null;
  waveform?: string | null;
  gif?: boolean;
}

/** An embed as Bisim sends it on a message (flat). */
export interface RawEmbedData {
  url?: string | null;
  type?: string;
  title?: string | null;
  description?: string | null;
  siteName?: string | null;
  imageUrl?: string | null;
  imageWidth?: number | null;
  imageHeight?: number | null;
  color?: number | null;
  authorName?: string | null;
  authorUrl?: string | null;
  footerText?: string | null;
  timestamp?: string | null;
  fields?: { name: string; value: string; inline?: boolean }[];
}

/** A reaction on a message. */
export interface RawReactionData {
  emoji: string;
  count: number;
  me?: boolean;
}

/** A poll on a message. */
export interface RawPollData {
  question: string;
  answers: { id: number; text: string; emoji?: string | null }[];
  multiselect?: boolean;
  expiresAt?: string | null;
  endedAt?: string | null;
  counts?: { answerId: number; count: number }[];
  total?: number;
  myAnswerIds?: number[];
}

/** A component on a message, in Bisim's camelCase form. */
export interface RawComponentData {
  type: number;
  style?: number;
  label?: string;
  emoji?: { id?: string | null; name?: string | null; animated?: boolean } | null;
  customId?: string;
  url?: string;
  disabled?: boolean;
  placeholder?: string;
  minValues?: number;
  maxValues?: number;
  minLength?: number;
  maxLength?: number;
  required?: boolean;
  value?: string;
  options?: {
    label: string;
    value: string;
    description?: string;
    emoji?: { id?: string | null; name?: string | null; animated?: boolean } | null;
    default?: boolean;
  }[];
  channelTypes?: (string | number)[];
  components?: RawComponentData[];
}

/** A message. */
export interface RawMessageData {
  id: string;
  channelId: string;
  guildId?: string | null;
  authorId?: string;
  type?: string;
  content?: string;
  referencedMessageId?: string | null;
  referencedMessage?: {
    id: string;
    channelId: string;
    authorId?: string;
    content?: string;
    deleted?: boolean;
    author?: RawUserData | null;
  } | null;
  nonce?: string | null;
  pinned?: boolean;
  editedAt?: string | null;
  createdAt?: string;
  author?: RawUserData;
  attachments?: RawAttachmentData[];
  embeds?: RawEmbedData[];
  reactions?: RawReactionData[];
  poll?: RawPollData | null;
  webhookId?: string | null;
  interaction?: { name: string; userId: string; username?: string } | null;
  ephemeral?: boolean;
  components?: RawComponentData[];
  loading?: boolean;
  flags?: number;
}

/** A custom emoji. */
export interface RawEmojiData {
  id: string;
  guildId?: string;
  name: string;
  objectKey?: string;
  creatorId?: string | null;
  createdAt?: string;
  animated?: boolean;
}

/** A sticker. */
export interface RawStickerData {
  id: string;
  guildId?: string;
  name: string;
  objectKey?: string;
  creatorId?: string | null;
  createdAt?: string;
}

/** A ban. */
export interface RawBanData {
  guildId: string;
  userId: string;
  reason?: string | null;
  bannedById?: string | null;
  createdAt?: string;
  user?: RawUserData | null;
}

/** An invite. */
export interface RawInviteData {
  code: string;
  guildId?: string;
  channelId?: string | null;
  inviterId?: string;
  maxUses?: number | null;
  uses?: number;
  maxAgeSec?: number | null;
  expiresAt?: string | null;
  createdAt?: string;
  inviter?: RawUserData | null;
  channelName?: string | null;
  guild?: { id: string; name: string; iconKey?: string | null; description?: string | null; splashKey?: string | null; createdAt?: string };
  memberCount?: number;
  onlineCount?: number;
}

/** A webhook. */
export interface RawWebhookData {
  id: string;
  guildId: string;
  channelId: string;
  name: string;
  avatarKey?: string | null;
  token?: string;
  url?: string;
  creator?: RawUserData | null;
  createdAt?: string;
}

/** Someone in a voice channel. */
export interface RawVoiceStateData {
  channelId?: string | null;
  guildId?: string | null;
  userId: string;
  username?: string;
  displayName?: string;
  avatarKey?: string;
  user?: RawUserData;
  left?: boolean;
  serverMuted?: boolean;
  serverDeafened?: boolean;
  selfMuted?: boolean;
  selfDeafened?: boolean;
  selfVideo?: boolean;
  selfStream?: boolean;
}

/** A presence, as the gateway sends it. */
export interface RawPresenceData {
  userId: string;
  guildId?: string;
  status?: string;
  customText?: string;
  customEmoji?: string;
  activityType?: number;
  activityName?: string;
}

/** An application command, as Bisim stores it. */
export interface RawApplicationCommandData {
  id: string;
  appId?: string;
  applicationId?: string;
  guildId?: string | null;
  type?: number | string;
  name: string;
  description?: string;
  options?: RawApplicationCommandOptionData[];
  defaultMemberPermissions?: string | null;
  contexts?: (string | number)[] | null;
  nameLocalizations?: Record<string, string> | null;
  descriptionLocalizations?: Record<string, string> | null;
  nsfw?: boolean;
  version?: string;
}

/** An option of an application command. */
export interface RawApplicationCommandOptionData {
  type: string | number;
  name: string;
  description?: string;
  required?: boolean;
  choices?: { name: string; value: string | number; nameLocalizations?: Record<string, string> | null }[];
  minValue?: number | null;
  maxValue?: number | null;
  minLength?: number | null;
  maxLength?: number | null;
  autocomplete?: boolean;
  channelTypes?: (string | number)[];
  options?: RawApplicationCommandOptionData[];
  nameLocalizations?: Record<string, string> | null;
  descriptionLocalizations?: Record<string, string> | null;
}

/** An option value in an interaction payload. */
export interface RawInteractionOptionData {
  name: string;
  type: string | number;
  value?: string | number | boolean;
  options?: RawInteractionOptionData[];
  focused?: boolean;
}

/** The member who ran an interaction, in its payload. */
export interface RawInteractionMemberData {
  userId: string;
  username?: string;
  displayName?: string | null;
  avatarKey?: string | null;
  roleIds?: string[];
  nickname?: string | null;
  joinedAt?: string | null;
  permissions?: string;
  timeoutUntil?: string | null;
  bot?: boolean;
}

/** Objects an interaction's options and targets point at. */
export interface RawResolvedData {
  users?: Record<string, RawUserData> | RawUserData[];
  members?: Record<string, RawMemberData> | RawMemberData[];
  roles?: Record<string, RawRoleData> | RawRoleData[];
  channels?: Record<string, RawChannelData> | RawChannelData[];
  messages?: Record<string, RawMessageData> | RawMessageData[];
  attachments?: Record<string, RawAttachmentData> | RawAttachmentData[];
}

/** An interaction payload, from the gateway or an Interactions URL. */
export interface RawInteractionData {
  id: string;
  type: number;
  token: string;
  applicationId: string;
  guildId?: string | null;
  channelId?: string | null;
  user?: RawUserData;
  member?: RawInteractionMemberData | null;
  locale?: string;
  guildLocale?: string;
  appPermissions?: string;
  context?: number | string;
  message?: RawMessageData;
  version?: number;
  data?: {
    id?: string;
    name?: string;
    type?: number | string;
    targetId?: string;
    guildId?: string;
    options?: RawInteractionOptionData[];
    resolved?: RawResolvedData;
    componentType?: number;
    customId?: string;
    values?: string[];
    fields?: { customId: string; value: string; type?: number }[];
    components?: RawComponentData[];
  };
}

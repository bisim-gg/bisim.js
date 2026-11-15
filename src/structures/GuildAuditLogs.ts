import type { RawUserData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { AuditLogEvent } from '../util/Enums.js';
import { toTimestamp } from '../util/Util.js';
import type { Channel } from './channels/index.js';
import type { Guild } from './Guild.js';
import type { Role } from './Role.js';
import type { User } from './User.js';
import { dateFrom } from '../util/internal.js';

/**
 * An audit log entry as Bisim sends it.
 */
export interface RawAuditLogEntry {
  id: string;
  guildId?: string;
  actorId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  meta: Record<string, unknown> | null;
  createdAt: string;
  actor: RawUserData | null;
  target: RawUserData | null;
}

/**
 * Bisim's action names with a Discord counterpart, and that counterpart. A timeout, a server mute or deafen
 * is a member update on Discord, a channel's permission sync a channel update, and an ownership transfer a
 * server update. `AUTOMOD_ACTION` depends on what the rule did (see {@link auditActionOf}).
 */
const AUDIT_ACTIONS: Readonly<Record<string, AuditLogEvent>> = {
  GUILD_UPDATE: AuditLogEvent.GuildUpdate,
  GUILD_OWNERSHIP_TRANSFER: AuditLogEvent.GuildUpdate,
  CHANNEL_CREATE: AuditLogEvent.ChannelCreate,
  CHANNEL_UPDATE: AuditLogEvent.ChannelUpdate,
  CHANNEL_SYNC: AuditLogEvent.ChannelUpdate,
  CHANNEL_DELETE: AuditLogEvent.ChannelDelete,
  CHANNEL_OVERWRITE_CREATE: AuditLogEvent.ChannelOverwriteCreate,
  CHANNEL_OVERWRITE_UPDATE: AuditLogEvent.ChannelOverwriteUpdate,
  CHANNEL_OVERWRITE_DELETE: AuditLogEvent.ChannelOverwriteDelete,
  MEMBER_KICK: AuditLogEvent.MemberKick,
  MEMBER_BAN: AuditLogEvent.MemberBanAdd,
  MEMBER_UNBAN: AuditLogEvent.MemberBanRemove,
  MEMBER_UPDATE: AuditLogEvent.MemberUpdate,
  MEMBER_TIMEOUT: AuditLogEvent.MemberUpdate,
  MEMBER_TIMEOUT_REMOVE: AuditLogEvent.MemberUpdate,
  VOICE_MUTE: AuditLogEvent.MemberUpdate,
  VOICE_UNMUTE: AuditLogEvent.MemberUpdate,
  VOICE_DEAFEN: AuditLogEvent.MemberUpdate,
  VOICE_UNDEAFEN: AuditLogEvent.MemberUpdate,
  MEMBER_ROLE_UPDATE: AuditLogEvent.MemberRoleUpdate,
  VOICE_MOVE: AuditLogEvent.MemberMove,
  VOICE_DISCONNECT: AuditLogEvent.MemberDisconnect,
  BOT_ADD: AuditLogEvent.BotAdd,
  ROLE_CREATE: AuditLogEvent.RoleCreate,
  ROLE_UPDATE: AuditLogEvent.RoleUpdate,
  ROLE_DELETE: AuditLogEvent.RoleDelete,
  INVITE_CREATE: AuditLogEvent.InviteCreate,
  INVITE_UPDATE: AuditLogEvent.InviteUpdate,
  INVITE_DELETE: AuditLogEvent.InviteDelete,
  WEBHOOK_CREATE: AuditLogEvent.WebhookCreate,
  WEBHOOK_UPDATE: AuditLogEvent.WebhookUpdate,
  WEBHOOK_DELETE: AuditLogEvent.WebhookDelete,
  EMOJI_CREATE: AuditLogEvent.EmojiCreate,
  EMOJI_UPDATE: AuditLogEvent.EmojiUpdate,
  EMOJI_DELETE: AuditLogEvent.EmojiDelete,
  MESSAGE_DELETE: AuditLogEvent.MessageDelete,
  MESSAGE_BULK_DELETE: AuditLogEvent.MessageBulkDelete,
  MESSAGE_PIN: AuditLogEvent.MessagePin,
  MESSAGE_UNPIN: AuditLogEvent.MessageUnpin,
  STICKER_CREATE: AuditLogEvent.StickerCreate,
  STICKER_UPDATE: AuditLogEvent.StickerUpdate,
  STICKER_DELETE: AuditLogEvent.StickerDelete,
  SOUND_CREATE: AuditLogEvent.SoundboardSoundCreate,
  SOUND_UPDATE: AuditLogEvent.SoundboardSoundUpdate,
  SOUND_DELETE: AuditLogEvent.SoundboardSoundDelete,
  AUTOMOD_RULE_CREATE: AuditLogEvent.AutoModerationRuleCreate,
  AUTOMOD_RULE_UPDATE: AuditLogEvent.AutoModerationRuleUpdate,
  AUTOMOD_RULE_DELETE: AuditLogEvent.AutoModerationRuleDelete,
  VOICE_STATUS_UPDATE: AuditLogEvent.VoiceChannelStatusUpdate,
};

/**
 * Discord's number for one of Bisim's audit log actions, or `null` when Discord has none (a server template,
 * for example).
 *
 * @param name - Bisim's name, for example `MEMBER_BAN`
 * @param meta - The entry's details (they say what an AutoMod action did)
 * @internal
 */
export function auditActionOf(name: string, meta?: Record<string, unknown> | null): AuditLogEvent | null {
  if (name === 'AUTOMOD_ACTION') {
    if (meta?.blocked) return AuditLogEvent.AutoModerationBlockMessage;
    if (meta?.timedOut) return AuditLogEvent.AutoModerationUserCommunicationDisabled;
    return AuditLogEvent.AutoModerationFlagToChannel;
  }
  return AUDIT_ACTIONS[name] ?? null;
}

/**
 * Whether an entry records something made, changed or removed, as discord.js groups actions.
 */
export type AuditLogActionType = 'Create' | 'Update' | 'Delete' | 'All';

/**
 * What an entry acted on, with discord.js's names.
 */
export type AuditLogTargetType =
  | 'Guild'
  | 'Channel'
  | 'User'
  | 'Role'
  | 'Invite'
  | 'Webhook'
  | 'Emoji'
  | 'Message'
  | 'Sticker'
  | 'SoundboardSound'
  | 'AutoModerationRule'
  | 'Unknown';

/** Names that end without saying whether something was made or removed, and which they are. */
const NAMED_KINDS: Readonly<Record<string, AuditLogActionType>> = {
  MEMBER_KICK: 'Delete',
  MEMBER_BAN: 'Delete',
  MEMBER_UNBAN: 'Create',
  VOICE_DISCONNECT: 'Delete',
  MESSAGE_PIN: 'Create',
  MESSAGE_UNPIN: 'Delete',
  MESSAGE_BULK_DELETE: 'Delete',
  BOT_ADD: 'Create',
  AUTOMOD_ACTION: 'Create',
};

function actionKindOf(name: string): AuditLogActionType {
  const named = NAMED_KINDS[name];
  if (named) return named;
  if (name.endsWith('_CREATE')) return 'Create';
  if (name.endsWith('_DELETE') || name.endsWith('_REMOVE')) return 'Delete';
  return 'Update';
}

/** Bisim's target kinds and discord.js's names for them. */
const TARGET_TYPES: Readonly<Record<string, AuditLogTargetType>> = {
  guild: 'Guild',
  channel: 'Channel',
  member: 'User',
  user: 'User',
  role: 'Role',
  invite: 'Invite',
  webhook: 'Webhook',
  emoji: 'Emoji',
  message: 'Message',
  sticker: 'Sticker',
  sound: 'SoundboardSound',
  automod: 'AutoModerationRule',
};

/**
 * One change an entry records: a field with its value before and after.
 */
export interface AuditLogChange {
  key: string;
  old?: unknown;
  new?: unknown;
}

/**
 * One entry of a server's audit log, from `guild.fetchAuditLogs()` or the `GuildAuditLogEntryCreate` event.
 * `action` is Discord's number ({@link AuditLogEvent}), so `entry.action === AuditLogEvent.MemberBanAdd`
 * works; Bisim's own name for it is {@link GuildAuditLogsEntry.actionName}.
 */
export class GuildAuditLogsEntry {
  /** The id. */
  public id: string;
  /** What happened, as Discord numbers it, or Bisim's name when Discord has no number for it. */
  public action: AuditLogEvent | string;
  /** Bisim's name for what happened, for example `MEMBER_BAN` (Bisim's own addition). */
  public actionName: string;
  /** Whether something was made, changed or removed. */
  public actionType: AuditLogActionType;
  /** What kind of thing was acted on, or `null` for nothing. */
  public targetType: AuditLogTargetType | null;
  /** The id of who did it, or `null` when Bisim did it (AutoMod). */
  public executorId: string | null;
  /** Who did it, when known. */
  public executor: User | null;
  /** The id of what was acted on. */
  public targetId: string | null;
  /** What was acted on, when it is cached: a user, channel, role or the server. */
  public target: User | Channel | Role | Guild | null;
  /** Why, when a reason was given. */
  public reason: string | null;
  /** Everything else Bisim recorded. */
  public extra: Record<string, unknown> | null;
  /** The fields an update changed, with their values before and after. */
  public changes: AuditLogChange[];
  /** When it happened, in milliseconds. */
  public createdTimestamp: number;

  /**
   * @param guild - The server
   * @param data - The entry from Bisim
   */
  public constructor(guild: Guild, data: RawAuditLogEntry) {
    const { users } = guild.client;
    this.id = data.id;
    this.actionName = data.action;
    this.action = auditActionOf(data.action, data.meta) ?? data.action;
    this.actionType = actionKindOf(data.action);
    this.targetType = data.targetType ? (TARGET_TYPES[data.targetType] ?? 'Unknown') : null;
    this.executorId = data.actorId;
    this.executor = data.actor ? users._add(data.actor) : data.actorId ? (users.cache.get(data.actorId) ?? null) : null;
    this.targetId = data.targetId;
    this.target = this.resolveTarget(guild, data);
    this.reason = typeof data.meta?.reason === 'string' ? data.meta.reason : null;
    this.extra = data.meta;
    this.changes = Array.isArray(data.meta?.changes)
      ? (data.meta.changes as unknown[]).filter((change): change is AuditLogChange => typeof (change as AuditLogChange)?.key === 'string')
      : [];
    this.createdTimestamp = toTimestamp(data.createdAt) ?? 0;
  }

  private resolveTarget(guild: Guild, data: RawAuditLogEntry): User | Channel | Role | Guild | null {
    if (data.target) return guild.client.users._add(data.target);
    const id = data.targetId;
    if (!id) return null;
    switch (this.targetType) {
      case 'User':
        return guild.client.users.cache.get(id) ?? null;
      case 'Channel':
        return guild.client.channels.cache.get(id) ?? null;
      case 'Role':
        return guild.roles.cache.get(id) ?? null;
      case 'Guild':
        return guild;
      default:
        return null;
    }
  }

  /**
   * When it happened.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }
}

/**
 * A page of a server's audit log.
 */
export class GuildAuditLogs {
  /** The entries, newest first. */
  public entries: Collection<string, GuildAuditLogsEntry>;

  /**
   * @param guild - The server
   * @param entries - The entries from Bisim
   */
  public constructor(guild: Guild, entries: RawAuditLogEntry[]) {
    this.entries = new Collection(entries.map((entry) => [entry.id, new GuildAuditLogsEntry(guild, entry)]));
  }
}

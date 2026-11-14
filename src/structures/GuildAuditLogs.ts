import type { RawUserData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { toTimestamp } from '../util/Util.js';
import type { Guild } from './Guild.js';
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
 * One entry of a server's audit log. Bisim names its actions (`CHANNEL_CREATE`, `MEMBER_KICK`...) rather than
 * numbering them, so `action` is that name.
 */
export class GuildAuditLogsEntry {
  /** The id. */
  public id: string;
  /** Bisim's name for what happened, for example `ROLE_UPDATE`. */
  public action: string;
  /** The same as {@link GuildAuditLogsEntry.action}. */
  public actionType: string;
  /** What kind of thing was acted on, for example `USER` or `CHANNEL`. */
  public targetType: string | null;
  /** Who did it. */
  public executorId: string | null;
  /** Who did it, when known. */
  public executor: User | null;
  /** What was acted on. */
  public targetId: string | null;
  /** The user acted on, when the target is a user. */
  public target: User | null;
  /** Why, when a reason was given. */
  public reason: string | null;
  /** Everything else Bisim recorded. */
  public extra: Record<string, unknown> | null;
  /** Always empty: Bisim records the details in `extra`. */
  public changes: { key: string; old?: unknown; new?: unknown }[] = [];
  /** When it happened, in milliseconds. */
  public createdTimestamp: number;

  /**
   * @param guild - The server
   * @param data - The entry from Bisim
   */
  public constructor(guild: Guild, data: RawAuditLogEntry) {
    this.id = data.id;
    this.action = data.action;
    this.actionType = data.action;
    this.targetType = data.targetType;
    this.executorId = data.actorId;
    this.executor = data.actor ? guild.client.users._add(data.actor) : null;
    this.targetId = data.targetId;
    this.target = data.target ? guild.client.users._add(data.target) : null;
    this.reason = typeof data.meta?.reason === 'string' ? data.meta.reason : null;
    this.extra = data.meta;
    this.createdTimestamp = toTimestamp(data.createdAt) ?? 0;
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

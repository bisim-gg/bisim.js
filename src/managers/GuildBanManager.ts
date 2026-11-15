import { BisimjsError, BisimjsTypeError, ErrorCodes } from '../errors/index.js';
import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { Guild } from '../structures/Guild.js';
import { GuildBan } from '../structures/GuildBan.js';
import type { User } from '../structures/User.js';
import type { RawBanData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { CachedManager } from './BaseManager.js';
import type { UserResolvable } from './UserManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * Options for banning.
 */
export interface BanOptions {
  /** How many seconds of their messages to delete (0 to 604800). */
  deleteMessageSeconds?: number;
  /**
   * How many days of their messages to delete.
   *
   * @deprecated Use `deleteMessageSeconds`
   */
  deleteMessageDays?: number;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * Options for banning many users at once.
 */
export interface BulkBanOptions {
  /** How many seconds of their messages to delete (0 to 604800). */
  deleteMessageSeconds?: number;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * What {@link GuildBanManager.bulkCreate} resolves with.
 */
export interface BulkBanResult {
  /** The ids of those banned. */
  bannedUsers: string[];
  /** The ids of those that could not be banned (the owner, someone above the bot, an unknown id). */
  failedUsers: string[];
}

/**
 * Manages the bans of a server.
 */
export class GuildBanManager extends CachedManager<string, GuildBan, UserResolvable | GuildBan> {
  /** The server. */
  public declare readonly guild: Guild;

  /**
   * @param guild - The server
   */
  public constructor(guild: Guild) {
    super(guild.client);
    attachHidden(this, 'guild', guild);
  }

  /**
   * Adds a ban to the cache.
   *
   * @internal
   */
  public _add(data: RawBanData, cache = true): GuildBan {
    const refreshed = this.refreshCached(data.userId, data);
    if (refreshed) return refreshed;
    const ban = new GuildBan(this.client, data, this.guild);
    if (cache) this.cache.set(data.userId, ban);
    return ban;
  }

  /**
   * Fetches one ban by user, or every ban of the server.
   *
   * @param options - A user, or options
   */
  public fetch(options: UserResolvable | { user: UserResolvable; cache?: boolean; force?: boolean }): Promise<GuildBan>;
  public fetch(options?: { cache?: boolean; limit?: number; before?: string; after?: string }): Promise<Collection<string, GuildBan>>;
  public async fetch(options?: unknown): Promise<GuildBan | Collection<string, GuildBan>> {
    const single =
      typeof options === 'string'
        ? options
        : options && typeof options === 'object' && 'user' in options
          ? this.client.users.resolveId((options as { user: UserResolvable }).user)
          : options && typeof options === 'object' && 'id' in options
            ? (options as { id: string }).id
            : null;
    const cache = (options as { cache?: boolean } | undefined)?.cache ?? true;
    if (single) {
      if (!(options as { force?: boolean } | undefined)?.force) {
        const cached = this.fromCache(single);
        if (cached) return cached;
      }
      try {
        const raw = (await this.client.rest.get(Routes.guildBan(this.guild.id, single))) as RawBanData;
        return this._add(raw, cache);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        const all = await this.fetch({ cache });
        const found = all.get(single);
        if (!found) throw new BisimjsError(ErrorCodes.FetchBanResolveId);
        return found;
      }
    }
    const data = (await this.client.rest.get(Routes.guildBans(this.guild.id))) as RawBanData[];
    const bans = new Collection<string, GuildBan>();
    for (const raw of data) bans.set(raw.userId, this._add(raw, cache));
    return bans;
  }

  /**
   * Bans a user.
   *
   * @param user - The user
   * @param options - The reason and how much of their history to delete
   */
  public async create(user: UserResolvable, options: BanOptions = {}): Promise<GuildMemberOrUser> {
    const id = this.bannedId(user, true);
    const body: Record<string, unknown> = {};
    if (options.reason) body.reason = options.reason;
    const seconds = options.deleteMessageSeconds ?? (options.deleteMessageDays !== undefined ? options.deleteMessageDays * 86_400 : undefined);
    if (seconds !== undefined) body.deleteMessageSeconds = Math.min(604_800, Math.max(0, Math.floor(seconds)));
    await this.client.rest.put(Routes.guildBan(this.guild.id, id), { body, reason: options.reason });
    return this.guild.members.cache.get(id) ?? this.client.users.cache.get(id) ?? id;
  }

  /**
   * Lifts a ban.
   *
   * @param user - The user
   * @param reason - Why
   */
  public async remove(user: UserResolvable, reason?: string): Promise<User | null> {
    const id = this.bannedId(user, false);
    const route = Routes.guildBan(this.guild.id, id);
    await this.client.rest.delete(route, { reason });
    this.cache.delete(id);
    return this.client.users.cache.get(id) ?? null;
  }

  /** The id of the user to ban or unban; throws when it cannot be read. */
  private bannedId(user: UserResolvable, banning: boolean): string {
    const id = this.client.users.resolveId(user);
    if (id) return id;
    throw banning ? new BisimjsError(ErrorCodes.BanResolveId, true) : new BisimjsError(ErrorCodes.BanResolveId);
  }

  /**
   * Bans up to 200 users at once (needs Ban Members and Manage Server). Bisim answers 400 `BULK_BAN_FAILED` when
   * nobody could be banned.
   *
   * @param users - The users
   * @param options - The reason and how much of their history to delete
   * @example
   * ```js
   * const { bannedUsers, failedUsers } = await guild.bans.bulkCreate(['123', '456'], { deleteMessageSeconds: 3600 });
   * ```
   */
  public async bulkCreate(
    users: readonly UserResolvable[] | Collection<string, UserResolvable>,
    options: BulkBanOptions = {},
  ): Promise<BulkBanResult> {
    const list = users instanceof Collection ? [...users.values()] : Array.isArray(users) ? [...users] : null;
    if (list === null) throw new BisimjsTypeError(ErrorCodes.InvalidType, 'users', 'list or Collection of users');
    if (!options || typeof options !== 'object') throw new BisimjsTypeError(ErrorCodes.InvalidType, 'options', 'object', true);
    const userIds = [...new Set(list.map((user) => this.client.users.resolveId(user)).filter((id): id is string => Boolean(id)))];
    if (!userIds.length) throw new BisimjsError(ErrorCodes.BulkBanUsersOptionEmpty);
    const body: Record<string, unknown> = { userIds };
    if (options.deleteMessageSeconds !== undefined) {
      body.deleteMessageSeconds = Math.min(604_800, Math.max(0, Math.floor(options.deleteMessageSeconds)));
    }
    if (options.reason) body.reason = options.reason;
    const result = (await this.client.rest.post(Routes.guildBulkBan(this.guild.id), { body, reason: options.reason })) as Partial<BulkBanResult>;
    return { bannedUsers: result?.bannedUsers ?? [], failedUsers: result?.failedUsers ?? [] };
  }
}

type GuildMemberOrUser = import('../structures/GuildMember.js').GuildMember | User | string;

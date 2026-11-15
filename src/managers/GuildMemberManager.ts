import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { BisimAPIError } from '../rest/errors.js';
import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { VoiceChannel } from '../structures/channels/VoiceChannel.js';
import type { Guild } from '../structures/Guild.js';
import { GuildMember } from '../structures/GuildMember.js';
import type { Role } from '../structures/Role.js';
import type { User } from '../structures/User.js';
import type { RawMemberData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { notSupported } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';
import type { BanOptions } from './GuildBanManager.js';
import type { RoleResolvable } from './GuildMemberRoleManager.js';
import type { UserResolvable } from './UserManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * A member, by structure, user or id.
 */
export type GuildMemberResolvable = GuildMember | UserResolvable;

/**
 * Options for editing a member.
 */
export interface GuildMemberEditOptions {
  /** The nickname, or `null` to clear it. */
  nick?: string | null;
  /** The roles to have (replaces them all). */
  roles?: readonly RoleResolvable[] | Collection<string, Role>;
  /** Server mute in voice. */
  mute?: boolean;
  /** Server deafen in voice. */
  deaf?: boolean;
  /** Move to a voice channel, or disconnect with `null`. */
  channel?: VoiceChannel | string | null;
  /** Time out until this moment, or `null` to end a timeout. */
  communicationDisabledUntil?: Date | number | string | null;
  /** Not on Bisim. */
  flags?: unknown;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * Options for fetching members.
 */
export interface FetchMembersOptions {
  /** One member or several, by id. */
  user?: UserResolvable | readonly UserResolvable[];
  /** Search members whose names start with this. */
  query?: string;
  /** How many, for a search. */
  limit?: number;
  /** Whether to cache them. */
  cache?: boolean;
  /** Whether to skip the cache. */
  force?: boolean;
  /** Accepted for compatibility. */
  withPresences?: boolean;
  /** Accepted for compatibility. */
  time?: number;
  /** Accepted for compatibility. */
  nonce?: string;
}

/**
 * Options for fetching one member.
 */
export interface FetchMemberOptions {
  user: UserResolvable;
  cache?: boolean;
  force?: boolean;
}

const PAGE_SIZE = 1000;

/**
 * Manages the members of a server.
 */
export class GuildMemberManager extends CachedManager<string, GuildMember, GuildMemberResolvable> {
  /** The server. */
  public declare readonly guild: Guild;

  /**
   * @param guild - The server
   */
  public constructor(guild: Guild) {
    super(guild.client);
    attachHidden(this, 'guild', guild);
  }

  /** The id of a member given as a structure or an id; throws a `TypeError` naming the action otherwise. */
  private memberIdOf(user: GuildMemberResolvable, action: string): string {
    const id = this.resolveId(user);
    if (!id) throw new TypeError(`Could not resolve the member to ${action}.`);
    return id;
  }

  /**
   * The bot as a member of this server, or `null` when not cached.
   */
  public get me(): GuildMember | null {
    const botId = this.client.user.id;
    return this.cache.get(botId) ?? null;
  }

  /**
   * Adds a member to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawMemberData, cache = true): GuildMember {
    const id = data.userId ?? data.user?.id;
    const refreshed = this.refreshCached(id, data);
    if (refreshed) return refreshed;
    const member = new GuildMember(this.client, data, this.guild);
    if (cache) this.cache.set(member.id, member);
    return member;
  }

  /**
   * Resolves a member from a member, user or id.
   *
   * @param member - The member
   */
  public override resolve(member: GuildMemberResolvable): GuildMember | null {
    if (member instanceof GuildMember) return member;
    const id = this.client.users.resolveId(member as UserResolvable);
    return id ? (this.cache.get(id) ?? null) : null;
  }

  /**
   * Resolves a member's id from a member, user or id.
   *
   * @param member - The member
   */
  public override resolveId(member: GuildMemberResolvable): string | null {
    if (member instanceof GuildMember) return member.id;
    return this.client.users.resolveId(member as UserResolvable);
  }

  /**
   * Fetches one member, several, a search, or all of them. All of them needs the Server Members intent
   * switched on for the app in the Developer Portal; without it the promise rejects with `MissingIntent`.
   *
   * @param options - A user, or what to fetch
   * @example
   * ```js
   * const member = await guild.members.fetch('123');
   * const everyone = await guild.members.fetch();
   * ```
   */
  public fetch(options: UserResolvable | FetchMemberOptions | (FetchMembersOptions & { user: UserResolvable })): Promise<GuildMember>;
  public fetch(options?: FetchMembersOptions): Promise<Collection<string, GuildMember>>;
  public async fetch(
    options?: UserResolvable | FetchMemberOptions | FetchMembersOptions,
  ): Promise<GuildMember | Collection<string, GuildMember>> {
    if (options === undefined) return this.fetchAll(true);
    const userId = this.client.users.resolveId(options as UserResolvable);
    if (typeof options === 'string' || (userId && !(options as FetchMembersOptions).query && !('user' in (options as object)))) {
      return this.fetchSingle(userId!, true, false);
    }
    const fetchOptions = options as FetchMembersOptions;
    if (fetchOptions.user !== undefined) {
      if (Array.isArray(fetchOptions.user)) {
        const ids = (fetchOptions.user as readonly UserResolvable[]).map((user) => this.client.users.resolveId(user)!);
        const members = new Collection<string, GuildMember>();
        for (const id of ids) members.set(id, await this.fetchSingle(id, fetchOptions.cache ?? true, fetchOptions.force ?? false));
        return members;
      }
      const id = this.client.users.resolveId(fetchOptions.user as UserResolvable);
      if (!id) throw new TypeError('Could not resolve the user to fetch.');
      return this.fetchSingle(id, fetchOptions.cache ?? true, fetchOptions.force ?? false);
    }
    if (fetchOptions.query !== undefined) return this.search({ query: fetchOptions.query, limit: fetchOptions.limit, cache: fetchOptions.cache });
    return this.fetchAll(fetchOptions.cache ?? true);
  }

  private async fetchSingle(id: string, cache: boolean, force: boolean): Promise<GuildMember> {
    if (!force) {
      const cached = this.fromCache(id);
      if (cached) return cached;
    }
    try {
      const raw = (await this.client.rest.get(Routes.guildMember(this.guild.id, id))) as RawMemberData;
      return this._add(raw, cache);
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
      const all = await this.fetchAll(cache);
      const found = all.get(id);
      if (!found) throw error;
      return found;
    }
  }

  /**
   * Fetches every member, page by page.
   *
   * @internal
   */
  public async fetchAll(cache = true): Promise<Collection<string, GuildMember>> {
    const members = new Collection<string, GuildMember>();
    let after: string | undefined;
    for (;;) {
      const page = await this.fetchPage(PAGE_SIZE, after);
      let added = 0;
      for (const raw of page) {
        const member = this._add(raw, cache);
        if (!members.has(member.id)) added++;
        members.set(member.id, member);
      }
      if (page.length < PAGE_SIZE || page.length > PAGE_SIZE || added === 0) break;
      after = page[page.length - 1]!.userId;
    }
    if (cache && !this.guild._memberCountKnown) this.guild.memberCount = Math.max(this.guild.memberCount, members.size);
    return members;
  }

  /**
   * One page of the member list. Bisim gives the list only to a bot whose app has the Server Members intent
   * switched on, and answers 403 `MISSING_INTENT` otherwise: that becomes a `MissingIntent` error saying so.
   */
  private async fetchPage(limit: number, after: string | undefined): Promise<RawMemberData[]> {
    try {
      return (await this.client.rest.get(Routes.guildMembers(this.guild.id), { query: { limit, after } })) as RawMemberData[];
    } catch (error) {
      if (error instanceof BisimAPIError && error.code === 'MISSING_INTENT') {
        throw new BisimjsError(ErrorCodes.MissingIntent, "Listing a server's members", 'Server Members Intent');
      }
      throw error;
    }
  }

  /**
   * Fetches the bot's own member.
   *
   * @param options - Whether to cache or skip the cache
   */
  public fetchMe(options: { cache?: boolean; force?: boolean } = {}): Promise<GuildMember> {
    return this.fetchSingle(this.client.user.id, options.cache ?? true, options.force ?? false);
  }

  /**
   * Searches members whose username, display name or nickname starts with a query.
   *
   * @param options - The query and how many
   */
  public async search(options: { query: string; limit?: number; cache?: boolean }): Promise<Collection<string, GuildMember>> {
    const members = new Collection<string, GuildMember>();
    try {
      const data = (await this.client.rest.get(Routes.guildMembersSearch(this.guild.id), {
        query: { query: options.query, limit: options.limit ?? 1 },
      })) as RawMemberData[];
      for (const raw of data) {
        const member = this._add(raw, options.cache ?? true);
        members.set(member.id, member);
      }
      return members;
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
    }
    const query = options.query.toLowerCase();
    const all = await this.fetchAll(options.cache ?? true);
    for (const member of all.values()) {
      const names = [member.user.username, member.user.globalName, member.nickname].filter(Boolean) as string[];
      if (names.some((name) => name.toLowerCase().startsWith(query))) members.set(member.id, member);
      if (members.size >= (options.limit ?? 1)) break;
    }
    return members;
  }

  /**
   * Fetches one page of members, ordered by user id.
   *
   * @param options - How many and after whom
   */
  public async list(options: { limit?: number; after?: string; cache?: boolean } = {}): Promise<Collection<string, GuildMember>> {
    const data = await this.fetchPage(options.limit ?? 1, options.after);
    const members = new Collection<string, GuildMember>();
    for (const raw of data.slice(0, options.limit ?? 1)) {
      const member = this._add(raw, options.cache ?? true);
      members.set(member.id, member);
    }
    return members;
  }

  /**
   * Edits a member.
   *
   * @param user - The member
   * @param options - What to change
   */
  public async edit(user: GuildMemberResolvable, options: GuildMemberEditOptions): Promise<GuildMember> {
    const id = this.memberIdOf(user, 'edit');
    if (options.flags !== undefined) notSupported('Member flags');
    let data: RawMemberData | undefined;
    const isMe = id === this.client.user.id;

    if (options.nick !== undefined && isMe) {
      data = (await this.client.rest.patch(Routes.guildCurrentMemberNickname(this.guild.id), {
        body: { nickname: options.nick ?? '' },
        reason: options.reason,
      })) as RawMemberData;
    }
    const body: Record<string, unknown> = {};
    if (options.nick !== undefined && !isMe) body.nickname = options.nick ?? '';
    if (options.roles !== undefined) {
      const roles = options.roles instanceof Collection ? [...options.roles.keys()] : options.roles;
      body.roleIds = [...new Set(roles.map((role) => (typeof role === 'string' ? role : role.id)))].filter((roleId) => roleId !== this.guild.id);
    }
    if (Object.keys(body).length) {
      data = (await this.client.rest.patch(Routes.guildMember(this.guild.id, id), { body, reason: options.reason })) as RawMemberData;
    }
    const { communicationDisabledUntil } = options;
    if (communicationDisabledUntil !== undefined) {
      const until = communicationDisabledUntil === null ? null : new Date(communicationDisabledUntil).toISOString();
      data = (await this.client.rest.put(Routes.guildMemberTimeout(this.guild.id, id), {
        body: { until },
        reason: options.reason,
      })) as RawMemberData;
    }
    if (options.mute !== undefined || options.deaf !== undefined || options.channel !== undefined) {
      const state = this.guild.voiceStates.cache.get(id);
      if (!state?.channelId) throw new BisimjsError(ErrorCodes.GuildVoiceChannelResolve);
      await state.edit({ mute: options.mute, deaf: options.deaf, channel: options.channel, reason: options.reason });
    }

    if (data && typeof data === 'object' && 'userId' in data) return this.refreshCached(id, data) ?? this._add(data);
    const cachedMember = this.cache.get(id);
    if (!cachedMember) return this.fetchSingle(id, true, true);
    if (options.nick !== undefined) cachedMember.nickname = options.nick;
    return cachedMember;
  }

  /**
   * Kicks a member.
   *
   * @param user - The member
   * @param reason - Why
   */
  public async kick(user: GuildMemberResolvable, reason?: string): Promise<GuildMember | User | string> {
    const id = this.memberIdOf(user, 'kick');
    const route = Routes.guildMember(this.guild.id, id);
    await this.client.rest.delete(route, { reason });
    return this.resolve(user) ?? this.client.users.resolve(user as UserResolvable) ?? id;
  }

  /**
   * Bans a user.
   *
   * @param user - The user
   * @param options - The reason and how much of their history to delete
   */
  public async ban(user: UserResolvable, options?: BanOptions): Promise<GuildMember | User | string> {
    const { bans } = this.guild;
    await bans.create(user, options);
    return this.resolve(user) ?? this.client.users.resolve(user) ?? (this.client.users.resolveId(user) as string);
  }

  /**
   * Lifts a ban.
   *
   * @param user - The user
   * @param reason - Why
   */
  public unban(user: UserResolvable, reason?: string): Promise<User | null> {
    return this.guild.bans.remove(user, reason);
  }

  /**
   * Gives a member a role.
   *
   * @param options - The member, the role and the reason
   */
  public async addRole(options: { user: GuildMemberResolvable; role: RoleResolvable; reason?: string }): Promise<GuildMember> {
    const member = this.resolve(options.user) ?? (await this.fetchSingle(this.resolveId(options.user)!, true, false));
    return member.roles.add(options.role, options.reason);
  }

  /**
   * Takes a role from a member.
   *
   * @param options - The member, the role and the reason
   */
  public async removeRole(options: { user: GuildMemberResolvable; role: RoleResolvable; reason?: string }): Promise<GuildMember> {
    const member = this.resolve(options.user) ?? (await this.fetchSingle(this.resolveId(options.user)!, true, false));
    return member.roles.remove(options.role, options.reason);
  }

  /** Not on Bisim: pruning. */
  public prune(_options?: unknown): Promise<never> {
    return notSupported('Pruning members');
  }

  /** Not on Bisim: banning many users at once. Ban them one by one. */
  public bulkBan(_users: unknown, _options?: unknown): Promise<never> {
    return notSupported('Banning many users at once');
  }

  /** Not on Bisim: adding a user with an OAuth2 token. */
  public add(_user: unknown, _options: unknown): Promise<never> {
    return notSupported('Adding members with an OAuth2 token');
  }
}

import type { Client } from '../client/Client.js';
import { Routes } from '../rest/Routes.js';
import type { DMChannel } from '../structures/channels/DMChannel.js';
import type { Message } from '../structures/Message.js';
import type { MessageCreateOptions, MessagePayload } from '../structures/MessagePayload.js';
import { User } from '../structures/User.js';
import type { RawChannelData, RawUserData } from '../types/raw.js';
import { ChannelType } from '../util/Enums.js';
import { CachedManager } from './BaseManager.js';

/**
 * A user, by structure, member, message (its author) or id.
 */
export type UserResolvable = User | string | { user: User } | { author: User | null };

/**
 * Options for fetching.
 */
export interface BaseFetchOptions {
  /** Whether to cache the result. */
  cache?: boolean;
  /** Whether to skip the cache. */
  force?: boolean;
}

/**
 * Manages the users the client knows.
 */
export class UserManager extends CachedManager<string, User, UserResolvable> {
  /**
   * @param client - The client
   */
  public constructor(client: Client) {
    super(client);
  }

  /**
   * Adds a user to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawUserData, cache = true): User {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const me = this.client.user;
    if (me && data.id === me.id) me._patch(data);
    const user = me && data.id === me.id ? me : new User(this.client, data);
    if (cache) this.cache.set(user.id, user);
    return user;
  }

  /**
   * Resolves a user from a user, member, message or id.
   *
   * @param user - The user
   */
  public override resolve(user: UserResolvable): User | null {
    if (user && typeof user === 'object') {
      if ('user' in user && user.user instanceof User) return user.user;
      if ('author' in user) return user.author instanceof User ? user.author : null;
    }
    return super.resolve(user as User | string);
  }

  /**
   * Resolves a user's id from a user, member, message or id.
   *
   * @param user - The user
   */
  public override resolveId(user: UserResolvable): string | null {
    if (user && typeof user === 'object') {
      if ('user' in user && user.user instanceof User) return user.user.id;
      if ('author' in user) return user.author?.id ?? null;
    }
    return super.resolveId(user as User | string);
  }

  /**
   * The cached DM channel with a user, or `null`.
   *
   * @param userId - The user's id
   */
  public dmChannel(userId: string): DMChannel | null {
    return (this.client.channels.cache.find((channel) => channel.type === ChannelType.DM && (channel as DMChannel).recipientId === userId) ??
      null) as DMChannel | null;
  }

  /**
   * Opens (or reuses) the DM channel with a user. Bisim allows it when the user shares a server with the bot
   * and their DM setting lets them be messaged.
   *
   * @param user - The user
   * @param options - Whether to skip the cache
   */
  public async createDM(user: UserResolvable, options: BaseFetchOptions = {}): Promise<DMChannel> {
    const id = this.resolveId(user)!;
    if (!options.force) {
      const existing = this.dmChannel(id);
      if (existing && !existing.partial) return existing;
    }
    const data = (await this.client.rest.post(Routes.userChannels(), { body: { userId: id } })) as RawChannelData;
    const channel = this.client.channels._add({ ...data, type: data.type ?? 'DM' }, null, { cache: options.cache ?? true }) as DMChannel;
    channel.recipientId ??= id;
    return channel;
  }

  /**
   * Forgets the DM channel with a user (Bisim does not let bots close DMs).
   *
   * @param user - The user
   */
  public async deleteDM(user: UserResolvable): Promise<DMChannel> {
    const id = this.resolveId(user)!;
    const channel = this.dmChannel(id);
    if (!channel) throw new TypeError('No DM channel is cached for this user.');
    return channel.delete();
  }

  /**
   * Fetches a user.
   *
   * @param user - The user
   * @param options - Whether to cache or skip the cache
   */
  public async fetch(user: UserResolvable, options: BaseFetchOptions = {}): Promise<User> {
    const id = this.resolveId(user)!;
    if (!options.force) {
      const cached = this.fromCache(id);
      if (cached) return cached;
    }
    const data = (await this.client.rest.get(Routes.user(id))) as RawUserData;
    return this._add(data, options.cache ?? true);
  }

  /**
   * Sends a message to a user, in DMs.
   *
   * @param user - The user
   * @param options - The message
   */
  public async send(user: UserResolvable, options: string | MessagePayload | MessageCreateOptions): Promise<Message> {
    const channel = await this.createDM(user);
    return channel.send(options);
  }
}

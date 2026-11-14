import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { CategoryChannel } from '../structures/channels/CategoryChannel.js';
import { GuildChannel } from '../structures/channels/GuildChannel.js';
import type { GuildBasedChannel } from '../structures/channels/index.js';
import type { Guild } from '../structures/Guild.js';
import { type OverwriteData, PermissionOverwrites } from '../structures/PermissionOverwrites.js';
import { Webhook } from '../structures/Webhook.js';
import type { RawChannelData, RawWebhookData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { ChannelType } from '../util/Enums.js';
import { channelTypeToBisim } from '../util/Transformers.js';
import { notSupported } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';
import type { BaseFetchOptions } from './UserManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * A server channel, by structure or id.
 */
export type GuildChannelResolvable = GuildBasedChannel | string;

/**
 * Options for creating a channel.
 */
export interface GuildChannelCreateOptions {
  /** The name. */
  name: string;
  /** The type: text (default), voice or category. */
  type?: ChannelType.GuildText | ChannelType.GuildVoice | ChannelType.GuildCategory;
  /** The topic of a text channel. */
  topic?: string | null;
  /** Whether the channel is age restricted. */
  nsfw?: boolean;
  /** The category. */
  parent?: CategoryChannel | string | null;
  /** The position. */
  position?: number;
  /** The permission overwrites. */
  permissionOverwrites?: readonly (OverwriteData | PermissionOverwrites)[] | Collection<string, OverwriteData | PermissionOverwrites>;
  /** The slow mode of a text channel, in seconds. */
  rateLimitPerUser?: number;
  /** Not on Bisim. */
  bitrate?: number;
  /** Not on Bisim. */
  userLimit?: number;
  /** Not on Bisim. */
  rtcRegion?: string | null;
  /** Not on Bisim. */
  videoQualityMode?: number;
  /** Not on Bisim. */
  defaultAutoArchiveDuration?: number;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * Options for editing a channel.
 */
export interface GuildChannelEditOptions {
  name?: string;
  /** Not on Bisim: changing a channel's type. */
  type?: ChannelType;
  position?: number;
  topic?: string | null;
  nsfw?: boolean;
  parent?: CategoryChannel | string | null;
  /** Whether to copy the category's permissions. */
  lockPermissions?: boolean;
  permissionOverwrites?: readonly (OverwriteData | PermissionOverwrites)[] | Collection<string, OverwriteData | PermissionOverwrites>;
  rateLimitPerUser?: number;
  /** Not on Bisim. */
  bitrate?: number;
  /** Not on Bisim. */
  userLimit?: number;
  /** Not on Bisim. */
  rtcRegion?: string | null;
  /** Not on Bisim. */
  videoQualityMode?: number;
  /** Not on Bisim. */
  defaultAutoArchiveDuration?: number;
  reason?: string;
}

/**
 * Options for moving a channel.
 */
export interface SetChannelPositionOptions {
  /** Whether the position is relative to the current one. */
  relative?: boolean;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * A channel's new place, for {@link GuildChannelManager.setPositions}.
 */
export interface ChannelPosition {
  channel: GuildChannelResolvable;
  position?: number;
  parent?: CategoryChannel | string | null;
  lockPermissions?: boolean;
}

function unsupportedOptions(options: GuildChannelCreateOptions | GuildChannelEditOptions): void {
  if (options.bitrate !== undefined) notSupported('Voice channel bitrates');
  if (options.userLimit !== undefined) notSupported('Voice channel user limits');
  if (options.rtcRegion !== undefined) notSupported('Voice regions');
  if (options.videoQualityMode !== undefined) notSupported('Video quality modes');
  if (options.defaultAutoArchiveDuration !== undefined) notSupported('Threads');
}

/**
 * Manages the channels of a server.
 */
export class GuildChannelManager extends CachedManager<string, GuildBasedChannel, GuildChannelResolvable> {
  /** The server. */
  public declare readonly guild: Guild;

  /**
   * @param guild - The server
   */
  public constructor(guild: Guild) {
    super(guild.client);
    attachHidden(this, 'guild', guild);
  }

  /** The id of a channel given as a structure or an id; throws when there is none. */
  private channelIdOf(channel: GuildChannelResolvable): string {
    const id = this.resolveId(channel);
    if (id === null || id === '') throw new BisimjsError(ErrorCodes.GuildChannelResolve);
    return id;
  }

  /**
   * How many channels the server has (Bisim has no threads, so every channel counts).
   */
  public get channelCountWithoutThreads(): number {
    return this.cache.size;
  }

  /**
   * Adds a channel to the caches.
   *
   * @internal
   */
  public _add(data: RawChannelData, cache = true): GuildBasedChannel {
    return this.client.channels._add({ ...data, guildId: this.guild.id }, this.guild, { cache }) as GuildBasedChannel;
  }

  /**
   * Creates a channel.
   *
   * @param options - The channel
   * @example
   * ```js
   * await guild.channels.create({ name: 'new-general', reason: 'Needed a cool new channel' });
   * ```
   */
  public async create(options: GuildChannelCreateOptions): Promise<GuildBasedChannel> {
    unsupportedOptions(options);
    const type = channelTypeToBisim(options.type ?? ChannelType.GuildText);
    if (!type || type === 'DM' || type === 'GROUP_DM') notSupported(`Channels of type ${String(options.type)}`);
    const overwrites = options.permissionOverwrites
      ? [...(Array.isArray(options.permissionOverwrites) ? options.permissionOverwrites : (options.permissionOverwrites as Collection<string, OverwriteData>).values())].map(
          (overwrite) => PermissionOverwrites.resolve(overwrite, this.guild),
        )
      : undefined;
    const body: Record<string, unknown> = { name: options.name, type };
    if (options.topic) body.topic = options.topic;
    const parentId = typeof options.parent === 'string' ? options.parent : options.parent?.id;
    if (parentId) body.parentId = parentId;
    if (options.position !== undefined) body.position = options.position;
    if (overwrites) body.permissionOverwrites = overwrites;
    let data = (await this.client.rest.post(Routes.guildChannels(this.guild.id), { body, reason: options.reason })) as RawChannelData;
    const followUp: Record<string, unknown> = {};
    if (options.nsfw !== undefined) followUp.nsfw = options.nsfw;
    if (options.rateLimitPerUser !== undefined) followUp.slowmodeSec = options.rateLimitPerUser;
    if (Object.keys(followUp).length) {
      data = (await this.client.rest.patch(Routes.guildChannel(this.guild.id, data.id), { body: followUp, reason: options.reason })) as RawChannelData;
    }
    const channel = this._add(data);
    if (overwrites && channel instanceof GuildChannel) {
      for (const overwrite of overwrites) channel.permissionOverwrites._add(overwrite);
      channel.permissionOverwrites.loaded = true;
    }
    return channel;
  }

  /**
   * Edits a channel.
   *
   * @param channel - The channel
   * @param options - What to change
   */
  public async edit(channel: GuildChannelResolvable, options: GuildChannelEditOptions): Promise<GuildBasedChannel> {
    const id = this.channelIdOf(channel);
    unsupportedOptions(options);
    if (options.type !== undefined) {
      const current = this.cache.get(id);
      if (!current || current.type !== options.type) notSupported("Changing a channel's type");
    }
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.topic !== undefined) body.topic = options.topic ?? '';
    if (options.position !== undefined) body.position = options.position;
    if (options.nsfw !== undefined) body.nsfw = options.nsfw;
    if (options.rateLimitPerUser !== undefined) body.slowmodeSec = options.rateLimitPerUser;
    if (options.parent !== undefined) body.parentId = typeof options.parent === 'string' ? options.parent : (options.parent?.id ?? null);
    if (options.lockPermissions !== undefined) body.permissionsSynced = options.lockPermissions;
    let data: RawChannelData | undefined;
    if (Object.keys(body).length) {
      data = (await this.client.rest.patch(Routes.guildChannel(this.guild.id, id), { body, reason: options.reason })) as RawChannelData;
    }
    const resolved = data ? this._add(data) : this.cache.get(id);
    if (!resolved) throw new BisimjsError(ErrorCodes.GuildChannelResolve);
    if (options.permissionOverwrites && resolved instanceof GuildChannel) {
      await resolved.permissionOverwrites.set(options.permissionOverwrites as never, options.reason);
    }
    return resolved;
  }

  /**
   * Deletes a channel.
   *
   * @param channel - The channel
   * @param reason - Why
   */
  public async delete(channel: GuildChannelResolvable, reason?: string): Promise<void> {
    const id = this.channelIdOf(channel);
    await this.client.rest.delete(Routes.guildChannel(this.guild.id, id), { reason });
    this.client.channels._remove(id);
  }

  /**
   * Fetches one channel by id, or every channel of the server.
   *
   * @param id - The channel's id
   * @param options - Whether to cache or skip the cache
   */
  public fetch(id: string, options?: BaseFetchOptions): Promise<GuildBasedChannel | null>;
  public fetch(id?: undefined, options?: BaseFetchOptions): Promise<Collection<string, GuildBasedChannel>>;
  public async fetch(id?: string, options: BaseFetchOptions = {}): Promise<GuildBasedChannel | null | Collection<string, GuildBasedChannel>> {
    if (id) {
      if (!options.force) {
        const cached = this.fromCache(id);
        if (cached) return cached;
      }
      try {
        const data = (await this.client.rest.get(Routes.channel(id))) as RawChannelData;
        if (data.guildId && data.guildId !== this.guild.id) throw new BisimjsError(ErrorCodes.GuildChannelUnowned);
        return this._add(data, options.cache ?? true);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        const all = await this.fetch(undefined, options);
        return all.get(id) ?? null;
      }
    }
    const data = (await this.client.rest.get(Routes.guildChannels(this.guild.id))) as RawChannelData[];
    const channels = new Collection<string, GuildBasedChannel>();
    for (const raw of data) {
      const channel = this._add(raw, options.cache ?? true);
      channels.set(channel.id, channel);
    }
    return channels;
  }

  /**
   * Fetches the webhooks of a channel.
   *
   * @param channel - The channel
   */
  public async fetchWebhooks(channel: GuildChannelResolvable): Promise<Collection<string, Webhook>> {
    const id = this.channelIdOf(channel);
    const data = (await this.client.rest.get(Routes.channelWebhooks(id))) as RawWebhookData[];
    return new Collection(data.map((raw) => [raw.id, new Webhook(this.client, raw)]));
  }

  /**
   * Creates a webhook in a channel.
   *
   * @param options - The channel, the name and the reason
   */
  public async createWebhook(options: { channel: GuildChannelResolvable; name: string; avatar?: unknown; reason?: string }): Promise<Webhook> {
    if (options.avatar !== undefined && options.avatar !== null) notSupported('Webhook avatars through the API');
    const id = this.channelIdOf(options.channel);
    const created = (await this.client.rest.post(Routes.channelWebhooks(id), { body: { name: options.name }, reason: options.reason })) as RawWebhookData;
    return new Webhook(this.client, created);
  }

  /**
   * Moves a channel among the channels it sorts with.
   *
   * @param channel - The channel
   * @param position - The new position
   * @param options - Whether it is relative, and why
   */
  public async setPosition(channel: GuildChannelResolvable, position: number, options: SetChannelPositionOptions = {}): Promise<GuildBasedChannel> {
    const resolved = this.resolve(channel);
    if (!resolved) throw new BisimjsError(ErrorCodes.GuildChannelResolve);
    const siblings = [...this.cache.values()]
      .filter((other) => {
        const sameGroup =
          (other.type === ChannelType.GuildCategory) === (resolved.type === ChannelType.GuildCategory) &&
          (other.type === ChannelType.GuildVoice) === (resolved.type === ChannelType.GuildVoice);
        return sameGroup && (resolved.type === ChannelType.GuildCategory || other.parentId === resolved.parentId);
      })
      .sort((a, b) => a.position - b.position);
    const from = siblings.indexOf(resolved);
    siblings.splice(from, 1);
    const target = Math.max(0, Math.min(siblings.length, options.relative ? from + position : position));
    siblings.splice(target, 0, resolved);
    await this.setPositions(siblings.map((other, index) => ({ channel: other.id, position: index })));
    return resolved;
  }

  /**
   * Moves several channels at once.
   *
   * @param channelPositions - The new places
   */
  public async setPositions(channelPositions: readonly ChannelPosition[]): Promise<Guild> {
    const channels = channelPositions.map((entry) => {
      const id = this.channelIdOf(entry.channel);
      const item: { id: string; position?: number; parentId?: string | null } = { id };
      if (entry.position !== undefined) item.position = entry.position;
      if (entry.parent !== undefined) item.parentId = typeof entry.parent === 'string' ? entry.parent : (entry.parent?.id ?? null);
      return item;
    });
    await this.client.rest.patch(Routes.guildChannelPositions(this.guild.id), { body: { channels } });
    for (const item of channels) {
      const channel = this.cache.get(item.id);
      if (!channel) continue;
      if (item.position !== undefined) channel.rawPosition = item.position;
      if (item.parentId !== undefined) channel.parentId = item.parentId;
    }
    return this.guild;
  }

  /** Not on Bisim: announcement channels. */
  public addFollower(_channel: unknown, _targetChannel: unknown, _reason?: string): Promise<never> {
    return notSupported('Following announcement channels');
  }

  /** Not on Bisim: threads. */
  public fetchActiveThreads(_cache?: boolean): Promise<never> {
    return notSupported('Threads');
  }
}

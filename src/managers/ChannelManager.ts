import type { Client } from '../client/Client.js';
import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { Channel } from '../structures/channels/index.js';
import { GuildChannel } from '../structures/channels/GuildChannel.js';
import type { Guild } from '../structures/Guild.js';
import type { RawChannelData } from '../types/raw.js';
import { createChannel } from '../util/Channels.js';
import { CachedManager } from './BaseManager.js';
import type { BaseFetchOptions } from './UserManager.js';

/**
 * A channel, by structure or id.
 */
export type ChannelResolvable = Channel | string;

/**
 * Manages every channel the client knows: server channels and DMs.
 */
export class ChannelManager extends CachedManager<string, Channel, ChannelResolvable> {
  /**
   * @param client - The client
   */
  public constructor(client: Client) {
    super(client);
  }

  /**
   * Adds a channel to the cache (and to its server's), or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawChannelData, guild?: Guild | null, { cache = true }: { cache?: boolean } = {}): Channel {
    const known = this.refreshCached(data.id, data);
    const result = known ?? createChannel(this.client, data, guild);
    if (cache) {
      if (!known) this.cache.set(data.id, result);
      if (result instanceof GuildChannel) result.guild.channels.cache.set(result.id, result as never);
    }
    return result;
  }

  /**
   * Removes a channel from the caches.
   *
   * @internal
   */
  public _remove(id: string): Channel | undefined {
    const gone = this.cache.get(id);
    this.cache.delete(id);
    if (gone instanceof GuildChannel) gone.guild.channels.cache.delete(id);
    return gone;
  }

  /**
   * Fetches a channel by id.
   *
   * @param id - The channel's id
   * @param options - Whether to cache or skip the cache
   */
  public async fetch(id: string, options: BaseFetchOptions & { allowUnknownGuild?: boolean } = {}): Promise<Channel | null> {
    if (!options.force) {
      const cached = this.fromCache(id);
      if (cached) return cached;
    }
    try {
      const data = (await this.client.rest.get(Routes.channel(id))) as RawChannelData;
      return this._add(data, null, { cache: options.cache ?? true });
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
      const dms = (await this.client.rest.get(Routes.userChannels())) as RawChannelData[];
      for (const dm of dms) this._add(dm, null);
      const found = this.cache.get(id);
      if (found) return found;
      throw error;
    }
  }
}

import type { Client } from '../../client/Client.js';
import type { GuildChannelCreateOptions } from '../../managers/GuildChannelManager.js';
import type { RawChannelData } from '../../types/raw.js';
import type { Collection } from '../../util/Collection.js';
import type { Guild } from '../Guild.js';
import { GuildChannel } from './GuildChannel.js';
import { attachHidden } from '../../util/internal.js';

/**
 * The channels in a category.
 */
export class CategoryChannelChildManager {
  /** The category. */
  public declare readonly channel: CategoryChannel;

  /**
   * @param channel - The category
   */
  public constructor(channel: CategoryChannel) {
    attachHidden(this, 'channel', channel);
  }

  /**
   * The channels in the category.
   */
  public get cache(): Collection<string, GuildChannel> {
    return this.channel.guild.channels.cache.filter((channel) => channel.parentId === this.channel.id);
  }

  /**
   * The server.
   */
  public get guild(): Guild {
    return this.channel.guild;
  }

  /**
   * Creates a channel in the category.
   *
   * @param options - The channel
   */
  public create(options: Omit<GuildChannelCreateOptions, 'parent'>): Promise<GuildChannel> {
    return this.channel.guild.channels.create({ ...options, parent: this.channel.id });
  }
}

/**
 * A category of channels.
 */
export class CategoryChannel extends GuildChannel {
  /**
   * @param guild - The server
   * @param data - The channel from Bisim
   * @param client - The client
   */
  public constructor(guild: Guild, data: RawChannelData, client?: Client) {
    super(guild, data, client);
  }

  /**
   * The channels in the category.
   */
  public get children(): CategoryChannelChildManager {
    const children = new CategoryChannelChildManager(this);
    return children;
  }

  /**
   * Categories have no category: always `null`.
   */
  public override get parent(): null {
    return null;
  }
}

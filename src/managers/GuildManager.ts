import type { Client } from '../client/Client.js';
import { Routes } from '../rest/Routes.js';
import { Guild } from '../structures/Guild.js';
import type { RawGuildData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { notSupported } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';

/**
 * A server, by structure, something in it, or id.
 */
export type GuildResolvable = Guild | string | { guild: Guild | null } | { guildId: string | null };

/**
 * Manages the servers the bot is in.
 */
export class GuildManager extends CachedManager<string, Guild, GuildResolvable> {
  /**
   * @param client - The client
   */
  public constructor(client: Client) {
    super(client);
  }

  /**
   * Adds a server to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawGuildData, cache = true): Guild {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const guild = new Guild(this.client, data);
    if (cache) this.cache.set(guild.id, guild);
    return guild;
  }

  /**
   * Resolves a server from a server, something in it, or an id.
   *
   * @param guild - The server
   */
  public override resolve(guild: GuildResolvable): Guild | null {
    if (guild instanceof Guild) return guild;
    if (guild && typeof guild === 'object') {
      if ('guild' in guild && guild.guild instanceof Guild) return guild.guild;
      if ('guildId' in guild && guild.guildId) return this.cache.get(guild.guildId) ?? null;
    }
    return super.resolve(guild as string);
  }

  /**
   * Resolves a server's id from a server, something in it, or an id.
   *
   * @param guild - The server
   */
  public override resolveId(guild: GuildResolvable): string | null {
    if (guild instanceof Guild) return guild.id;
    if (guild && typeof guild === 'object') {
      if ('guild' in guild && guild.guild instanceof Guild) return guild.guild.id;
      if ('guildId' in guild) return guild.guildId;
    }
    return super.resolveId(guild as string);
  }

  /**
   * Fetches one server (its channels and roles too), or the list of servers the bot is in.
   *
   * @param options - The server, or options
   */
  public fetch(options: GuildResolvable | { guild: GuildResolvable; cache?: boolean; force?: boolean }): Promise<Guild>;
  public fetch(options?: { limit?: number; before?: string; after?: string }): Promise<Collection<string, Guild>>;
  public async fetch(options?: unknown): Promise<Guild | Collection<string, Guild>> {
    const target =
      typeof options === 'string' || options instanceof Guild
        ? options
        : options && typeof options === 'object' && 'guild' in options
          ? (options as { guild: GuildResolvable }).guild
          : null;
    if (target) {
      const id = this.resolveId(target as GuildResolvable)!;
      const force = (options as { force?: boolean })?.force ?? false;
      const existing = this.cache.get(id);
      if (existing && !force && existing._detailed) return existing;
      const data = (await this.client.rest.get(Routes.guild(id))) as RawGuildData;
      return this._add(data, (options as { cache?: boolean })?.cache ?? true);
    }
    const rows = (await this.client.rest.get(Routes.guilds())) as RawGuildData[];
    const guilds = new Collection<string, Guild>();
    for (const row of rows) guilds.set(row.id, this._add(row));
    return guilds;
  }

  /** Not on Bisim: bots cannot create servers. */
  public create(_options: unknown): Promise<never> {
    return notSupported('Creating a server as a bot');
  }

  /** Not on Bisim: server widgets. */
  public widgetImageURL(_guild: unknown, _style?: unknown): never {
    return notSupported('Server widgets');
  }
}

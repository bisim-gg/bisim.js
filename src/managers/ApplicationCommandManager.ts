import type { Client } from '../client/Client.js';
import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { RouteLike } from '../rest/types.js';
import { ApplicationCommand } from '../structures/ApplicationCommand.js';
import type { Guild } from '../structures/Guild.js';
import type { RawApplicationCommandData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { toBisimCommand } from '../util/Transformers.js';
import { notSupported } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * Command data: a builder, discord.js's `ApplicationCommandData`, Discord's JSON or Bisim's JSON.
 */
export type ApplicationCommandDataResolvable = { toJSON(): unknown } | Record<string, unknown>;

/**
 * A command, by structure or id.
 */
export type ApplicationCommandResolvable = ApplicationCommand | string;

/**
 * Options for fetching commands.
 */
export interface FetchApplicationCommandOptions {
  /** The server, for its commands. */
  guildId?: string;
  /** One command, by id. */
  id?: string;
  /** Whether to cache them. */
  cache?: boolean;
  /** Whether to skip the cache. */
  force?: boolean;
  /** Accepted for compatibility. */
  locale?: string;
  /** Accepted for compatibility: Bisim always sends the translations. */
  withLocalizations?: boolean;
}

/**
 * Not on Bisim: per command permissions.
 */
export class ApplicationCommandPermissionsManager {
  /** Not on Bisim. */
  public fetch(..._args: unknown[]): Promise<never> {
    return notSupported('Command permissions');
  }

  /** Not on Bisim. */
  public set(..._args: unknown[]): Promise<never> {
    return notSupported('Command permissions');
  }

  /** Not on Bisim. */
  public add(..._args: unknown[]): Promise<never> {
    return notSupported('Command permissions');
  }

  /** Not on Bisim. */
  public remove(..._args: unknown[]): Promise<never> {
    return notSupported('Command permissions');
  }

  /** Not on Bisim. */
  public has(..._args: unknown[]): Promise<never> {
    return notSupported('Command permissions');
  }
}

/**
 * Manages the bot's commands: global ones, or a server's when a server id is given.
 *
 * @example
 * ```js
 * await client.application.commands.set([pingCommand.toJSON()]);
 * await client.application.commands.set(commands, guildId);
 * ```
 */
export class ApplicationCommandManager extends CachedManager<string, ApplicationCommand, ApplicationCommandResolvable> {
  /** The server, for a server's manager. */
  public declare readonly guild: Guild | null;
  /** Not on Bisim: per command permissions. */
  public readonly permissions = new ApplicationCommandPermissionsManager();

  /**
   * @param client - The client
   * @param guild - The server, for a server's manager
   */
  public constructor(client: Client, guild: Guild | null = null) {
    super(client);
    attachHidden(this, 'guild', guild);
  }

  private get applicationId(): string {
    const id = this.client.application?.id ?? this.client.user?.id;
    if (!id) throw new TypeError('The client is not logged in.');
    return id;
  }

  /**
   * The path of the commands, or of one of them.
   *
   * @internal
   */
  public commandPath({ id, guildId }: { id?: string; guildId?: string } = {}): RouteLike {
    const guild = guildId ?? this.guild?.id;
    if (guild) return id ? Routes.applicationGuildCommand(this.applicationId, guild, id) : Routes.applicationGuildCommands(this.applicationId, guild);
    return id ? Routes.applicationCommand(this.applicationId, id) : Routes.applicationCommands(this.applicationId);
  }

  /**
   * Adds a command to the cache.
   *
   * @internal
   */
  public _add(data: RawApplicationCommandData, cache = true, guildId?: string): ApplicationCommand {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const guild = guildId ? (this.client.guilds.cache.get(guildId) ?? null) : this.guild;
    const command = new ApplicationCommand(this.client, data, guild);
    if (cache && (!guildId || guildId === this.guild?.id)) this.cache.set(command.id, command);
    return command;
  }

  /**
   * Fetches one command by id, or every command of the scope.
   *
   * @param id - The command's id, or options
   * @param options - Options
   */
  public fetch(id: string, options?: FetchApplicationCommandOptions): Promise<ApplicationCommand>;
  public fetch(options: FetchApplicationCommandOptions & { id: string }): Promise<ApplicationCommand>;
  public fetch(options?: FetchApplicationCommandOptions): Promise<Collection<string, ApplicationCommand>>;
  public async fetch(
    idOrOptions?: string | FetchApplicationCommandOptions,
    options: FetchApplicationCommandOptions = {},
  ): Promise<ApplicationCommand | Collection<string, ApplicationCommand>> {
    const opts = typeof idOrOptions === 'object' ? idOrOptions : options;
    const id = typeof idOrOptions === 'string' ? idOrOptions : opts.id;
    const guildId = opts.guildId;
    const cache = opts.cache ?? true;
    if (id) {
      if (!opts.force) {
        const existing = this.cache.get(id);
        if (existing && (!guildId || existing.guildId === guildId)) return existing;
      }
      try {
        const data = (await this.client.rest.get(this.commandPath({ id, guildId }))) as RawApplicationCommandData;
        return this._add(data, cache, guildId);
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        const all = await this.fetchRaw(guildId);
        const found = all.find((command) => command.id === id);
        if (!found) throw error;
        return this._add(found, cache, guildId);
      }
    }
    const data = await this.fetchRaw(guildId);
    if (cache && (!guildId || guildId === this.guild?.id)) this.cache.clear();
    return new Collection(data.map((raw) => [raw.id, this._add(raw, cache, guildId)]));
  }

  private async fetchRaw(guildId?: string): Promise<RawApplicationCommandData[]> {
    return (await this.client.rest.get(this.commandPath({ guildId }))) as RawApplicationCommandData[];
  }

  /**
   * Creates a command, or replaces the one with the same name.
   *
   * @param command - The command
   * @param guildId - The server, for a server command
   */
  public async create(command: ApplicationCommandDataResolvable, guildId?: string): Promise<ApplicationCommand> {
    const body = toBisimCommand(command);
    try {
      const data = (await this.client.rest.post(this.commandPath({ guildId }), { body })) as RawApplicationCommandData;
      return this._add(data, true, guildId);
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
    }
    const current = await this.fetchRaw(guildId);
    const next = [...current.filter((existing) => existing.name !== body.name).map((existing) => toBisimCommand(existing)), body];
    const saved = await this.putAll(next, guildId);
    return saved.find((saved) => saved.name === body.name)!;
  }

  /**
   * Replaces every command of the scope (a bulk write).
   *
   * @param commands - The commands
   * @param guildId - The server, for server commands
   */
  public async set(commands: readonly ApplicationCommandDataResolvable[], guildId?: string): Promise<Collection<string, ApplicationCommand>> {
    const saved = await this.putAll(commands.map((command) => toBisimCommand(command)), guildId);
    return new Collection(saved.map((command) => [command.id, command]));
  }

  private async putAll(commands: unknown[], guildId?: string): Promise<ApplicationCommand[]> {
    const data = (await this.client.rest.put(this.commandPath({ guildId }), { body: { commands } })) as RawApplicationCommandData[];
    if (!guildId || guildId === this.guild?.id) this.cache.clear();
    return data.map((raw) => this._add(raw, true, guildId));
  }

  /**
   * Edits a command.
   *
   * @param command - The command
   * @param data - What to change
   * @param guildId - The server, for a server command
   */
  public async edit(command: ApplicationCommandResolvable, data: Partial<ApplicationCommandDataResolvable>, guildId?: string): Promise<ApplicationCommand> {
    const id = this.resolveId(command)!;
    const body = toBisimCommand(data, true);
    try {
      const saved = (await this.client.rest.patch(this.commandPath({ id, guildId }), { body })) as RawApplicationCommandData;
      return this._add(saved, true, guildId);
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
    }
    const current = await this.fetchRaw(guildId);
    const target = current.find((existing) => existing.id === id);
    if (!target) throw new TypeError(`Unknown command ${id}`);
    const merged = { ...toBisimCommand(target), ...body };
    const next = current.map((existing) => (existing.id === id ? merged : toBisimCommand(existing)));
    const saved = await this.putAll(next, guildId);
    return saved.find((command) => command.name === merged.name)!;
  }

  /**
   * Deletes a command.
   *
   * @param command - The command
   * @param guildId - The server, for a server command
   */
  public async delete(command: ApplicationCommandResolvable, guildId?: string): Promise<ApplicationCommand | null> {
    const id = this.resolveId(command)!;
    const cached = this.cache.get(id) ?? null;
    try {
      await this.client.rest.delete(this.commandPath({ id, guildId }));
      this.cache.delete(id);
      return cached;
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
    }
    const current = await this.fetchRaw(guildId);
    await this.putAll(current.filter((existing) => existing.id !== id).map((existing) => toBisimCommand(existing)), guildId);
    return cached;
  }
}

/**
 * Manages the bot's commands in one server.
 */
export class GuildApplicationCommandManager extends ApplicationCommandManager {
  public declare readonly guild: Guild;

  /**
   * @param guild - The server
   */
  public constructor(guild: Guild) {
    super(guild.client, guild);
  }
}

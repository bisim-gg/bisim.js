import { EventEmitter } from 'node:events';
import type WebSocket from 'ws';
import { BisimjsError, BisimjsTypeError, ErrorCodes } from '../errors/index.js';
import { WebSocketManager } from '../gateway/WebSocketManager.js';
import { emitInteraction } from '../gateway/handlers.js';
import type { BaseInteraction } from '../interactions/BaseInteraction.js';
import { createInteraction } from '../interactions/createInteraction.js';
import { ChannelManager } from '../managers/ChannelManager.js';
import { GuildManager, type GuildResolvable } from '../managers/GuildManager.js';
import { UserManager } from '../managers/UserManager.js';
import { BisimAPIError } from '../rest/errors.js';
import { DefaultRestOptions, REST } from '../rest/REST.js';
import { OAuth2Routes, Routes } from '../rest/Routes.js';
import type { RESTOptions } from '../rest/types.js';
import { ClientApplication } from '../structures/ClientApplication.js';
import { ClientUser } from '../structures/ClientUser.js';
import type { GuildEmoji } from '../structures/Emoji.js';
import { Invite } from '../structures/Invite.js';
import type { MessageMentionOptions } from '../structures/MessagePayload.js';
import { ClientPresence, type PresenceUpdateData } from '../structures/Presence.js';
import { Webhook } from '../structures/Webhook.js';
import type { RawInteractionData, RawInviteData, RawUserData, RawWebhookData } from '../types/raw.js';
import type { BitFieldResolvable } from '../util/BitField.js';
import { Collection } from '../util/Collection.js';
import { DefaultURLs } from '../util/Constants.js';
import { InteractionType, type OAuth2Scopes, type Partials } from '../util/Enums.js';
import { Events } from '../util/Events.js';
import { type GatewayIntentsString, IntentsBitField } from '../util/IntentsBitField.js';
import { PermissionsBitField, type PermissionResolvable } from '../util/PermissionsBitField.js';
import { notSupported } from '../util/Util.js';
import type { ClientEvents } from './ClientEvents.js';
import { attachHidden } from '../util/internal.js';

/**
 * A type that is `Value` when `Ready` is true, and `Fallback` otherwise.
 */
export type If<Ready extends boolean, Value, Fallback = null> = Ready extends true ? Value : Ready extends false ? Fallback : Value | Fallback;

/**
 * What bisim.js loads for each server when it connects, to match what Discord sends with a server.
 */
export interface BootstrapOptions {
  /**
   * Load the member list, which fills `guild.members.cache` (so `message.member`, mentions and
   * `member.permissions` work for everyone). Default `true`.
   */
  members?: boolean;
  /** Load the custom emoji. Default `true`. */
  emojis?: boolean;
  /** Load who is in voice (so the first `voiceStateUpdate` has the right old state). Default `true`. */
  voiceStates?: boolean;
  /** How many servers to load at once. Default 4. */
  concurrency?: number;
}

/**
 * Gateway options.
 */
export interface WebSocketOptions {
  /** Bisim's gateway, `wss://ws.bisim.gg/ws` by default (`ws://localhost:4000/ws` for a local stack). */
  gateway?: string;
  /** The WebSocket class, `ws` by default. */
  WebSocket?: typeof WebSocket;
  /** Accepted for compatibility. */
  large_threshold?: number;
  /** Accepted for compatibility. */
  version?: number;
  /** Accepted for compatibility. */
  compress?: boolean;
  [key: string]: unknown;
}

/**
 * A cache setting, as `Options.cacheWithLimits` makes it.
 */
export type CacheFactory = ((...args: unknown[]) => unknown) & { messages?: number };

/**
 * The options of a {@link Client}, with discord.js's names.
 */
export interface ClientOptions {
  /** Accepted for compatibility; Bisim ignores intents. */
  intents: BitFieldResolvable<GatewayIntentsString, number>;
  /** Which partial structures to make for uncached data (as discord.js does). */
  partials?: readonly Partials[];
  /** The presence to start with. */
  presence?: PresenceUpdateData;
  /** REST options: `api` and `cdn` change where bisim.js talks to. */
  rest?: Partial<RESTOptions>;
  /** Gateway options: `gateway` changes the WebSocket address. */
  ws?: WebSocketOptions;
  /** Accepted for compatibility: Bisim does not filter mentions yet. */
  allowedMentions?: MessageMentionOptions;
  /** How many messages each channel keeps (`Options.cacheWithLimits({ MessageManager: 200 })`). */
  makeCache?: CacheFactory | { messages?: number };
  /** Accepted for compatibility. */
  sweepers?: unknown;
  /** Bisim has one connection: only shard 0. */
  shards?: number | readonly number[] | 'auto';
  /** Bisim has one connection: 1. */
  shardCount?: number;
  /** Accepted for compatibility. */
  closeTimeout?: number;
  /** Whether replying to a missing message fails (accepted). */
  failIfNotExists?: boolean;
  /** Accepted for compatibility. */
  enforceNonce?: boolean;
  /** Accepted for compatibility. */
  waitGuildTimeout?: number;
  /** Accepted for compatibility. */
  jsonTransformer?: unknown;
  /** What to load for each server on connect (Bisim only). */
  bootstrap?: BootstrapOptions;
}

/**
 * Options for {@link Client.generateInvite}.
 */
export interface InviteGenerationOptions {
  /** The scopes, `bot` (and `applications.commands`, which Bisim treats as part of `bot`). */
  scopes: readonly (OAuth2Scopes | `${OAuth2Scopes}`)[];
  /** The permissions the bot asks for. */
  permissions?: PermissionResolvable;
  /** The server to preselect. */
  guild?: GuildResolvable;
  /** Whether the server cannot be changed. */
  disableGuildSelect?: boolean;
}

/**
 * All the custom emoji of the servers the bot is in.
 */
export class ClientEmojiManager {
  /** The client. */
  public declare readonly client: Client;

  /**
   * @param client - The client
   */
  public constructor(client: Client) {
    attachHidden(this, 'client', client);
  }

  /**
   * Every cached emoji, from every server.
   */
  public get cache(): Collection<string, GuildEmoji> {
    const perServer = this.client.guilds.cache.map((guild) => guild.emojis.cache);
    return new Collection<string, GuildEmoji>().concat(...perServer);
  }

  /**
   * Resolves an emoji by id or structure.
   *
   * @param emoji - The emoji
   */
  public resolve(emoji: GuildEmoji | string): GuildEmoji | null {
    return typeof emoji === 'string' ? (this.cache.get(emoji) ?? null) : emoji;
  }

  /**
   * Resolves an emoji's id.
   *
   * @param emoji - The emoji
   */
  public resolveId(emoji: GuildEmoji | string): string | null {
    return typeof emoji === 'string' ? emoji : emoji.id;
  }
}

/**
 * The base of the client, discord.js's `BaseClient`.
 */
export class BaseClient extends EventEmitter {
  /**
   * Raises the listener limit (used by collectors).
   *
   * @internal
   */
  public incrementMaxListeners(): void {
    const max = this.getMaxListeners();
    if (max !== 0) this.setMaxListeners(max + 1);
  }

  /**
   * Lowers the listener limit (used by collectors).
   *
   * @internal
   */
  public decrementMaxListeners(): void {
    const max = this.getMaxListeners();
    if (max !== 0) this.setMaxListeners(max - 1);
  }
}

/**
 * The main hub for talking to Bisim, written the discord.js way.
 *
 * @example
 * ```js
 * const { Client, Events, GatewayIntentBits } = require('bisim.js');
 * const client = new Client({ intents: [GatewayIntentBits.Guilds] });
 * client.once(Events.ClientReady, (readyClient) => console.log(`Ready! Logged in as ${readyClient.user.tag}`));
 * client.login(process.env.BISIM_TOKEN);
 * ```
 */
export class Client<Ready extends boolean = boolean> extends BaseClient {
  /** Brands the type so `isReady()` narrows it (types only, nothing at runtime). */
  private declare readonly _readyBrand: Ready;
  /** The options, with defaults filled in. */
  public options: Omit<ClientOptions, 'intents'> & {
    intents: Readonly<IntentsBitField>;
    rest: RESTOptions;
    ws: WebSocketOptions;
    partials: readonly Partials[];
  };
  /** The REST manager. */
  public rest: REST;
  /** The gateway connection. */
  public ws: WebSocketManager;
  /** The users the client knows. */
  public users: UserManager = new UserManager(this);
  /** The servers the bot is in. */
  public guilds: GuildManager = new GuildManager(this);
  /** Every channel the client knows. */
  public channels: ChannelManager = new ChannelManager(this);
  /** The bot's presence. */
  public presence: ClientPresence;
  /** The bot's user. */
  public user: If<Ready, ClientUser>;
  /** The bot's application. */
  public application: If<Ready, ClientApplication>;
  /** When the client became ready, in milliseconds. */
  public readyTimestamp: If<Ready, number>;
  /** The bot token. */
  public token: If<Ready, string, string | null>;
  /** Accepted for compatibility. */
  public sweepers: { destroy(): void };
  /** The custom emoji of every server. */
  public readonly emojis: ClientEmojiManager;

  /**
   * @param options - The options; `intents` is required, as in discord.js
   */
  public constructor(options: ClientOptions) {
    super({ captureRejections: true });
    if (!options || typeof options !== 'object') throw new BisimjsTypeError(ErrorCodes.InvalidType, 'options', 'object', true);
    if (options.intents === undefined) throw new BisimjsTypeError(ErrorCodes.ClientMissingIntents);
    const intents = new IntentsBitField(options.intents).freeze();
    if (options.shards !== undefined && options.shards !== 'auto' && ![options.shards].flat().every((shard) => shard === 0)) {
      throw new BisimjsError(ErrorCodes.ClientInvalidProvidedShards);
    }
    const rest: RESTOptions = {
      ...DefaultRestOptions,
      ...options.rest,
      api: (options.rest?.api ?? DefaultURLs.api).replace(/\/+$/, ''),
      cdn: (options.rest?.cdn ?? DefaultURLs.cdn).replace(/\/+$/, ''),
    } as RESTOptions;
    this.options = {
      ...options,
      intents,
      partials: options.partials ?? [],
      rest,
      ws: { ...options.ws, gateway: options.ws?.gateway ?? DefaultURLs.gateway },
    };
    this.rest = new REST(rest);
    this.rest.on('restDebug', (message) => this.emit(Events.Debug, `[REST] ${message}`));
    this.emojis = new ClientEmojiManager(this);
    this.user = null as never;
    this.application = null as never;
    this.readyTimestamp = null as never;
    this.token = null as never;
    this.sweepers = { destroy: () => undefined };
    this.presence = new ClientPresence(this, options.presence);
    this.ws = new WebSocketManager(this);
  }

  /**
   * When the client became ready.
   */
  public get readyAt(): If<Ready, Date> {
    return (this.readyTimestamp === null ? null : new Date(this.readyTimestamp as number)) as never;
  }

  /**
   * How long the client has been ready, in milliseconds.
   */
  public get uptime(): If<Ready, number> {
    return (this.readyTimestamp === null ? null : Date.now() - (this.readyTimestamp as number)) as never;
  }

  /**
   * Logs in: checks the token, connects to the gateway and loads the servers. Resolves with the token once
   * connected; `ClientReady` fires when the servers are loaded.
   *
   * @param token - The bot token, `process.env.BISIM_TOKEN` by default
   */
  public async login(token: string | undefined = process.env.BISIM_TOKEN): Promise<string> {
    if (typeof token !== 'string' || token.length === 0) throw new BisimjsError(ErrorCodes.TokenInvalid);
    const clean = token.replace(/^(Bot|Bearer)\s*/i, '');
    this.token = clean as never;
    this.rest.setToken(clean);
    this.emit(Events.Debug, `Provided token: ${clean.slice(0, 6)}${'*'.repeat(Math.max(0, clean.length - 6))}`);
    let me: RawUserData;
    try {
      me = (await this.rest.get(Routes.user())) as RawUserData;
    } catch (error) {
      if (error instanceof BisimAPIError && (error.status === 401 || error.status === 403)) {
        await this.destroy();
        throw new BisimjsError(ErrorCodes.TokenInvalid);
      }
      throw error;
    }
    const user = new ClientUser(this, me);
    this.user = user as never;
    this.users.cache.set(me.id, user);
    this.application = new ClientApplication(this, { id: user.id, name: user.globalName ?? user.username ?? undefined }) as never;
    this.presence._apply({});
    void (this.application as ClientApplication).fetch().catch((error: unknown) => this.emit(Events.Debug, `Could not fetch the application: ${String(error)}`));
    try {
      await this.ws.connect();
    } catch (error) {
      await this.destroy();
      throw error;
    }
    return clean;
  }

  /**
   * Whether the client is ready.
   */
  public isReady(): this is Client<true> {
    return typeof this.readyTimestamp === 'number';
  }

  /**
   * Logs out: closes the connection and stops the timers.
   */
  public async destroy(): Promise<void> {
    const { rest, ws } = this;
    ws.destroy();
    rest.clearHandlerSweeper();
    this.sweepers.destroy();
    this.token = null as never;
    this.readyTimestamp = null as never;
  }

  /**
   * Fetches an invite by code or link.
   *
   * @param invite - The code, or a `bisim.gg/<code>` link
   */
  public async fetchInvite(invite: string, _options?: unknown): Promise<Invite> {
    const code = invite.trim().replace(/^(?:https?:\/\/)?(?:www\.)?bisim\.gg\/(?:invite\/|r\/)?/i, '').replace(/[/?#].*$/, '');
    if (code.length === 0) throw new BisimjsError(ErrorCodes.InviteResolveCode);
    const data = (await this.rest.get(Routes.invite(code))) as RawInviteData;
    return new Invite(this, data);
  }

  /**
   * Fetches a webhook by id.
   *
   * @param id - The webhook's id
   * @param token - The webhook's token (kept on the result)
   */
  public async fetchWebhook(id: string, token?: string): Promise<Webhook> {
    const data = (await this.rest.get(Routes.webhook(id))) as RawWebhookData;
    return new Webhook(this, { ...data, token: data.token ?? token });
  }

  /** Not on Bisim. */
  public fetchGuildPreview(_guild: unknown): Promise<never> {
    return notSupported('Server previews');
  }

  /** Not on Bisim. */
  public fetchVoiceRegions(): Promise<never> {
    return notSupported('Voice regions');
  }

  /** Not on Bisim: there is no global sticker route. Use `guild.stickers.fetch(id)`. */
  public fetchSticker(_id: string): Promise<never> {
    return notSupported('Fetching a sticker without its server');
  }

  /** Not on Bisim. */
  public fetchStickerPacks(): Promise<never> {
    return notSupported('Sticker packs');
  }

  /** Not on Bisim. */
  public fetchPremiumStickerPacks(): Promise<never> {
    return notSupported('Sticker packs');
  }

  /** Not on Bisim. */
  public fetchDefaultSoundboardSounds(): Promise<never> {
    return notSupported('Default soundboard sounds');
  }

  /** Not on Bisim. */
  public fetchGuildWidget(_guild: unknown): Promise<never> {
    return notSupported('Server widgets');
  }

  /**
   * Makes the link that adds the bot to a server:
   * `https://bisim.gg/oauth2/authorize?client_id=...&permissions=...&scope=bot`.
   *
   * @param options - The scopes, permissions and server
   * @example
   * ```js
   * const link = client.generateInvite({ scopes: [OAuth2Scopes.Bot], permissions: [PermissionFlagsBits.Administrator] });
   * ```
   */
  public generateInvite(options: InviteGenerationOptions): string {
    if (!options || typeof options !== 'object') throw new BisimjsTypeError(ErrorCodes.InvalidType, 'options', 'object', true);
    const application = this.application as ClientApplication | null;
    if (!application) throw new BisimjsError(ErrorCodes.ClientNotReady, 'generate an invite link');
    const { scopes } = options;
    if (!Array.isArray(scopes) || scopes.length === 0) throw new BisimjsTypeError(ErrorCodes.InvalidMissingScopes);
    const query = new URLSearchParams({ client_id: application.id });
    if (options.permissions !== undefined) {
      if (!scopes.includes('bot')) throw new BisimjsTypeError(ErrorCodes.InvalidScopesWithPermissions);
      const bits = PermissionsBitField.resolve(options.permissions);
      if (bits > 0n) query.set('permissions', String(bits));
    }
    query.set('scope', scopes.join(' '));
    if (options.disableGuildSelect) query.set('disable_guild_select', 'true');
    if (options.guild) {
      const serverId = this.guilds.resolveId(options.guild);
      if (!serverId) throw new BisimjsTypeError(ErrorCodes.InvalidType, 'options.guild', 'GuildResolvable');
      query.set('guild_id', serverId);
    }
    return `${OAuth2Routes.authorizationURL}?${query.toString()}`;
  }

  /**
   * Handles an interaction that reached your Interactions URL (verify it first with {@link verifyKey}): it is
   * built and emitted as `interactionCreate`, exactly like one from the gateway. A PING answers `{ type: 1 }`.
   *
   * @param payload - The request body, parsed
   * @returns What to answer in the HTTP response: `{ type: 1 }` for a PING, otherwise `null` (answer with
   * 200 and use the interaction's methods)
   */
  public handleInteraction(payload: RawInteractionData | string): { type: 1 } | null {
    const data = typeof payload === 'string' ? (JSON.parse(payload) as RawInteractionData) : payload;
    if (data.type === InteractionType.Ping) return { type: 1 };
    this._dispatchInteraction(data);
    return null;
  }

  /**
   * Builds an interaction without emitting it.
   *
   * @param payload - The interaction payload
   * @internal
   */
  public _createInteraction(payload: RawInteractionData): BaseInteraction {
    return createInteraction(this, payload);
  }

  /**
   * Emits an interaction.
   *
   * @internal
   */
  public _dispatchInteraction(payload: RawInteractionData): void {
    try {
      emitInteraction(this as Client<true>, payload);
    } catch (error) {
      this._emitError(error);
    }
  }

  /**
   * Reports an error: as the `error` event when something listens to it, otherwise as a warning, so an
   * internal hiccup never crashes a bot that has no error listener.
   *
   * @internal
   */
  public _emitError(error: unknown): void {
    const err = error instanceof Error ? error : new Error(String(error));
    if (this.listenerCount(Events.Error) > 0) this.emit(Events.Error, err);
    else this.emit(Events.Warn, `${err.name}: ${err.message}`);
  }

  /**
   * Marks the client ready and emits `ClientReady` (and the older `ready`).
   *
   * @internal
   */
  public _markReady(): void {
    this.readyTimestamp = Date.now() as never;
    this.emit(Events.ClientReady, this as Client<true>);
    this.emit('ready' as never, this as Client<true>);
  }

  /**
   * Removes a server from the caches, and emits `GuildDelete`.
   *
   * @internal
   */
  public _removeGuild(id: string, emit: boolean): void {
    const guild = this.guilds.cache.get(id);
    if (!guild) return;
    for (const channelId of guild.channels.cache.keys()) this.channels.cache.delete(channelId);
    this.guilds.cache.delete(id);
    if (emit) this.emit(Events.GuildDelete, guild);
  }

  public toJSON(): unknown {
    return {
      user: (this.user as ClientUser | null)?.id ?? null,
      application: (this.application as ClientApplication | null)?.id ?? null,
      guilds: [...this.guilds.cache.keys()],
      channels: [...this.channels.cache.keys()],
      readyTimestamp: this.readyTimestamp,
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface Client<Ready extends boolean = boolean> {
  on<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
  on<Event extends string | symbol>(event: Exclude<Event, keyof ClientEvents>, listener: (...args: any[]) => void): this;
  once<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
  once<Event extends string | symbol>(event: Exclude<Event, keyof ClientEvents>, listener: (...args: any[]) => void): this;
  off<Event extends keyof ClientEvents>(event: Event, listener: (...args: ClientEvents[Event]) => void): this;
  off<Event extends string | symbol>(event: Exclude<Event, keyof ClientEvents>, listener: (...args: any[]) => void): this;
  emit<Event extends keyof ClientEvents>(event: Event, ...args: ClientEvents[Event]): boolean;
  emit<Event extends string | symbol>(event: Exclude<Event, keyof ClientEvents>, ...args: unknown[]): boolean;
  removeAllListeners<Event extends keyof ClientEvents>(event?: Event): this;
  removeAllListeners<Event extends string | symbol>(event?: Exclude<Event, keyof ClientEvents>): this;
}

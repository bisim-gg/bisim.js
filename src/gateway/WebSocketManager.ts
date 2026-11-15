import { EventEmitter } from 'node:events';
import type { Client } from '../client/Client.js';
import { BisimjsError, type ErrorCode, ErrorCodes } from '../errors/index.js';
import { BisimAPIError } from '../rest/errors.js';
import { Routes } from '../rest/Routes.js';
import type { Guild } from '../structures/Guild.js';
import type { RawChannelData, RawEmojiData, RawGuildData, RawVoiceStateData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { GatewayIntentBits, Status } from '../util/Enums.js';
import { Events } from '../util/Events.js';
import { type DispatchEnvelope, handlers } from './handlers.js';
import { type GatewayFrame, GatewayConnectError, GatewayOpcodes, InternalCloseCodes, WebSocketShard } from './WebSocketShard.js';
import { attachHidden } from '../util/internal.js';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms).unref?.());

/**
 * Events that are handled while the bot is still loading its servers; everything else waits until it is
 * ready, as discord.js does.
 */
const BEFORE_READY = new Set(['PRESENCE_SYNC', 'RESUMED']);

/**
 * How long to wait for a server's presence snapshot after subscribing, in milliseconds.
 */
const SUBSCRIBE_TIMEOUT = 6_000;

/**
 * The close codes the gateway refuses a connection's intents with, and the error each one becomes. The
 * gateway closes the socket with one of these before hello; neither is ever retried.
 */
const INTENT_CLOSE_CODES = new Map<number, ErrorCode>([
  [4013, ErrorCodes.InvalidIntents],
  [4014, ErrorCodes.DisallowedIntents],
]);

/**
 * How long a channel bisim.js learned of from CHANNEL_CREATE is spared a `ChannelUpdate` from the server
 * refresh that follows it, in milliseconds.
 */
const CREATED_GRACE = 30_000;

/**
 * Runs `worker` over `items`, `limit` at a time.
 */
async function pool<Item>(items: Item[], limit: number, worker: (item: Item) => Promise<void>): Promise<void> {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const item = items[next++]!;
      await worker(item);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, run));
}

/**
 * The client's connection to Bisim's gateway: it gets a pass, connects, keeps the bot online, loads the
 * servers the bot is in (Bisim has no READY event, so bisim.js builds it), and turns Bisim's events into
 * discord.js's.
 */
export class WebSocketManager extends EventEmitter {
  /** The client. */
  public declare readonly client: Client;
  /** The gateway URL. */
  public gateway: string;
  /** The connections, by id (Bisim has one, id 0). */
  public readonly shards = new Collection<number, WebSocketShard>();
  private readonly shard: WebSocketShard;
  private destroyed = false;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly packetQueue: GatewayFrame[] = [];
  private bootstrapped = false;
  private everReady = false;
  private readonly subscribed = new Set<string>();
  private readonly syncWaiters = new Map<string, (confirmed: boolean) => void>();
  private readonly refusals = new Map<string, number>();
  private readonly createdChannels = new Map<string, number>();
  private readonly resyncing = new Map<string, { again: boolean; resubscribe: boolean }>();
  private presenceTimes: number[] = [];
  private presenceTimer: NodeJS.Timeout | null = null;
  private pendingPresence: unknown = null;
  private connectPromise: Promise<void> | null = null;

  /**
   * @param client - The client
   */
  public constructor(client: Client) {
    super();
    attachHidden(this, 'client', client);
    this.gateway = client.options.ws?.gateway ?? 'wss://ws.bisim.gg/ws';
    this.shard = new WebSocketShard(client.options.ws?.WebSocket);
    this.shards.set(0, this.shard);
    this.shard.on('frame', (frame: GatewayFrame) => this.onFrame(frame));
    this.shard.on('close', (code: number, reason: string) => this.onClose(code, reason));
    this.shard.on('debug', (message: string) => this.debug(message));
    this.shard.on('error', (error: Error) => this.client.emit(Events.ShardError, error, 0));
  }

  /**
   * The heartbeat's round trip time in milliseconds, -1 before the first one.
   */
  public get ping(): number {
    return this.shard.ping;
  }

  /**
   * The connection's status.
   */
  public get status(): Status {
    return this.shard.status;
  }

  private debug(message: string): void {
    this.client.emit(Events.Debug, `[WS => Shard 0] ${message}`);
  }

  /**
   * Connects for the first time; resolves when the gateway says hello. Loading the servers and the
   * `ClientReady` event follow.
   *
   * @internal
   */
  public async connect(): Promise<void> {
    if (this.connectPromise) throw new BisimjsError(ErrorCodes.WSConnectionExists);
    this.destroyed = false;
    this.connectPromise = this.open(false);
    try {
      await this.connectPromise;
    } catch (error) {
      this.connectPromise = null;
      throw error;
    }
  }

  private async mintPass(): Promise<string> {
    const appId = this.client.application?.id ?? this.client.user?.id;
    if (!appId) throw new BisimjsError(ErrorCodes.ClientNotReady, 'connect to the gateway');
    try {
      const intents = this.client.options.intents.bitfield;
      const data = (await this.client.rest.post(Routes.applicationGateway(appId), { body: { intents } })) as {
        token: string;
        expiresInMs?: number;
      };
      return data.token;
    } catch (error) {
      if (error instanceof BisimAPIError && (error.status === 401 || error.status === 403)) throw new BisimjsError(ErrorCodes.TokenInvalid);
      throw error;
    }
  }

  private async open(reconnecting: boolean): Promise<void> {
    this.shard.status = reconnecting ? Status.Reconnecting : Status.Connecting;
    const pass = await this.mintPass();
    const separator = this.gateway.includes('?') ? '&' : '?';
    this.debug(`Connecting to ${this.gateway}`);
    let interval: number;
    try {
      interval = await this.shard.connect(`${this.gateway}${separator}token=${encodeURIComponent(pass)}`);
    } catch (error) {
      const code = error instanceof GatewayConnectError ? INTENT_CLOSE_CODES.get(error.closeCode ?? 0) : undefined;
      if (code) throw new BisimjsError(code);
      throw error;
    }
    this.debug(`Hello: heartbeat every ${interval}ms`);
    this.subscribed.clear();
    this.refusals.clear();
    this.bootstrapped = false;
    this.sendPresence(this.client.presence.toBisim(), true);
    void this.bootstrap(reconnecting).catch((error: unknown) => {
      (this.client as Client<true>)._emitError(error);
      this.shard.close(InternalCloseCodes.Reconnect, 'Loading the servers failed');
    });
  }

  private onFrame(frame: GatewayFrame): void {
    this.client.emit(Events.Raw, frame);
    switch (frame.op) {
      case GatewayOpcodes.Dispatch:
        this.onDispatch(frame);
        break;
      case GatewayOpcodes.Reconnect:
        this.debug('The gateway asked for a reconnect');
        this.shard.close(InternalCloseCodes.Reconnect, 'Reconnect requested');
        break;
      case GatewayOpcodes.Error:
        this.debug(`The gateway refused a request: ${JSON.stringify(frame.d)}`);
        this.client.emit(Events.Warn, `The gateway refused a request: ${frame.d?.message ?? 'unknown'}`);
        if (typeof frame.d?.guildId === 'string' && frame.d.guildId) this.onSubscribeRefused(frame.d.guildId);
        break;
      default:
        break;
    }
  }

  private onDispatch(frame: GatewayFrame): void {
    const type = frame.t ?? (frame.d as DispatchEnvelope | undefined)?.type;
    if (!type) return;
    const d = (frame.d ?? { type }) as DispatchEnvelope;
    if (type === 'PRESENCE_SYNC' && d.guildId) {
      const waiter = this.syncWaiters.get(d.guildId);
      if (waiter) {
        this.syncWaiters.delete(d.guildId);
        waiter(true);
      }
    }
    if (!this.bootstrapped && !BEFORE_READY.has(type)) {
      this.packetQueue.push(frame);
      return;
    }
    this.handleDispatch(type, d);
  }

  private handleDispatch(type: string, d: DispatchEnvelope): void {
    if (type === 'GUILD_RESYNC') {
      if (d.guildId) this.queueResync(d.guildId, true);
      return;
    }
    if (type === 'GUILD_JOIN') {
      const guildId = d.guildJoin?.guildId ?? d.guildId;
      if (guildId) void this.handleGuildJoin(guildId);
      return;
    }
    const handler = handlers[type];
    if (!handler) return;
    try {
      handler(this.client as Client<true>, d);
    } catch (error) {
      (this.client as Client<true>)._emitError(error);
    }
  }

  private onClose(code: number, reason: string): void {
    this.debug(`Closed: ${code} ${reason}`);
    this.failWaiters();
    this.subscribed.clear();
    if (this.destroyed) return;
    const refused = INTENT_CLOSE_CODES.get(code);
    if (refused) {
      this.stopForIntents(new BisimjsError(refused), code);
      return;
    }
    const handoff = code === InternalCloseCodes.Reconnect || code === 1012;
    this.scheduleReconnect(handoff);
  }

  /**
   * Gives up for good after the gateway refused the intents: every new attempt would be refused the same way.
   */
  private stopForIntents(error: BisimjsError, code: number): void {
    this.debug(`The gateway refused the intents (${code}): not reconnecting`);
    this.destroyed = true;
    this.shard.status = Status.Disconnected;
    this.client.emit(Events.ShardDisconnect, { code, reason: error.message, wasClean: true }, 0);
    (this.client as Client<true>)._emitError(error);
  }

  private scheduleReconnect(handoff: boolean): void {
    if (this.destroyed || this.reconnectTimer) return;
    const ceiling = Math.min(30_000, 1_000 * 2 ** this.reconnectAttempts);
    const wait = handoff ? Math.floor(Math.random() * 1_000) : 1_000 + Math.floor(Math.random() * Math.max(0, ceiling - 1_000));
    this.reconnectAttempts++;
    this.client.emit(Events.ShardReconnecting, 0);
    this.debug(`Reconnecting in ${wait}ms`);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.reconnect();
    }, wait);
    this.reconnectTimer.unref?.();
  }

  private async reconnect(): Promise<void> {
    if (this.destroyed) return;
    try {
      await this.open(true);
    } catch (error) {
      if (error instanceof BisimjsError && error.code === ErrorCodes.TokenInvalid) {
        this.debug('The token was refused: giving up');
        this.client.emit(Events.Invalidated);
        this.client.emit(Events.ShardDisconnect, { code: 4004, reason: 'Authentication failed', wasClean: true }, 0);
        return;
      }
      if (error instanceof BisimjsError && (error.code === ErrorCodes.InvalidIntents || error.code === ErrorCodes.DisallowedIntents)) {
        this.stopForIntents(error, error.code === ErrorCodes.InvalidIntents ? 4013 : 4014);
        return;
      }
      if (error instanceof GatewayConnectError && error.retryAfter) {
        await sleep(error.retryAfter * 1_000);
      }
      this.debug(`Reconnect failed: ${String(error)}`);
      this.scheduleReconnect(false);
    }
  }

  private failWaiters(): void {
    for (const waiter of this.syncWaiters.values()) waiter(false);
    this.syncWaiters.clear();
  }

  /**
   * Loads the servers, subscribes to each, and emits `ClientReady` (first time) or `ShardResume` (after a
   * reconnect).
   */
  private async bootstrap(reconnecting: boolean): Promise<void> {
    const client = this.client as Client<true>;
    this.shard.status = Status.WaitingForGuilds;
    const rows = (await client.rest.get(Routes.guilds())) as RawGuildData[];
    const ids = new Set(rows.map((row) => row.id));
    const known = new Set(client.guilds.cache.keys());
    const created: Guild[] = [];

    if (reconnecting) {
      for (const id of known) if (!ids.has(id)) client._removeGuild(id, true);
    }

    const unavailable = new Set<string>();
    await pool(rows, client.options.bootstrap?.concurrency ?? 4, async (row) => {
      try {
        const isNew = !known.has(row.id);
        const guild = await this.loadGuild(row.id, { full: isNew || !reconnecting, emitDiff: reconnecting && !isNew });
        if (!guild) return;
        const ok = await this.subscribeGuild(row.id);
        if (!ok) unavailable.add(row.id);
        if (reconnecting && isNew) created.push(guild);
      } catch (error) {
        unavailable.add(row.id);
        this.client.emit(Events.Warn, `Could not load server ${row.id}: ${String(error)}`);
      }
    });

    if (!reconnecting) await this.refreshDMs();

    this.bootstrapped = true;
    this.reconnectAttempts = 0;
    this.shard.status = Status.Ready;
    const queued = this.packetQueue.splice(0);
    for (const frame of queued) {
      const type = frame.t ?? (frame.d as DispatchEnvelope).type;
      this.handleDispatch(type, frame.d as DispatchEnvelope);
    }
    for (const guild of created) client.emit(Events.GuildCreate, guild);
    if (!this.everReady) {
      this.everReady = true;
      client.emit(Events.ShardReady, 0, unavailable);
      client._markReady();
    } else {
      client.emit(Events.ShardResume, 0, 0);
    }
  }

  /**
   * Loads one server: its channels and roles, and (on first sight) its members, emojis and voice states.
   * The member list is loaded only with the `GuildMembers` intent (without it Bisim refuses the list and
   * sends no member events, so the cache could not be kept current); otherwise just the bot's own member.
   *
   * @internal
   */
  public async loadGuild(guildId: string, options: { full: boolean; emitDiff: boolean }): Promise<Guild | null> {
    const client = this.client as Client<true>;
    let data: RawGuildData;
    try {
      data = (await client.rest.get(Routes.guild(guildId))) as RawGuildData;
    } catch (error) {
      if (error instanceof BisimAPIError && (error.status === 404 || error.status === 403)) {
        if (client.guilds.cache.has(guildId)) client._removeGuild(guildId, true);
        return null;
      }
      throw error;
    }
    const existing = client.guilds.cache.get(guildId);
    const guild = existing && options.emitDiff ? this.applyDiff(existing, data) : client.guilds._add(data);
    if (options.full) {
      const bootstrap = client.options.bootstrap ?? {};
      const tasks: Promise<unknown>[] = [];
      if (bootstrap.members !== false) {
        if (client.options.intents.has(GatewayIntentBits.GuildMembers)) tasks.push(guild.members.fetchAll());
        else tasks.push(guild.members.fetchMe({ force: true }));
      }
      if (bootstrap.emojis !== false) {
        tasks.push(
          client.rest.get(Routes.guildEmojis(guildId)).then((emojis) => {
            for (const emoji of emojis as RawEmojiData[]) guild.emojis._add(emoji);
          }),
        );
      }
      if (bootstrap.voiceStates !== false) {
        tasks.push(
          client.rest.get(Routes.guildVoiceStates(guildId)).then((states) => {
            const list = Array.isArray(states) ? states : ((states as { states?: RawVoiceStateData[] })?.states ?? []);
            for (const state of list as RawVoiceStateData[]) guild.voiceStates._add({ ...state, guildId });
          }),
        );
      }
      const results = await Promise.allSettled(tasks);
      for (const result of results) {
        if (result.status === 'rejected') this.client.emit(Events.Warn, `Server ${guildId}: ${String(result.reason)}`);
      }
    }
    return guild;
  }

  /**
   * Applies a fresh copy of a server and emits the changes: channels and roles made, changed and deleted,
   * and the server's own settings.
   */
  private applyDiff(guild: Guild, data: RawGuildData): Guild {
    const client = this.client as Client<true>;
    const old = guild._clone();
    const oldRoles = new Map([...guild.roles.cache].map(([id, role]) => [id, role._clone()]));
    const oldChannels = new Map([...guild.channels.cache].map(([id, channel]) => [id, channel._clone()]));
    guild._patch(data);

    if (old.name !== guild.name || old.icon !== guild.icon || old.description !== guild.description || old.ownerId !== guild.ownerId ||
      old.systemChannelId !== guild.systemChannelId || old.afkChannelId !== guild.afkChannelId || old.afkTimeout !== guild.afkTimeout ||
      old.verificationLevel !== guild.verificationLevel) {
      client.emit(Events.GuildUpdate, old, guild);
    }
    for (const [id, previous] of oldRoles) {
      const current = guild.roles.cache.get(id);
      if (!current) client.emit(Events.GuildRoleDelete, previous);
      else if (!current.equals(previous)) client.emit(Events.GuildRoleUpdate, previous, current);
    }
    for (const [id, role] of guild.roles.cache) if (!oldRoles.has(id)) client.emit(Events.GuildRoleCreate, role);
    const now = Date.now();
    for (const [id, previous] of oldChannels) {
      const current = guild.channels.cache.get(id);
      const created = this.createdChannels.get(id);
      if (created !== undefined) this.createdChannels.delete(id);
      if (!current) client.emit(Events.ChannelDelete, previous);
      else if (created !== undefined && now - created < CREATED_GRACE) {
        // CHANNEL_CREATE emitted it already: this refresh only fills in what the event did not carry.
      } else if (
        !current.equals(previous as never) ||
        (current as unknown as { topic?: unknown }).topic !== (previous as unknown as { topic?: unknown }).topic ||
        current.nsfw !== previous.nsfw ||
        current.permissionsLocked !== previous.permissionsLocked ||
        current._myPermissions !== previous._myPermissions
      ) {
        client.emit(Events.ChannelUpdate, previous, current);
      }
    }
    for (const [id, channel] of guild.channels.cache) if (!oldChannels.has(id)) client.emit(Events.ChannelCreate, channel);
    return guild;
  }

  /**
   * Subscribes to a server's events (op 4) and waits for its presence snapshot, which is the only sign that
   * it worked. A refused subscribe is retried after loading the server again (that warms the gateway's
   * permission cache).
   *
   * @internal
   */
  public async subscribeGuild(guildId: string, attempt = 0): Promise<boolean> {
    if (this.subscribed.has(guildId)) return true;
    if (!this.shard.open) return false;
    if (!this.confirmsSubscriptions) {
      // Without the GuildPresences intent no snapshot comes back, so nothing confirms a subscription: it
      // stands unless the gateway refuses it (op 10 naming the server, see onSubscribeRefused).
      this.subscribed.add(guildId);
      await this.shard.send({ op: GatewayOpcodes.Subscribe, d: { guildId } });
      return this.shard.open;
    }
    let synced = false;
    const done = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        this.syncWaiters.delete(guildId);
        resolve();
      }, SUBSCRIBE_TIMEOUT);
      timer.unref?.();
      this.syncWaiters.set(guildId, (confirmed) => {
        clearTimeout(timer);
        synced = confirmed && this.shard.open;
        resolve();
      });
    });
    await this.shard.send({ op: GatewayOpcodes.Subscribe, d: { guildId } });
    await done;
    if (synced) {
      this.subscribed.add(guildId);
      return true;
    }
    if (!this.shard.open || attempt >= 2) {
      if (this.shard.open) this.client.emit(Events.Warn, `The gateway did not confirm the subscription to server ${guildId}`);
      return false;
    }
    try {
      await this.client.rest.get(Routes.guild(guildId));
    } catch (error) {
      if (error instanceof BisimAPIError && (error.status === 404 || error.status === 403)) {
        (this.client as Client<true>)._removeGuild(guildId, true);
        return false;
      }
    }
    return this.subscribeGuild(guildId, attempt + 1);
  }

  /**
   * Whether the gateway confirms a subscription with the server's presence snapshot, which it sends only to
   * a connection with the `GuildPresences` intent.
   */
  private get confirmsSubscriptions(): boolean {
    return this.client.options.intents.has(GatewayIntentBits.GuildPresences);
  }

  /**
   * The gateway refused a subscription (op 10 naming the server). A subscribe still waiting for its snapshot
   * learns it at once; one that counted without a snapshot is tried again after loading the server again
   * (that warms the gateway's permission cache), twice at most per connection.
   */
  private onSubscribeRefused(guildId: string): void {
    const waiter = this.syncWaiters.get(guildId);
    if (waiter) {
      this.syncWaiters.delete(guildId);
      waiter(false);
      return;
    }
    if (this.confirmsSubscriptions || !this.subscribed.has(guildId)) return;
    this.subscribed.delete(guildId);
    const tries = (this.refusals.get(guildId) ?? 0) + 1;
    this.refusals.set(guildId, tries);
    if (tries > 2) {
      this.client.emit(Events.Warn, `The gateway refused the subscription to server ${guildId}`);
      return;
    }
    if (this.client.guilds.cache.has(guildId)) this.queueResync(guildId);
  }

  /**
   * Notes a channel CHANNEL_CREATE added, so the server refresh that follows does not emit it again.
   *
   * @internal
   */
  public _channelCreated(channelId: string): void {
    const now = Date.now();
    for (const [id, at] of this.createdChannels) if (now - at >= CREATED_GRACE) this.createdChannels.delete(id);
    this.createdChannels.set(channelId, now);
  }

  /**
   * Refetches a server and emits the differences. After GUILD_RESYNC (the gateway dropped the server's
   * rooms) it also subscribes again; after a mere hint (an event about a channel bisim.js does not know) it
   * only refetches, since the subscription still stands and a second subscribe would be ignored. A server
   * that answers 404 is gone: `GuildDelete`.
   *
   * @param guildId - The server
   * @param resubscribe - Whether the gateway dropped the server's rooms
   * @internal
   */
  public queueResync(guildId: string, resubscribe = false): void {
    if (resubscribe) this.subscribed.delete(guildId);
    const pending = this.resyncing.get(guildId);
    if (pending !== undefined) {
      this.resyncing.set(guildId, { again: true, resubscribe: pending.resubscribe || resubscribe });
      return;
    }
    this.resyncing.set(guildId, { again: false, resubscribe });
    void (async () => {
      try {
        let state = this.resyncing.get(guildId)!;
        for (;;) {
          this.resyncing.set(guildId, { again: false, resubscribe: false });
          const guild = await this.loadGuild(guildId, { full: false, emitDiff: true });
          if (!guild) break;
          if (state.resubscribe || !this.subscribed.has(guildId)) {
            this.subscribed.delete(guildId);
            await this.subscribeGuild(guildId);
          }
          state = this.resyncing.get(guildId)!;
          if (!state.again) break;
        }
      } catch (error) {
        (this.client as Client<true>)._emitError(error);
      } finally {
        this.resyncing.delete(guildId);
      }
    })();
  }

  private async handleGuildJoin(guildId: string): Promise<void> {
    const client = this.client as Client<true>;
    const known = client.guilds.cache.get(guildId);
    if (known?._detailed && this.subscribed.has(guildId)) return;
    try {
      const guild = await this.loadGuild(guildId, { full: true, emitDiff: false });
      if (!guild) return;
      await this.subscribeGuild(guildId);
      if (!known) client.emit(Events.GuildCreate, guild);
    } catch (error) {
      client._emitError(error);
    }
  }

  /**
   * Loads the bot's DM channels.
   *
   * @internal
   */
  public async refreshDMs(): Promise<void> {
    try {
      const dms = (await this.client.rest.get(Routes.userChannels())) as RawChannelData[];
      for (const dm of dms) this.client.channels._add(dm, null);
    } catch (error) {
      this.debug(`Could not load DMs: ${String(error)}`);
    }
  }

  /**
   * Sends the bot's presence (op 7). The gateway takes five a minute at most, so extra updates are merged.
   *
   * @internal
   */
  public sendPresence(payload: unknown, immediate = false): void {
    if (!this.shard.open) return;
    const now = Date.now();
    this.presenceTimes = this.presenceTimes.filter((time) => now - time < 20_000);
    if (immediate || this.presenceTimes.length < 4) {
      this.presenceTimes.push(now);
      void this.shard.send({ op: GatewayOpcodes.Presence, d: payload });
      return;
    }
    this.pendingPresence = payload;
    if (this.presenceTimer) return;
    const wait = 20_000 - (now - this.presenceTimes[0]!) + 50;
    this.presenceTimer = setTimeout(() => {
      this.presenceTimer = null;
      const next = this.pendingPresence;
      this.pendingPresence = null;
      if (next) this.sendPresence(next);
    }, wait);
    this.presenceTimer.unref?.();
  }

  /**
   * Says the bot is typing in a channel through the gateway (op 6).
   *
   * @internal
   */
  public sendTyping(channelId: string, guildId?: string | null): void {
    if (!this.shard.open) return;
    void this.shard.send({ op: GatewayOpcodes.Typing, d: { channelId, guildId: guildId ?? '' } });
  }

  /**
   * Whether the client is subscribed to a server.
   *
   * @internal
   */
  public isSubscribed(guildId: string): boolean {
    return this.subscribed.has(guildId);
  }

  /**
   * Closes the connection for good.
   *
   * @internal
   */
  public destroy(): void {
    this.destroyed = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.presenceTimer) clearTimeout(this.presenceTimer);
    this.reconnectTimer = null;
    this.presenceTimer = null;
    this.failWaiters();
    this.packetQueue.length = 0;
    this.shard.destroy();
    this.connectPromise = null;
    this.everReady = false;
    this.bootstrapped = false;
  }
}


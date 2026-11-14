import { Routes } from '../../rest/Routes.js';
import type { RawVoiceStateData } from '../../types/raw.js';
import { Events } from '../../util/Events.js';
import type { Client } from '../Client.js';

/**
 * Where to connect, as an adapter hands it to a voice library: the answer to a voice join. On Bisim `endpoint` is
 * the LiveKit signaling URL and `token` a LiveKit access token.
 */
export interface GatewayVoiceServerUpdateDispatchData {
  guild_id: string;
  channel_id?: string | null;
  token: string;
  endpoint: string | null;
  can_publish?: boolean;
  error?: Error;
}

/**
 * The bot's own voice state, as an adapter hands it to a voice library (Discord's field names).
 */
export interface GatewayVoiceStateUpdateDispatchData {
  guild_id: string;
  channel_id: string | null;
  user_id: string;
  session_id?: string;
  mute?: boolean;
  deaf?: boolean;
  self_mute?: boolean;
  self_deaf?: boolean;
  self_video?: boolean;
  self_stream?: boolean;
  suppress?: boolean;
  request_to_speak_timestamp?: string | null;
  error?: Error;
}

/**
 * What `voiceServerUpdate` carries: the server and where its voice connection goes.
 */
export interface VoiceServerUpdateData {
  /** The server. */
  guildId: string;
  /** The LiveKit signaling URL, or `null`. */
  endpoint: string | null;
  /** The LiveKit access token. */
  token: string;
}

/**
 * What a voice library (@bisim/voice) gives the adapter.
 */
export interface InternalBisimGatewayAdapterLibraryMethods {
  /** The adapter can no longer be used. */
  destroy(): void;
  /** The answer to a join. */
  onVoiceServerUpdate(data: GatewayVoiceServerUpdateDispatchData): void;
  /** The bot's own voice state. */
  onVoiceStateUpdate(data: GatewayVoiceStateUpdateDispatchData): void;
}

/**
 * What the adapter gives a voice library.
 */
export interface InternalBisimGatewayAdapterImplementerMethods {
  /** The library is done with the adapter. */
  destroy(): void;
  /** A voice state request shaped like Discord's opcode 4: join, leave, or change the bot's own mute and deafen. */
  sendPayload(payload: unknown): boolean;
}

/**
 * The type of `guild.voiceAdapterCreator`: what @bisim/voice's `joinVoiceChannel` takes as `adapterCreator`.
 */
export type InternalBisimGatewayAdapterCreator = (
  methods: InternalBisimGatewayAdapterLibraryMethods,
) => InternalBisimGatewayAdapterImplementerMethods;

/** What a voice join answers (the parts the adapter uses). */
interface VoiceJoinAnswer {
  url: string;
  token: string;
  canPublish?: boolean;
}

interface Flags {
  selfMute: boolean;
  selfDeaf: boolean;
}

/**
 * The voice adapter of one server: turns @bisim/voice's requests into Bisim's REST calls and passes what Bisim
 * answers back.
 */
class GuildVoiceAdapter {
  /** The channel the bot is in, or is being taken to; `null` when it left. */
  public channelId: string | null = null;
  private flags: Flags = { selfMute: false, selfDeaf: true };
  private queue: Promise<void> = Promise.resolve();
  private destroyed = false;

  public constructor(
    private readonly manager: ClientVoiceManager,
    public readonly guildId: string,
    public readonly methods: InternalBisimGatewayAdapterLibraryMethods,
  ) {}

  private get client(): Client {
    return this.manager.client;
  }

  private debug(message: string): void {
    this.client.emit(Events.Debug, `[VOICE ${this.guildId}] ${message}`);
  }

  private stateFor(channelId: string | null, moderation: { mute?: boolean; deaf?: boolean } = {}, error?: Error): GatewayVoiceStateUpdateDispatchData {
    return {
      guild_id: this.guildId,
      channel_id: channelId,
      user_id: this.client.user?.id ?? '',
      session_id: '',
      self_mute: this.flags.selfMute,
      self_deaf: this.flags.selfDeaf,
      self_video: false,
      self_stream: false,
      suppress: false,
      request_to_speak_timestamp: null,
      ...moderation,
      ...(error ? { error } : {}),
    };
  }

  private enqueue(task: () => Promise<void>): void {
    this.queue = this.queue.then(task).catch((error: unknown) => this.debug(`voice request failed: ${String(error)}`));
  }

  /**
   * A request from @bisim/voice.
   */
  public send(payload: unknown): boolean {
    if (this.destroyed || !this.client.token) return false;
    const frame = payload as { op?: number; d?: { guild_id?: string; channel_id?: string | null; self_mute?: boolean; self_deaf?: boolean; connect?: boolean } };
    const d = frame?.d;
    if (frame?.op !== 4 || !d || (d.guild_id !== undefined && d.guild_id !== this.guildId)) return false;
    const target = d.channel_id ?? null;
    const flags: Flags = { selfMute: Boolean(d.self_mute), selfDeaf: Boolean(d.self_deaf) };
    const connect = d.connect === true;
    this.enqueue(async () => {
      if (this.destroyed) return;
      if (target === null) return this.leave(flags);
      if (target !== this.channelId || connect) return this.join(target, flags);
      return this.updateSelf(flags);
    });
    return true;
  }

  private async join(channelId: string, flags: Flags): Promise<void> {
    const previous = this.channelId;
    const previousFlags = this.flags;
    this.channelId = channelId;
    this.flags = flags;
    let answer: VoiceJoinAnswer;
    try {
      answer = (await this.client.rest.post(Routes.channelVoiceJoin(channelId), {
        body: { selfMuted: flags.selfMute, selfDeafened: flags.selfDeaf },
      })) as VoiceJoinAnswer;
    } catch (error) {
      if (this.destroyed) return;
      this.debug(`could not join ${channelId}: ${String(error)}`);
      if (previous !== null && previous !== channelId) {
        // A refused switch or move: the bot is still where it was.
        this.channelId = previous;
        this.flags = previousFlags;
        this.methods.onVoiceStateUpdate(this.stateFor(previous, {}, error as Error));
      } else {
        this.channelId = null;
        this.methods.onVoiceServerUpdate({ guild_id: this.guildId, channel_id: channelId, token: '', endpoint: null, error: error as Error });
      }
      return;
    }
    if (this.destroyed) return;
    this.debug(`joined ${channelId}`);
    this.methods.onVoiceStateUpdate(this.stateFor(channelId));
    const server: GatewayVoiceServerUpdateDispatchData = {
      guild_id: this.guildId,
      channel_id: channelId,
      token: answer.token,
      endpoint: answer.url,
      can_publish: answer.canPublish ?? true,
    };
    this.client.emit(Events.VoiceServerUpdate, { guildId: this.guildId, endpoint: server.endpoint, token: server.token });
    this.methods.onVoiceServerUpdate(server);
  }

  private async leave(flags: Flags): Promise<void> {
    const channelId = this.channelId;
    this.channelId = null;
    this.flags = flags;
    if (channelId !== null) {
      try {
        await this.client.rest.post(Routes.channelVoiceLeave(channelId), { body: {} });
        this.debug(`left ${channelId}`);
      } catch (error) {
        this.debug(`leaving ${channelId} failed: ${String(error)}`);
      }
    }
    if (!this.destroyed) this.methods.onVoiceStateUpdate(this.stateFor(null));
  }

  private async updateSelf(flags: Flags): Promise<void> {
    const channelId = this.channelId;
    if (channelId === null) return;
    const changed = flags.selfMute !== this.flags.selfMute || flags.selfDeaf !== this.flags.selfDeaf;
    this.flags = flags;
    if (!changed) return;
    try {
      await this.client.rest.patch(Routes.channelVoiceSelfState(channelId), {
        body: { selfMuted: flags.selfMute, selfDeafened: flags.selfDeaf },
      });
    } catch (error) {
      // Not in the room yet (or any more): the next join carries the flags.
      this.debug(`could not update the voice state in ${channelId}: ${String(error)}`);
      return;
    }
    if (!this.destroyed && this.channelId === channelId) this.methods.onVoiceStateUpdate(this.stateFor(channelId));
  }

  /**
   * A moderator moved the bot: join the target, which the move allows once.
   */
  public move(fromChannelId: string, toChannelId: string): void {
    if (this.destroyed || !toChannelId || this.channelId !== fromChannelId) return;
    this.debug(`moved from ${fromChannelId} to ${toChannelId}`);
    this.methods.onVoiceStateUpdate(this.stateFor(toChannelId));
    this.enqueue(async () => {
      if (this.destroyed || this.channelId !== fromChannelId) return;
      return this.join(toChannelId, this.flags);
    });
  }

  /**
   * The bot's own voice state changed (from the gateway).
   */
  public ownState(channelId: string | null, raw: RawVoiceStateData): void {
    if (this.destroyed || channelId === null || channelId !== this.channelId) return;
    if (raw.left) {
      this.methods.onVoiceStateUpdate(this.stateFor(null));
      return;
    }
    // The bot's own mute and deafen are what it asked for; the event adds a moderator's locks.
    this.methods.onVoiceStateUpdate(this.stateFor(channelId, { mute: Boolean(raw.serverMuted), deaf: Boolean(raw.serverDeafened) }));
  }

  /** The library is done with this adapter. */
  public close(): void {
    this.destroyed = true;
  }
}

/**
 * Voice for the client: keeps the voice adapters of @bisim/voice connections, one per server, and passes them the
 * bot's own voice events. Reach it as `client.voice`.
 */
export class ClientVoiceManager {
  /** The client. */
  public declare readonly client: Client;
  /** The library methods of each server's adapter, by server id. */
  public readonly adapters = new Map<string, InternalBisimGatewayAdapterLibraryMethods>();
  private readonly sessions = new Map<string, GuildVoiceAdapter>();

  /**
   * @param client - The client
   */
  public constructor(client: Client) {
    Object.defineProperty(this, 'client', { value: client });
  }

  /**
   * Makes the adapter of a server (what `guild.voiceAdapterCreator` does).
   *
   * @param guildId - The server
   * @param methods - What the voice library gives the adapter
   * @internal
   */
  public _createAdapter(guildId: string, methods: InternalBisimGatewayAdapterLibraryMethods): InternalBisimGatewayAdapterImplementerMethods {
    this.sessions.get(guildId)?.close();
    const session = new GuildVoiceAdapter(this, guildId, methods);
    this.sessions.set(guildId, session);
    this.adapters.set(guildId, methods);
    return {
      sendPayload: (payload) => session.send(payload),
      destroy: () => {
        session.close();
        if (this.sessions.get(guildId) === session) {
          this.sessions.delete(guildId);
          this.adapters.delete(guildId);
        }
      },
    };
  }

  /**
   * VOICE_MOVE for the bot: a moderator moved it to another voice channel.
   *
   * @internal
   */
  public _onVoiceMove(guildId: string, fromChannelId: string, toChannelId: string): void {
    this.sessions.get(guildId)?.move(fromChannelId, toChannelId);
  }

  /**
   * VOICE_STATE_UPDATE about the bot itself.
   *
   * @internal
   */
  public _onVoiceState(guildId: string, channelId: string | null, raw: RawVoiceStateData): void {
    this.sessions.get(guildId)?.ownState(channelId, raw);
  }

  /**
   * The bot is no longer in a server, or the client is going away: the adapters end their connections.
   *
   * @param guildId - The server, or every server when left out
   * @internal
   */
  public _destroyAdapters(guildId?: string): void {
    for (const [id, session] of [...this.sessions]) {
      if (guildId !== undefined && id !== guildId) continue;
      this.sessions.delete(id);
      this.adapters.delete(id);
      session.close();
      try {
        session.methods.destroy();
      } catch (error) {
        this.client.emit(Events.Debug, `[VOICE ${id}] destroying the connection failed: ${String(error)}`);
      }
    }
  }
}

import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { Routes } from '../rest/Routes.js';
import type { RawVoiceStateData } from '../types/raw.js';
import { notSupported } from '../util/Util.js';
import { Base } from './Base.js';
import type { VoiceChannel } from './channels/VoiceChannel.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import { attachHidden } from '../util/internal.js';

/**
 * Options for {@link VoiceState.edit}.
 */
export interface VoiceStateEditOptions {
  mute?: boolean;
  deaf?: boolean;
  channel?: VoiceChannel | string | null;
  reason?: string;
}

/**
 * Someone's state in voice: which channel they are in, and whether they are muted or deafened.
 */
export class VoiceState extends Base {
  /** The server. */
  public declare readonly guild: Guild;
  /** The id of the member. */
  public id: string;
  /** Whether a moderator deafened the member. */
  public serverDeaf!: boolean | null;
  /** Whether a moderator muted the member. */
  public serverMute!: boolean | null;
  /** Whether the member deafened themselves. */
  public selfDeaf!: boolean | null;
  /** Whether the member muted themselves. */
  public selfMute!: boolean | null;
  /** Whether the member's camera is on. */
  public selfVideo!: boolean | null;
  /** Always `null` on Bisim. */
  public sessionId!: string | null;
  /** Whether the member shares their screen. */
  public streaming!: boolean | null;
  /** The voice channel the member is in, or `null`. */
  public channelId!: string | null;
  /** Always `false` on Bisim (no stages). */
  public suppress!: boolean;
  /** Always `null` on Bisim (no stages). */
  public requestToSpeakTimestamp!: number | null;

  /**
   * @param guild - The server
   * @param data - The voice state from Bisim
   */
  public constructor(guild: Guild, data: RawVoiceStateData) {
    super(guild.client);
    attachHidden(this, 'guild', guild);
    this.id = data.userId;
    this.serverDeaf = null;
    this.serverMute = null;
    this.selfDeaf = null;
    this.selfMute = null;
    this.selfVideo = null;
    this.sessionId = null;
    this.streaming = null;
    this.channelId = null;
    this.suppress = false;
    this.requestToSpeakTimestamp = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawVoiceStateData>): this {
    if (data.left) this.channelId = null;
    else if (data.channelId !== undefined) this.channelId = data.channelId || null;
    if (data.channelId !== undefined || data.left) {
      this.serverDeaf = Boolean(data.serverDeafened);
      this.serverMute = Boolean(data.serverMuted);
      this.selfDeaf = Boolean(data.selfDeafened);
      this.selfMute = Boolean(data.selfMuted);
      this.selfVideo = Boolean(data.selfVideo);
      this.streaming = Boolean(data.selfStream);
    }
    if (data.user) this.client.users._add(data.user);
    else if (data.username) {
      this.client.users._add({ id: data.userId!, username: data.username, displayName: data.displayName, avatarKey: data.avatarKey });
    }
    return this;
  }

  /**
   * The member.
   */
  public get member(): GuildMember | null {
    const { members } = this.guild;
    return members.cache.get(this.id) ?? null;
  }

  /**
   * The voice channel the member is in.
   */
  public get channel(): VoiceChannel | null {
    return (this.channelId ? this.guild.channels.cache.get(this.channelId) : null) as VoiceChannel | null;
  }

  /**
   * Whether the member is deafened, by themselves or a moderator.
   */
  public get deaf(): boolean | null {
    return Boolean(this.serverDeaf) || Boolean(this.selfDeaf);
  }

  /**
   * Whether the member is muted, by themselves or a moderator.
   */
  public get mute(): boolean | null {
    return Boolean(this.serverMute) || Boolean(this.selfMute);
  }

  private requireChannel(): string {
    if (!this.channelId) throw new BisimjsError(ErrorCodes.GuildVoiceChannelResolve);
    return this.channelId;
  }

  /**
   * Deafens or undeafens the member for everyone (needs Deafen Members).
   *
   * @param deaf - Whether to deafen
   * @param reason - Why
   */
  public async setDeaf(deaf = true, reason?: string): Promise<GuildMember> {
    return this.edit({ reason, deaf });
  }

  /**
   * Mutes or unmutes the member for everyone (needs Mute Members).
   *
   * @param mute - Whether to mute
   * @param reason - Why
   */
  public async setMute(mute = true, reason?: string): Promise<GuildMember> {
    return this.edit({ reason, mute });
  }

  /**
   * Disconnects the member from voice (needs Move Members).
   *
   * @param reason - Why
   */
  public disconnect(reason?: string): Promise<GuildMember> {
    const nowhere = null;
    return this.setChannel(nowhere, reason);
  }

  /**
   * Moves the member to another voice channel, or disconnects them with `null` (needs Move Members).
   *
   * @param channel - The channel, or `null`
   * @param reason - Why
   */
  public async setChannel(channel: VoiceChannel | string | null, reason?: string): Promise<GuildMember> {
    return this.edit({ reason, channel });
  }

  /**
   * Changes several things at once.
   *
   * @param options - What to change
   */
  public async edit(options: VoiceStateEditOptions): Promise<GuildMember> {
    const from = this.requireChannel();
    if (options.mute !== undefined || options.deaf !== undefined) {
      const body: { mute?: boolean; deafen?: boolean } = {};
      if (options.mute !== undefined) body.mute = options.mute;
      if (options.deaf !== undefined) body.deafen = options.deaf;
      await this.client.rest.patch(Routes.channelVoiceMember(from, this.id), { body, reason: options.reason });
      if (options.mute !== undefined) this.serverMute = options.mute;
      if (options.deaf !== undefined) this.serverDeaf = options.deaf;
    }
    if (options.channel === null) {
      await this.client.rest.delete(Routes.channelVoiceMember(from, this.id), { reason: options.reason });
    } else if (options.channel !== undefined) {
      const channelId = typeof options.channel === 'string' ? options.channel : options.channel.id;
      await this.client.rest.post(Routes.channelVoiceMemberMove(from, this.id), { body: { channelId }, reason: options.reason });
    }
    return this.member ?? (await this.guild.members.fetch(this.id));
  }

  /** Not on Bisim: stages. */
  public setRequestToSpeak(_request = true): Promise<never> {
    return notSupported('Stage channels');
  }

  /** Not on Bisim: stages. */
  public setSuppressed(_suppressed = true): Promise<never> {
    return notSupported('Stage channels');
  }

  /**
   * Reloads the voice states of the server and returns this member's.
   *
   * @param _force - Accepted for compatibility
   */
  public async fetch(_force = true): Promise<VoiceState> {
    await this.guild.voiceStates.fetch();
    return this.guild.voiceStates.cache.get(this.id) ?? this;
  }

  public override toJSON(): unknown {
    return {
      guildId: this.guild.id,
      id: this.id,
      channelId: this.channelId,
      serverDeaf: this.serverDeaf,
      serverMute: this.serverMute,
      selfDeaf: this.selfDeaf,
      selfMute: this.selfMute,
      selfVideo: this.selfVideo,
      streaming: this.streaming,
    };
  }
}

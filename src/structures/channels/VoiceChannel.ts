import type { Client } from '../../client/Client.js';
import type { RawChannelData } from '../../types/raw.js';
import { Collection } from '../../util/Collection.js';
import { notSupported } from '../../util/Util.js';
import type { Guild } from '../Guild.js';
import type { GuildMember } from '../GuildMember.js';
import type { VoiceState } from '../VoiceState.js';
import { GuildChannel } from './GuildChannel.js';

/**
 * A voice channel in a server. Bots cannot join voice on Bisim, but they can see who is in it and moderate
 * them (see {@link VoiceState}). Voice channels on Bisim have no text chat.
 */
export class VoiceChannel extends GuildChannel {
  /** Bisim does not expose a bitrate: always 64000. */
  public bitrate!: number;
  /** Bisim has no user limit: always 0. */
  public userLimit!: number;
  /** Always `null` on Bisim. */
  public rtcRegion!: string | null;
  /** Always `null` on Bisim. */
  public videoQualityMode: number | null = null;

  /**
   * @param guild - The server
   * @param data - The channel from Bisim
   * @param client - The client
   */
  public constructor(guild: Guild, data: RawChannelData, client?: Client) {
    super(guild, data, client);
  }

  public override _patch(data: Partial<RawChannelData>): void {
    super._patch(data);
    this.bitrate ??= 64_000;
    this.userLimit ??= 0;
    this.rtcRegion ??= null;
  }

  /**
   * The members in this voice channel.
   */
  public override get members(): Collection<string, GuildMember> {
    const members = new Collection<string, GuildMember>();
    for (const state of this.voiceStates.values()) {
      const member = state.member;
      if (member) members.set(member.id, member);
    }
    return members;
  }

  /**
   * The voice states of the people in this channel.
   */
  public get voiceStates(): Collection<string, VoiceState> {
    return this.guild.voiceStates.cache.filter((state) => state.channelId === this.id);
  }

  /**
   * Always `false`: bots cannot join voice on Bisim.
   */
  public get joinable(): boolean {
    return false;
  }

  /**
   * Always `false`: bots cannot speak in voice on Bisim.
   */
  public get speakable(): boolean {
    return false;
  }

  /**
   * Always `false` (no user limits on Bisim).
   */
  public get full(): boolean {
    return false;
  }

  /** Not on Bisim. */
  public setBitrate(_bitrate: number, _reason?: string): Promise<this> {
    return notSupported('Voice channel bitrates');
  }

  /** Not on Bisim. */
  public setUserLimit(_userLimit: number, _reason?: string): Promise<this> {
    return notSupported('Voice channel user limits');
  }

  /** Not on Bisim. */
  public setRTCRegion(_rtcRegion: string | null, _reason?: string): Promise<this> {
    return notSupported('Voice regions');
  }

  /** Not on Bisim. */
  public setVideoQualityMode(_mode: number, _reason?: string): Promise<this> {
    return notSupported('Video quality modes');
  }

  /** Not on Bisim: voice channels have no text chat. */
  public send(_options: unknown): Promise<never> {
    return notSupported('Text chat in voice channels');
  }
}

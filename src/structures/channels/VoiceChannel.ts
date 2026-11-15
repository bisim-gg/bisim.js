import type { Client } from '../../client/Client.js';
import { Routes } from '../../rest/Routes.js';
import type { RawChannelData } from '../../types/raw.js';
import { Collection } from '../../util/Collection.js';
import { PermissionFlagsBits } from '../../util/PermissionsBitField.js';
import { notSupported } from '../../util/Util.js';
import type { Guild } from '../Guild.js';
import type { GuildMember } from '../GuildMember.js';
import type { VoiceState } from '../VoiceState.js';
import { GuildChannel } from './GuildChannel.js';

/**
 * What {@link VoiceChannel.sendSoundboardSound} takes besides a sound object.
 */
export interface SendSoundboardSoundOptions {
  /** The sound's id. */
  soundId: string;
  /** Accepted for compatibility: on Bisim a server plays only its own sounds. */
  guildId?: string;
}

/**
 * A voice channel in a server. A bot joins it with @bisim/voice (`joinVoiceChannel`), sees who is in it and
 * moderates them (see {@link VoiceState}). Voice channels on Bisim have no text chat.
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

  private botTimedOut(): boolean {
    const until = this.guild.members.me?.communicationDisabledUntilTimestamp ?? null;
    return until !== null && until > Date.now();
  }

  /**
   * Whether the bot may join this channel: it sees it and has Connect, and is not timed out.
   */
  public get joinable(): boolean {
    if (!this.viewable) return false;
    const mine = this.permissionsFor(this.client.user);
    if (!mine) return false;
    if (mine.has(PermissionFlagsBits.Administrator, false)) return true;
    return !this.botTimedOut() && mine.has(PermissionFlagsBits.Connect, false);
  }

  /**
   * Whether the bot may send sound in this channel: it has Speak, and is not timed out.
   */
  public get speakable(): boolean {
    const mine = this.permissionsFor(this.client.user);
    if (!mine) return false;
    if (mine.has(PermissionFlagsBits.Administrator, false)) return true;
    return !this.botTimedOut() && mine.has(PermissionFlagsBits.Speak, false);
  }

  /**
   * Plays one of the server's soundboard sounds in this channel, for everyone in it. The bot must be connected to
   * the channel (with @bisim/voice) and have Speak and Use Soundboard.
   *
   * @example
   * ```js
   * await channel.sendSoundboardSound({ soundId: '123456789012345678' });
   * ```
   * @param sound - The sound, its id, or `{ soundId }`
   */
  public async sendSoundboardSound(sound: SendSoundboardSoundOptions | { id: string } | string): Promise<void> {
    const soundId = typeof sound === 'string' ? sound : 'soundId' in sound ? sound.soundId : sound.id;
    await this.client.rest.post(Routes.sendSoundboardSound(this.id), { body: { soundId } });
  }

  /**
   * Sets the channel's status line ("Now playing ..."), or clears it with an empty string. The bot must be in the
   * call, with Set Voice Channel Status.
   *
   * @param status - One line, up to 500 characters
   * @param reason - Why (for the audit log)
   * @example
   * ```js
   * await voiceChannel.setStatus('Now playing: lo-fi beats');
   * ```
   */
  public async setStatus(status: string, reason?: string): Promise<this> {
    await this.client.rest.put(Routes.channelVoiceStatus(this.id), { body: { status }, reason });
    return this;
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

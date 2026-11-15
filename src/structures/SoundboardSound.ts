import type { Client } from '../client/Client.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { cdnURL } from '../util/Util.js';
import { attachHidden, dateFrom } from '../util/internal.js';
import { Base } from './Base.js';
import type { VoiceChannel } from './channels/VoiceChannel.js';
import { Emoji } from './Emoji.js';
import type { Guild } from './Guild.js';
import type { User } from './User.js';

/**
 * A soundboard sound as Bisim sends it (REST and the `GUILD_SOUND_*` events).
 */
export interface RawSoundboardSoundData {
  id: string;
  guildId?: string;
  name?: string;
  objectKey?: string;
  /** One Unicode emoji on the sound's button, or empty. */
  emojiName?: string | null;
  /** 0 to 100. */
  volume?: number;
  durationMs?: number;
  creatorId?: string | null;
  createdAt?: string;
}

/**
 * The options for editing a sound.
 */
export interface GuildSoundboardSoundEditOptions {
  /** The new name (2 to 32 characters). */
  name?: string;
  /** How loud it plays, 0 to 1. */
  volume?: number | null;
  /** Not on Bisim: a custom emoji on the button (`emojiName` takes one Unicode emoji). */
  emojiId?: string | null;
  /** One Unicode emoji on the button, or `null` to take it off. */
  emojiName?: string | null;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * One of a server's soundboard sounds. Bisim's volume (0 to 100) reads as discord.js's 0 to 1.
 */
export class SoundboardSound extends Base {
  /** The sound's id. */
  public soundId: string;
  /** The name. */
  public name!: string;
  /** How loud it plays, 0 to 1. */
  public volume!: number;
  /** The server's id. */
  public guildId!: string | null;
  /** Always `true` on Bisim. */
  public available = true;
  /** Bisim: the CDN key of the audio. */
  public objectKey!: string | null;
  /** Bisim: how long it plays, in milliseconds (at most 5000). */
  public durationMs!: number | null;
  /** The id of who added it, or `null`. */
  public creatorId!: string | null;
  private _emojiName!: string | null;

  /**
   * @param client - The client
   * @param data - The sound from Bisim
   */
  public constructor(client: Client, data: RawSoundboardSoundData) {
    super(client);
    this.soundId = data.id;
    this.name = '';
    this.volume = 1;
    this.guildId = null;
    this.objectKey = null;
    this.durationMs = null;
    this.creatorId = null;
    this._emojiName = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawSoundboardSoundData>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.volume !== undefined && data.volume !== null) this.volume = data.volume / 100;
    if (data.guildId !== undefined) this.guildId = data.guildId || null;
    if (data.objectKey !== undefined) this.objectKey = data.objectKey || null;
    if (data.durationMs !== undefined) this.durationMs = data.durationMs || null;
    if (data.creatorId !== undefined) this.creatorId = data.creatorId || null;
    if (data.emojiName !== undefined) this._emojiName = data.emojiName || null;
  }

  /**
   * When the sound was added, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.soundId);
  }

  /**
   * When the sound was added.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The emoji on the sound's button, or `null`.
   */
  public get emoji(): Emoji | null {
    return this._emojiName ? new Emoji(this.client, { id: null, name: this._emojiName }) : null;
  }

  /**
   * The server, when cached.
   */
  public get guild(): Guild | null {
    return this.guildId ? (this.client.guilds.cache.get(this.guildId) ?? null) : null;
  }

  /**
   * Who added the sound, when cached.
   */
  public get user(): User | null {
    return this.creatorId ? (this.client.users.cache.get(this.creatorId) ?? null) : null;
  }

  /**
   * The audio's URL.
   */
  public get url(): string {
    return cdnURL(this.client.options.rest.cdn, this.objectKey) ?? '';
  }

  /**
   * Edits the sound (needs Manage Expressions).
   *
   * @param options - What to change
   */
  public edit(options: GuildSoundboardSoundEditOptions = {}): Promise<SoundboardSound> {
    return this.requireGuild().soundboardSounds.edit(this, options);
  }

  /**
   * Deletes the sound.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<SoundboardSound> {
    await this.requireGuild().soundboardSounds.delete(this, reason);
    return this;
  }

  /**
   * Whether this sound is the same as another.
   *
   * @param other - The other sound, or its data
   */
  public equals(other: SoundboardSound | RawSoundboardSoundData): boolean {
    if (other instanceof SoundboardSound) {
      return other.soundId === this.soundId && other.name === this.name && other.volume === this.volume && other._emojiName === this._emojiName;
    }
    return other.id === this.soundId && other.name === this.name && (other.volume ?? 100) / 100 === this.volume && (other.emojiName || null) === this._emojiName;
  }

  private requireGuild(): Guild {
    const guild = this.guild;
    if (!guild) throw new TypeError('This sound does not belong to a cached server.');
    return guild;
  }
}

/**
 * Someone played a soundboard sound in a voice channel (the `voiceChannelEffectSend` event). Bisim's effects are
 * sounds only, so the animation fields are always `null`.
 */
export class VoiceChannelEffect {
  /** The server. */
  public declare readonly guild: Guild;
  /** The voice channel's id. */
  public channelId: string;
  /** Who played it. */
  public userId: string;
  /** The emoji of the sound's button, or `null`. */
  public emoji: Emoji | null;
  /** Always `null` on Bisim. */
  public animationType: null = null;
  /** Always `null` on Bisim. */
  public animationId: null = null;
  /** The sound's id. */
  public soundId: string | null;
  /** How loud it plays, 0 to 1. */
  public soundVolume: number | null;

  /**
   * @param guild - The server
   * @param data - The channel, the player and the sound
   */
  public constructor(guild: Guild, data: { channelId: string; userId: string; sound: SoundboardSound | null }) {
    attachHidden(this, 'guild', guild);
    this.channelId = data.channelId;
    this.userId = data.userId;
    this.soundId = data.sound?.soundId ?? null;
    this.soundVolume = data.sound ? data.sound.volume : null;
    this.emoji = data.sound?.emoji ?? null;
  }

  /**
   * The voice channel, when cached.
   */
  public get channel(): VoiceChannel | null {
    return (this.guild.channels.cache.get(this.channelId) as VoiceChannel | undefined) ?? null;
  }

  /**
   * The sound, when cached.
   */
  public get soundboardSound(): SoundboardSound | null {
    return this.soundId ? (this.guild.soundboardSounds.cache.get(this.soundId) ?? null) : null;
  }
}

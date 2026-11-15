import type { Readable } from 'node:stream';
import type { BufferResolvable } from '../builders/AttachmentBuilder.js';
import { Routes } from '../rest/Routes.js';
import { guessContentType } from '../rest/REST.js';
import type { Guild } from '../structures/Guild.js';
import { MessagePayload } from '../structures/MessagePayload.js';
import { type GuildSoundboardSoundEditOptions, type RawSoundboardSoundData, SoundboardSound } from '../structures/SoundboardSound.js';
import { Collection } from '../util/Collection.js';
import { attachHidden } from '../util/internal.js';
import { notSupported } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';

/**
 * A sound, by structure or id.
 */
export type SoundboardSoundResolvable = SoundboardSound | string;

/**
 * The options for adding a sound.
 */
export interface GuildSoundboardSoundCreateOptions {
  /** The audio (at most five seconds): a Buffer, a path, a URL or a stream. */
  file: BufferResolvable | Readable;
  /** The name (2 to 32 characters). */
  name: string;
  /** The content type, guessed from the file name when left out. */
  contentType?: string;
  /** How loud it plays, 0 to 1 (1 by default). */
  volume?: number;
  /** Not on Bisim: a custom emoji on the button. */
  emojiId?: string;
  /** One Unicode emoji on the button. */
  emojiName?: string;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * Options for fetching sounds.
 */
export interface FetchGuildSoundboardSoundsOptions {
  cache?: boolean;
}

const idOf = (sound: SoundboardSoundResolvable): string => (typeof sound === 'string' ? sound : sound.soundId);
const percent = (volume: number): number => Math.max(0, Math.min(100, Math.round(volume * 100)));

/**
 * Manages a server's soundboard sounds. The cache fills from the `GUILD_SOUND_*` events and from `fetch()`.
 */
export class GuildSoundboardSoundManager extends CachedManager<string, SoundboardSound, SoundboardSoundResolvable> {
  /** The server. */
  public declare readonly guild: Guild;

  /**
   * @param guild - The server
   */
  public constructor(guild: Guild) {
    super(guild.client);
    attachHidden(this, 'guild', guild);
  }

  /**
   * Adds a sound to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawSoundboardSoundData, cache = true): SoundboardSound {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const sound = new SoundboardSound(this.client, { ...data, guildId: data.guildId || this.guild.id });
    if (cache) this.cache.set(sound.soundId, sound);
    return sound;
  }

  public override resolveId(sound: SoundboardSoundResolvable): string {
    return idOf(sound);
  }

  /**
   * Fetches one sound by id, or every sound of the server.
   *
   * @param soundId - The sound's id
   * @param options - Whether to cache them
   */
  public fetch(soundId: string, options?: FetchGuildSoundboardSoundsOptions): Promise<SoundboardSound>;
  public fetch(soundId?: undefined, options?: FetchGuildSoundboardSoundsOptions): Promise<Collection<string, SoundboardSound>>;
  public async fetch(
    soundId?: string,
    options: FetchGuildSoundboardSoundsOptions = {},
  ): Promise<SoundboardSound | Collection<string, SoundboardSound>> {
    const data = (await this.client.rest.get(Routes.guildSoundboardSounds(this.guild.id))) as RawSoundboardSoundData[];
    const sounds = new Collection<string, SoundboardSound>();
    for (const raw of data) sounds.set(raw.id, this._add(raw, options.cache ?? true));
    if (soundId === undefined) return sounds;
    const found = sounds.get(soundId);
    if (!found) throw new TypeError(`Unknown soundboard sound ${soundId}`);
    return found;
  }

  /**
   * Adds a sound (needs Manage Server; at most five seconds long).
   *
   * @param options - The audio, the name and how it plays
   */
  public async create(options: GuildSoundboardSoundCreateOptions): Promise<SoundboardSound> {
    if (options.emojiId) notSupported('Custom emoji on soundboard sounds');
    const raw = await MessagePayload.resolveFile({ attachment: options.file as BufferResolvable, name: undefined });
    const fileName = raw.name || 'sound.ogg';
    const form = new FormData();
    form.append('name', options.name);
    if (options.emojiName) form.append('emojiName', options.emojiName);
    if (options.volume !== undefined) form.append('volume', String(percent(options.volume)));
    const bytes = raw.data as Buffer;
    form.append('file', new Blob([new Uint8Array(bytes)], { type: options.contentType ?? guessContentType(fileName) }), fileName);
    const data = (await this.client.rest.post(Routes.guildSoundboardSounds(this.guild.id), {
      body: form,
      passThroughBody: true,
      reason: options.reason,
    })) as RawSoundboardSoundData;
    return this._add(data);
  }

  /**
   * Edits a sound: its name, volume and emoji.
   *
   * @param sound - The sound
   * @param options - What to change
   */
  public async edit(sound: SoundboardSoundResolvable, options: GuildSoundboardSoundEditOptions = {}): Promise<SoundboardSound> {
    if (options.emojiId) notSupported('Custom emoji on soundboard sounds');
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.volume !== undefined) body.volume = percent(options.volume ?? 1);
    if (options.emojiName !== undefined) body.emojiName = options.emojiName;
    else if (options.emojiId === null) body.emojiName = null;
    const data = (await this.client.rest.patch(Routes.guildSoundboardSound(this.guild.id, idOf(sound)), {
      body,
      reason: options.reason,
    })) as RawSoundboardSoundData;
    return this._add(data);
  }

  /**
   * Deletes a sound.
   *
   * @param sound - The sound
   * @param reason - Why
   */
  public async delete(sound: SoundboardSoundResolvable, reason?: string): Promise<void> {
    const id = idOf(sound);
    await this.client.rest.delete(Routes.guildSoundboardSound(this.guild.id, id), { reason });
    this.cache.delete(id);
  }
}

import { basename } from 'node:path';
import type { BufferResolvable } from '../builders/AttachmentBuilder.js';
import { Routes } from '../rest/Routes.js';
import { guessContentType } from '../rest/REST.js';
import { GuildEmoji, Sticker } from '../structures/Emoji.js';
import type { Guild } from '../structures/Guild.js';
import { MessagePayload } from '../structures/MessagePayload.js';
import type { User } from '../structures/User.js';
import type { RawEmojiData, RawStickerData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { notSupported } from '../util/Util.js';
import { CachedManager } from './BaseManager.js';
import type { BaseFetchOptions } from './UserManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * Options for creating an emoji.
 */
export interface GuildEmojiCreateOptions {
  /** The image: a Buffer, a path or a URL. */
  attachment: BufferResolvable;
  /** The name (2 to 32 letters, digits or `_`). */
  name: string;
  /** Not on Bisim: emoji limited to roles. */
  roles?: unknown;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * Options for creating a sticker.
 */
export interface GuildStickerCreateOptions {
  /** The image: a Buffer, a path or a URL. */
  file: BufferResolvable | { attachment: BufferResolvable; name?: string };
  /** The name. */
  name: string;
  /** Accepted for compatibility. */
  tags?: string;
  /** Accepted for compatibility. */
  description?: string | null;
  /** Why (for the audit log). */
  reason?: string;
}

async function uploadForm(file: BufferResolvable | { attachment: BufferResolvable; name?: string }, name: string): Promise<FormData> {
  const raw = await MessagePayload.resolveFile(file as never);
  const fileName = raw.name || (typeof file === 'string' ? basename(file) : 'image.png');
  const form = new FormData();
  form.append('name', name);
  const bytes = raw.data as Buffer;
  form.append('file', new Blob([new Uint8Array(bytes)], { type: guessContentType(fileName) }), fileName);
  return form;
}

/**
 * Manages the custom emoji of a server.
 */
export class GuildEmojiManager extends CachedManager<string, GuildEmoji, GuildEmoji | string> {
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
   * Adds an emoji to the cache.
   *
   * @internal
   */
  public _add(data: RawEmojiData, cache = true): GuildEmoji {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const emoji = new GuildEmoji(this.client, data, this.guild);
    if (cache) this.cache.set(emoji.id!, emoji);
    return emoji;
  }

  /**
   * Fetches one emoji by id, or every emoji of the server.
   *
   * @param id - The emoji's id
   * @param options - Whether to cache or skip the cache
   */
  public fetch(id: string, options?: BaseFetchOptions): Promise<GuildEmoji>;
  public fetch(id?: undefined, options?: BaseFetchOptions): Promise<Collection<string, GuildEmoji>>;
  public async fetch(id?: string, options: BaseFetchOptions = {}): Promise<GuildEmoji | Collection<string, GuildEmoji>> {
    if (id && !options.force) {
      const cached = this.fromCache(id);
      if (cached) return cached;
    }
    const data = (await this.client.rest.get(Routes.guildEmojis(this.guild.id))) as RawEmojiData[];
    const emojis = new Collection<string, GuildEmoji>();
    if (options.cache ?? true) this.cache.clear();
    for (const raw of data) {
      const emoji = this._add(raw, options.cache ?? true);
      emojis.set(emoji.id!, emoji);
    }
    if (id) {
      const found = emojis.get(id);
      if (!found) throw new TypeError(`Unknown emoji ${id}`);
      return found;
    }
    return emojis;
  }

  /**
   * Creates an emoji (needs Create Expressions).
   *
   * @param options - The image and the name
   */
  public async create(options: GuildEmojiCreateOptions): Promise<GuildEmoji> {
    if (options.roles !== undefined) notSupported('Emoji limited to roles');
    const form = await uploadForm(options.attachment, options.name);
    const data = (await this.client.rest.post(Routes.guildEmojis(this.guild.id), {
      body: form,
      passThroughBody: true,
      reason: options.reason,
    })) as RawEmojiData;
    return this._add(data);
  }

  /**
   * Deletes an emoji.
   *
   * @param emoji - The emoji
   * @param reason - Why
   */
  public async delete(emoji: GuildEmoji | string, reason?: string): Promise<void> {
    const id = typeof emoji === 'string' ? emoji : emoji.id!;
    await this.client.rest.delete(Routes.guildEmoji(this.guild.id, id), { reason });
    this.cache.delete(id);
  }

  /** Not on Bisim: emoji cannot be renamed. */
  public edit(_emoji: unknown, _options: unknown): Promise<never> {
    return notSupported('Editing an emoji');
  }

  /**
   * Fetches who added an emoji.
   *
   * @param emoji - The emoji
   */
  public async fetchAuthor(emoji: GuildEmoji | string): Promise<User | null> {
    const resolved = typeof emoji === 'string' ? await this.fetch(emoji) : emoji;
    return resolved.fetchAuthor();
  }
}

/**
 * Manages the stickers of a server.
 */
export class GuildStickerManager extends CachedManager<string, Sticker, Sticker | string> {
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
   * Adds a sticker to the cache.
   *
   * @internal
   */
  public _add(data: RawStickerData, cache = true): Sticker {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const sticker = new Sticker(this.client, { ...data, guildId: this.guild.id });
    if (cache) this.cache.set(sticker.id, sticker);
    return sticker;
  }

  /**
   * Fetches one sticker by id, or every sticker of the server.
   *
   * @param id - The sticker's id
   * @param options - Whether to cache or skip the cache
   */
  public fetch(id: string, options?: BaseFetchOptions): Promise<Sticker>;
  public fetch(id?: undefined, options?: BaseFetchOptions): Promise<Collection<string, Sticker>>;
  public async fetch(id?: string, options: BaseFetchOptions = {}): Promise<Sticker | Collection<string, Sticker>> {
    if (id && !options.force) {
      const cached = this.fromCache(id);
      if (cached) return cached;
    }
    const data = (await this.client.rest.get(Routes.guildStickers(this.guild.id))) as RawStickerData[];
    const stickers = new Collection<string, Sticker>();
    for (const raw of data) {
      const sticker = this._add(raw, options.cache ?? true);
      stickers.set(sticker.id, sticker);
    }
    if (id) {
      const found = stickers.get(id);
      if (!found) throw new TypeError(`Unknown sticker ${id}`);
      return found;
    }
    return stickers;
  }

  /**
   * Creates a sticker (needs Create Expressions).
   *
   * @param options - The image and the name
   */
  public async create(options: GuildStickerCreateOptions): Promise<Sticker> {
    const form = await uploadForm(options.file, options.name);
    const data = (await this.client.rest.post(Routes.guildStickers(this.guild.id), {
      body: form,
      passThroughBody: true,
      reason: options.reason,
    })) as RawStickerData;
    return this._add(data);
  }

  /**
   * Deletes a sticker.
   *
   * @param sticker - The sticker
   * @param reason - Why
   */
  public async delete(sticker: Sticker | string, reason?: string): Promise<void> {
    const id = typeof sticker === 'string' ? sticker : sticker.id;
    await this.client.rest.delete(Routes.guildSticker(this.guild.id, id), { reason });
    this.cache.delete(id);
  }

  /** Not on Bisim: stickers cannot be renamed. */
  public edit(_sticker: unknown, _options: unknown): Promise<never> {
    return notSupported('Editing a sticker');
  }
}

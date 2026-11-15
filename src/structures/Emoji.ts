import type { Client } from '../client/Client.js';
import { Routes } from '../rest/Routes.js';
import type { RawEmojiData, RawStickerData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { PermissionFlagsBits } from '../util/PermissionsBitField.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { cdnURL, parseEmoji } from '../util/Util.js';
import type { GuildEmojiEditOptions, GuildStickerEditOptions } from '../managers/GuildExpressionManagers.js';
import { Base } from './Base.js';
import type { Guild } from './Guild.js';
import type { MessageReaction } from './MessageReaction.js';
import type { Role } from './Role.js';
import type { User } from './User.js';
import { attachHidden, dateFrom } from '../util/internal.js';

/**
 * An emoji: a Unicode emoji (no id) or a server's custom emoji.
 */
export class Emoji extends Base {
  /** Whether the emoji is animated. */
  public animated!: boolean | null;
  /** The name: the Unicode characters, or the custom emoji's name. */
  public name!: string | null;
  /** The id of a custom emoji, or `null`. */
  public id!: string | null;

  /**
   * @param client - The client
   * @param emoji - The emoji
   */
  public constructor(client: Client, emoji: { id?: string | null; name?: string | null; animated?: boolean | null }) {
    super(client);
    this.animated = emoji.animated ?? null;
    this.name = emoji.name ?? null;
    this.id = emoji.id ?? null;
  }

  /**
   * The emoji as Bisim's reaction routes take it: the Unicode characters, or `<:name:id>`, URL encoded.
   */
  public get identifier(): string {
    if (this.id) return encodeURIComponent(`<${this.animated ? 'a' : ''}:${this.name ?? '_'}:${this.id}>`);
    return encodeURIComponent(this.name ?? '');
  }

  /**
   * The image URL of a custom emoji, or `null` for a Unicode one.
   */
  public get url(): string | null {
    return this.imageURL();
  }

  /**
   * The image URL of a custom emoji, or `null` for a Unicode one.
   *
   * @param options - The size to ask for
   */
  public imageURL(options: { size?: number } = {}): string | null {
    if (!this.id) return null;
    const known = this.client.emojis.cache.get(this.id);
    return known?.objectKey ? cdnURL(this.client.options.rest.cdn, known.objectKey, options.size) : null;
  }

  /**
   * When a custom emoji was made, in milliseconds, or `null` for a Unicode one.
   */
  public get createdTimestamp(): number | null {
    return this.id ? SnowflakeUtil.timestampFrom(this.id) : null;
  }

  /**
   * When a custom emoji was made, or `null` for a Unicode one.
   */
  public get createdAt(): Date | null {
    return this.createdTimestamp === null ? null : new Date(this.createdTimestamp);
  }

  /**
   * The emoji as text: `<:name:id>` for a custom emoji, the characters for a Unicode one.
   */
  public override toString(): string {
    return this.id ? `<${this.animated ? 'a' : ''}:${this.name}:${this.id}>` : (this.name ?? '');
  }

  public override toJSON(): unknown {
    return { animated: this.animated, name: this.name, id: this.id };
  }
}

/**
 * The emoji of a reaction.
 */
export class ReactionEmoji extends Emoji {
  /** The reaction. */
  public declare readonly reaction: MessageReaction;

  /**
   * @param reaction - The reaction
   * @param emoji - The emoji
   */
  public constructor(reaction: MessageReaction, emoji: { id?: string | null; name?: string | null; animated?: boolean | null }) {
    super(reaction.message.client, emoji);
    attachHidden(this, 'reaction', reaction);
  }
}

/**
 * Reads Bisim's emoji text (`👍` or `<:name:id>`) into its parts.
 *
 * @internal
 */
export function emojiFromBisim(text: string): { id: string | null; name: string; animated: boolean } {
  const parsed = parseEmoji(text);
  if (parsed?.id) return { id: parsed.id, name: parsed.name, animated: parsed.animated };
  return { id: null, name: text, animated: false };
}

/**
 * A custom emoji of a server.
 */
export class GuildEmoji extends Emoji {
  /** The server. */
  public declare readonly guild: Guild;
  /** The CDN key of the image. */
  public objectKey!: string | null;
  /** Who added it, when fetched. */
  public author!: User | null;
  /** The id of who added it. */
  public creatorId!: string | null;
  /** Always `false` on Bisim. */
  public managed = false;
  /** Always `true`. */
  public requiresColons = true;
  /** Always `true`. */
  public available = true;

  /**
   * @param client - The client
   * @param data - The emoji from Bisim
   * @param guild - The server
   */
  public constructor(client: Client, data: RawEmojiData, guild: Guild) {
    super(client, { id: data.id, name: data.name, animated: data.animated ?? false });
    attachHidden(this, 'guild', guild);
    this.author = null;
    this.objectKey = null;
    this.creatorId = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawEmojiData>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.objectKey !== undefined) this.objectKey = data.objectKey || null;
    if (data.creatorId !== undefined) this.creatorId = data.creatorId || null;
  }

  public override imageURL(options: { size?: number } = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.objectKey, options.size);
  }

  /**
   * Always empty on Bisim (emoji are not limited to roles).
   */
  public get roles(): { cache: Collection<string, Role> } {
    return { cache: new Collection() };
  }

  /**
   * Whether the bot can delete this emoji.
   */
  public get deletable(): boolean {
    return this.guild.members.me?.permissions.has(PermissionFlagsBits.ManageGuildExpressions) ?? false;
  }

  /**
   * Fetches who added the emoji.
   */
  public async fetchAuthor(): Promise<User | null> {
    if (!this.creatorId) return null;
    this.author = await this.client.users.fetch(this.creatorId);
    return this.author;
  }

  /**
   * Renames the emoji. `roles` is not on Bisim and throws.
   *
   * @param data - The new name, and why
   * @example
   * ```js
   * await emoji.edit({ name: 'party_blob' });
   * ```
   */
  public edit(data: GuildEmojiEditOptions): Promise<GuildEmoji> {
    return this.guild.emojis.edit(this, data);
  }

  /**
   * Renames the emoji.
   *
   * @param name - The new name (2 to 32 letters, digits or `_`)
   * @param reason - Why
   */
  public setName(name: string, reason?: string): Promise<GuildEmoji> {
    return this.edit({ name, reason });
  }

  /**
   * Deletes the emoji.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<GuildEmoji> {
    await this.client.rest.delete(Routes.guildEmoji(this.guild.id, this.id!), { reason });
    this.guild.emojis.cache.delete(this.id!);
    return this;
  }

  /**
   * Whether this emoji is the same as another.
   *
   * @param other - The other emoji
   */
  public equals(other: GuildEmoji | { id: string; name: string }): boolean {
    return other && this.id === other.id && this.name === other.name;
  }
}

/**
 * A sticker of a server. On Bisim a sticker is sent as a message of its own.
 */
export class Sticker extends Base {
  /** The id. */
  public id: string;
  /** The name. */
  public name!: string | null;
  /** The server it belongs to. */
  public guildId!: string | null;
  /** The CDN key of the image. */
  public objectKey!: string | null;
  /** Always `null` on Bisim. */
  public description: string | null = null;
  /** Always `null` on Bisim. */
  public tags: string | null = null;
  /** Always `true`. */
  public available = true;
  /** Who added it. */
  public creatorId!: string | null;

  /**
   * @param client - The client
   * @param data - The sticker from Bisim
   */
  public constructor(client: Client, data: Partial<RawStickerData> & { id: string }) {
    super(client);
    this.id = data.id;
    this.name = null;
    this.guildId = null;
    this.objectKey = null;
    this.creatorId = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawStickerData>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.guildId !== undefined) this.guildId = data.guildId || null;
    if (data.objectKey !== undefined) this.objectKey = data.objectKey || null;
    if (data.creatorId !== undefined) this.creatorId = data.creatorId || null;
  }

  /**
   * Whether only the id is known.
   */
  public get partial(): boolean {
    return this.name === null;
  }

  /**
   * The server the sticker belongs to.
   */
  public get guild(): Guild | null {
    return this.guildId ? (this.client.guilds.cache.get(this.guildId) ?? null) : null;
  }

  /**
   * The image URL.
   */
  public get url(): string | null {
    return cdnURL(this.client.options.rest.cdn, this.objectKey);
  }

  /**
   * When the sticker was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the sticker was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * Deletes the sticker.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<Sticker> {
    if (!this.guildId) throw new TypeError('This sticker does not belong to a server.');
    await this.client.rest.delete(Routes.guildSticker(this.guildId, this.id), { reason });
    this.guild?.stickers.cache.delete(this.id);
    return this;
  }

  /**
   * Renames the sticker. `description` and `tags` are not on Bisim and throw.
   *
   * @param data - The new name, and why
   */
  public edit(data: GuildStickerEditOptions): Promise<Sticker> {
    const guild = this.guild;
    if (!guild) throw new TypeError('This sticker does not belong to a cached server.');
    return guild.stickers.edit(this, data);
  }

  /**
   * The sticker as Bisim's message token, `<sticker:id>`.
   */
  public override toString(): string {
    return `<sticker:${this.id}>`;
  }
}

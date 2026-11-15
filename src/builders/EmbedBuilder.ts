import { BisimjsRangeError, ErrorCodes } from '../errors/index.js';
import { type ColorResolvable, resolveColor } from '../util/Util.js';

/**
 * A field of an embed.
 */
export interface APIEmbedField {
  name: string;
  value: string;
  inline?: boolean;
}

/**
 * The author line of an embed.
 */
export interface APIEmbedAuthor {
  name: string;
  url?: string;
  /** The round icon before the name (an http or https link, or `attachment://name`). */
  icon_url?: string;
  proxy_icon_url?: string;
}

/**
 * The footer of an embed.
 */
export interface APIEmbedFooter {
  text: string;
  /** The round icon before the text (an http or https link, or `attachment://name`). */
  icon_url?: string;
  proxy_icon_url?: string;
}

/**
 * A picture of an embed: its large image or its thumbnail. Bisim reads `url` (an http or https link); `proxy_url`,
 * `width` and `height` are only filled on embeds Bisim sends back.
 */
export interface APIEmbedImage {
  url: string;
  proxy_url?: string;
  height?: number;
  width?: number;
}

/**
 * An embed, in the shape discord.js builds. Bisim shows the title, description, URL, color, timestamp,
 * author (name, URL and icon), footer (text and icon), fields, image and thumbnail. A picture is an http or https
 * link, or `attachment://name` for a file sent (or kept) with the same message.
 */
export interface APIEmbed {
  title?: string;
  type?: string;
  description?: string;
  url?: string;
  timestamp?: string;
  color?: number;
  footer?: APIEmbedFooter;
  image?: APIEmbedImage;
  thumbnail?: APIEmbedImage;
  video?: APIEmbedImage;
  provider?: { name?: string; url?: string };
  author?: APIEmbedAuthor;
  fields?: APIEmbedField[];
}

/**
 * The options of {@link EmbedBuilder.setAuthor}.
 */
export interface EmbedAuthorOptions {
  name: string;
  url?: string;
  /** The round icon before the name (an http or https link, or `attachment://name`). */
  iconURL?: string;
}

/**
 * The options of {@link EmbedBuilder.setFooter}.
 */
export interface EmbedFooterOptions {
  text: string;
  /** The round icon before the text (an http or https link, or `attachment://name`). */
  iconURL?: string;
}

const warned = new Set<string>();

/** Bisim's (and Discord's) cap on an embed picture's address. */
const PICTURE_URL_MAX = 2048;

/**
 * Warns once per kind that a part of an embed is not shown on Bisim.
 *
 * @internal
 */
export function warnEmbedPart(part: string): void {
  if (warned.has(part)) return;
  warned.add(part);
  process.emitWarning(`Embed ${part} is kept but not shown on Bisim.`, { code: 'BISIMJS_EMBED_PART', type: 'BisimjsWarning' });
}

function checkLength(value: string | undefined | null, max: number, code: (typeof ErrorCodes)[keyof typeof ErrorCodes]): void {
  if (typeof value === 'string' && value.length > max) throw new BisimjsRangeError(code);
}

function checkField(field: APIEmbedField): APIEmbedField {
  if (typeof field.name !== 'string' || field.name.length < 1 || field.name.length > 256) throw new BisimjsRangeError(ErrorCodes.EmbedFieldName);
  if (typeof field.value !== 'string' || field.value.length < 1 || field.value.length > 1024) throw new BisimjsRangeError(ErrorCodes.EmbedFieldValue);
  return field.inline === undefined ? { name: field.name, value: field.value } : { name: field.name, value: field.value, inline: field.inline };
}

/**
 * Builds an embed (a card under a message), the discord.js way.
 *
 * @example
 * ```js
 * const card = new EmbedBuilder()
 *   .setColor(0x3f5600)
 *   .setTitle('Weekly game night')
 *   .setDescription('Join us in the voice channel on Friday.')
 *   .addFields({ name: 'Host', value: 'Sara' })
 *   .setTimestamp();
 * await channel.send({ embeds: [card] });
 * ```
 */
export class EmbedBuilder {
  /**
   * The embed data.
   */
  public readonly data: APIEmbed;

  /**
   * @param data - Embed data to start from
   */
  public constructor(data: APIEmbed = {}) {
    this.data = { ...data };
    if (data.fields) this.data.fields = data.fields.map((field) => ({ ...field }));
    if (data.timestamp) this.data.timestamp = new Date(data.timestamp).toISOString();
  }

  /**
   * Adds fields (at most 25 in all).
   *
   * @param fields - The fields, each a name, a value and whether it sits inline
   */
  public addFields(...fields: (APIEmbedField | APIEmbedField[])[]): this {
    const flat = (fields.flat() as APIEmbedField[]).map(checkField);
    const all = [...(this.data.fields ?? []), ...flat];
    if (all.length > 25) throw new BisimjsRangeError(ErrorCodes.EmbedFieldCount);
    this.data.fields = all;
    return this;
  }

  /**
   * Removes, replaces or inserts fields, like `Array.prototype.splice()`.
   *
   * @param index - Where to start
   * @param deleteCount - How many fields to remove
   * @param fields - Fields to insert
   */
  public spliceFields(index: number, deleteCount: number, ...fields: APIEmbedField[]): this {
    const current = [...(this.data.fields ?? [])];
    current.splice(index, deleteCount, ...fields.map(checkField));
    if (current.length > 25) throw new BisimjsRangeError(ErrorCodes.EmbedFieldCount);
    this.data.fields = current;
    return this;
  }

  /**
   * Replaces all the fields.
   *
   * @param fields - The fields
   */
  public setFields(...fields: (APIEmbedField | APIEmbedField[])[]): this {
    this.data.fields = [];
    return this.addFields(...fields);
  }

  /**
   * Sets the author line.
   *
   * @param options - The author, or `null` to remove it
   */
  public setAuthor(options: EmbedAuthorOptions | null): this {
    if (options === null) {
      delete this.data.author;
      return this;
    }
    checkLength(options.name, 256, ErrorCodes.EmbedAuthorName);
    const author: APIEmbedAuthor = { name: options.name };
    if (options.url) author.url = options.url;
    if (options.iconURL) author.icon_url = options.iconURL;
    this.data.author = author;
    return this;
  }

  /**
   * Sets the color.
   *
   * @param color - The color, or `null` to remove it
   */
  public setColor(color: ColorResolvable | null): this {
    if (color === null) delete this.data.color;
    else this.data.color = resolveColor(color);
    return this;
  }

  /**
   * Sets the description (at most 4096 characters).
   *
   * @param description - The description, or `null` to remove it
   */
  public setDescription(description: string | null): this {
    if (description === null) delete this.data.description;
    else {
      checkLength(description, 4096, ErrorCodes.EmbedDescription);
      this.data.description = description;
    }
    return this;
  }

  /**
   * Sets the footer.
   *
   * @param options - The footer, or `null` to remove it
   */
  public setFooter(options: EmbedFooterOptions | null): this {
    if (options === null) {
      delete this.data.footer;
      return this;
    }
    checkLength(options.text, 2048, ErrorCodes.EmbedFooterText);
    const footer: APIEmbedFooter = { text: options.text };
    if (options.iconURL) footer.icon_url = options.iconURL;
    this.data.footer = footer;
    return this;
  }

  /**
   * Sets the large image, shown below the fields.
   *
   * @param url - The image URL (http or https, or `attachment://name`), or `null` to remove it
   */
  public setImage(url: string | null): this {
    if (url === null) delete this.data.image;
    else this.data.image = { url };
    return this;
  }

  /**
   * Sets the thumbnail, the small picture beside the text.
   *
   * @param url - The thumbnail URL (http or https, or `attachment://name`), or `null` to remove it
   */
  public setThumbnail(url: string | null): this {
    if (url === null) delete this.data.thumbnail;
    else this.data.thumbnail = { url };
    return this;
  }

  /**
   * Sets the timestamp shown in the footer.
   *
   * @param timestamp - The time, now by default, or `null` to remove it
   */
  public setTimestamp(timestamp: Date | number | null = Date.now()): this {
    if (timestamp === null) delete this.data.timestamp;
    else this.data.timestamp = new Date(timestamp).toISOString();
    return this;
  }

  /**
   * Sets the title (at most 256 characters).
   *
   * @param title - The title, or `null` to remove it
   */
  public setTitle(title: string | null): this {
    if (title === null) delete this.data.title;
    else {
      checkLength(title, 256, ErrorCodes.EmbedTitle);
      this.data.title = title;
    }
    return this;
  }

  /**
   * Sets the URL the title links to.
   *
   * @param url - The URL, or `null` to remove it
   */
  public setURL(url: string | null): this {
    if (url === null) delete this.data.url;
    else this.data.url = url;
    return this;
  }

  /**
   * The embed as JSON (discord.js's shape, which Bisim's message routes read).
   */
  public toJSON(): APIEmbed {
    const json: APIEmbed = { ...this.data };
    if (this.data.fields) json.fields = this.data.fields.map((field) => ({ ...field }));
    return json;
  }

  /**
   * Makes a builder from an existing embed or its JSON.
   *
   * @param other - The embed to copy
   */
  public static from(other: APIEmbed | { toJSON(): APIEmbed }): EmbedBuilder {
    return new EmbedBuilder(typeof (other as { toJSON?: unknown }).toJSON === 'function' ? (other as { toJSON(): APIEmbed }).toJSON() : (other as APIEmbed));
  }
}

const ATTACHMENT_SCHEME = 'attachment://';

/**
 * What {@link toBisimEmbed} knows about the message an embed goes in.
 *
 * @internal
 */
export interface ToBisimEmbedOptions {
  /**
   * The names of the files the message carries or keeps, which `attachment://name` may show; `null` when an edit
   * keeps files bisim.js does not know (the server then checks the name). Empty by default.
   */
  attachmentNames?: ReadonlySet<string> | null;
}

/**
 * A picture's address as Bisim takes it: an http or https link of at most 2048 characters, or `attachment://name`
 * for a file of the same message. Anything else, and an `attachment://` naming no file of the message, is left out
 * with a warning, since Bisim would refuse the whole message for it.
 */
function pictureURL(url: unknown, attachmentNames: ReadonlySet<string> | null): string | undefined {
  if (typeof url !== 'string' || !url) return undefined;
  if (/^https?:\/\/[^/?#\s]/i.test(url) && url.length <= PICTURE_URL_MAX) return url;
  if (url.startsWith(ATTACHMENT_SCHEME)) {
    const name = url.slice(ATTACHMENT_SCHEME.length);
    // eslint-disable-next-line no-control-regex
    const valid = name.length > 0 && name.length <= 256 && !/[\u0000-\u001f]/.test(name);
    if (valid && (attachmentNames === null || attachmentNames.has(name))) return url;
    warnEmbedPart('attachment:// pictures that name no file of the message are');
    return undefined;
  }
  warnEmbedPart('pictures that are not http or https links are');
  return undefined;
}

/**
 * Converts an embed (a builder, an {@link Embed} or JSON) to the nested shape Bisim's message routes take.
 * Parts Bisim does not show are left out.
 *
 * @param input - The embed
 * @param options - The files of the message, for `attachment://` pictures
 * @internal
 */
export function toBisimEmbed(input: unknown, options: ToBisimEmbedOptions = {}): Record<string, unknown> {
  const names = options.attachmentNames === undefined ? new Set<string>() : options.attachmentNames;
  const data = (
    input && typeof (input as { toJSON?: unknown }).toJSON === 'function' ? (input as { toJSON(): APIEmbed }).toJSON() : input
  ) as APIEmbed & Record<string, unknown>;
  const out: Record<string, unknown> = {};
  if (data.title) out.title = data.title;
  if (data.description) out.description = data.description;
  if (data.url) out.url = data.url;
  if (typeof data.color === 'number') out.color = data.color;
  if (data.timestamp) out.timestamp = new Date(data.timestamp).toISOString();
  const authorName = data.author?.name ?? (data.authorName as string | undefined);
  if (authorName) {
    const author: Record<string, string> = { name: authorName };
    const authorUrl = data.author?.url ?? (data.authorUrl as string | undefined);
    if (authorUrl) author.url = authorUrl;
    const iconUrl = pictureURL(data.author?.icon_url ?? data.authorIconUrl, names);
    if (iconUrl) author.iconUrl = iconUrl;
    out.author = author;
  }
  const footerText = data.footer?.text ?? (data.footerText as string | undefined);
  if (footerText) {
    const footer: Record<string, string> = { text: footerText };
    const iconUrl = pictureURL(data.footer?.icon_url ?? data.footerIconUrl, names);
    if (iconUrl) footer.iconUrl = iconUrl;
    out.footer = footer;
  }
  if (data.fields?.length) {
    out.fields = data.fields.map((field) => ({ name: field.name, value: field.value, inline: Boolean(field.inline) }));
  }
  const image = pictureURL(data.image?.url ?? data.imageUrl, names);
  if (image) out.image = { url: image };
  const thumbnail = pictureURL(data.thumbnail?.url ?? data.thumbnailUrl, names);
  if (thumbnail) out.thumbnail = { url: thumbnail };
  return out;
}

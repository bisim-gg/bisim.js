import type { APIEmbed, APIEmbedField } from '../builders/EmbedBuilder.js';
import type { RawEmbedData } from '../types/raw.js';

/**
 * Converts an embed as Bisim sends it (flat) into discord.js's nested shape.
 *
 * @internal
 */
export function embedFromBisim(data: RawEmbedData): APIEmbed {
  const embed: APIEmbed = {};
  if (data.type) embed.type = data.type;
  if (data.title) embed.title = data.title;
  if (data.description) embed.description = data.description;
  if (data.url) embed.url = data.url;
  if (data.timestamp) embed.timestamp = data.timestamp;
  if (data.color) embed.color = data.color;
  if (data.authorName) {
    embed.author = { name: data.authorName };
    if (data.authorUrl) embed.author.url = data.authorUrl;
    if (data.authorIconUrl) embed.author.icon_url = data.authorIconUrl;
  }
  if (data.footerText) {
    embed.footer = { text: data.footerText };
    if (data.footerIconUrl) embed.footer.icon_url = data.footerIconUrl;
  }
  if (data.imageUrl) {
    embed.image = { url: data.imageUrl };
    if (data.imageWidth) embed.image.width = data.imageWidth;
    if (data.imageHeight) embed.image.height = data.imageHeight;
  }
  if (data.thumbnailUrl) embed.thumbnail = { url: data.thumbnailUrl };
  if (data.siteName) embed.provider = { name: data.siteName };
  if (data.fields?.length) embed.fields = data.fields.map((field) => ({ name: field.name, value: field.value, inline: Boolean(field.inline) }));
  return embed;
}

/**
 * An embed on a message (read only; build one with {@link EmbedBuilder}).
 */
export class Embed {
  /**
   * The embed data, in discord.js's nested shape.
   */
  public readonly data: Readonly<APIEmbed>;

  /**
   * @param data - The embed, in Bisim's flat shape or discord.js's nested shape
   */
  public constructor(data: RawEmbedData | APIEmbed) {
    this.data = 'authorName' in data || 'footerText' in data || 'imageUrl' in data || 'siteName' in data || 'thumbnailUrl' in data
      ? embedFromBisim(data as RawEmbedData)
      : { ...(data as APIEmbed) };
  }

  /** The fields. */
  public get fields(): APIEmbedField[] {
    const { fields } = this.data;
    return fields ?? [];
  }

  /** The title. */
  public get title(): string | null {
    return valueOrNull(this.data.title);
  }

  /** The description. */
  public get description(): string | null {
    return valueOrNull(this.data.description);
  }

  /** The URL the title links to. */
  public get url(): string | null {
    return valueOrNull(this.data.url);
  }

  /** The color. */
  public get color(): number | null {
    return valueOrNull(this.data.color);
  }

  /** The color as `#rrggbb`. */
  public get hexColor(): string | null {
    return typeof this.data.color === 'number' ? `#${this.data.color.toString(16).padStart(6, '0')}` : null;
  }

  /** The timestamp, as an ISO string. */
  public get timestamp(): string | null {
    return valueOrNull(this.data.timestamp);
  }

  /** The thumbnail, the small picture beside the text (Bisim shows it from its own address). */
  public get thumbnail(): { url: string; height?: number; width?: number; proxyURL?: string } | null {
    const { thumbnail } = this.data;
    return thumbnail ? { url: thumbnail.url, height: thumbnail.height, width: thumbnail.width, proxyURL: thumbnail.url } : null;
  }

  /** The large image, or the picture of a link preview. */
  public get image(): { url: string; height?: number; width?: number; proxyURL?: string } | null {
    const { image } = this.data;
    return image ? { url: image.url, height: image.height, width: image.width, proxyURL: image.url } : null;
  }

  /** Always `null` on Bisim. */
  public get video(): { url?: string; height?: number; width?: number } | null {
    return valueOrNull(this.data.video);
  }

  /** The author line. */
  public get author(): { name: string; url?: string; iconURL?: string; proxyIconURL?: string } | null {
    const { author } = this.data;
    return author ? { name: author.name, url: author.url, iconURL: author.icon_url, proxyIconURL: author.icon_url } : null;
  }

  /** The site a link preview came from. */
  public get provider(): { name?: string; url?: string } | null {
    return valueOrNull(this.data.provider);
  }

  /** The footer. */
  public get footer(): { text: string; iconURL?: string; proxyIconURL?: string } | null {
    const { footer } = this.data;
    return footer ? { text: footer.text, iconURL: footer.icon_url, proxyIconURL: footer.icon_url } : null;
  }

  /** The total number of characters in the embed. */
  public get length(): number {
    return (
      (this.data.title?.length ?? 0) +
      (this.data.description?.length ?? 0) +
      (this.data.fields?.reduce((total, field) => total + field.name.length + field.value.length, 0) ?? 0) +
      (this.data.footer?.text.length ?? 0) +
      (this.data.author?.name.length ?? 0)
    );
  }

  /**
   * Whether this embed is the same as another.
   *
   * @param other - The other embed
   */
  public equals(other: Embed | APIEmbed): boolean {
    const data = other instanceof Embed ? other.data : other;
    return JSON.stringify(this.data) === JSON.stringify(data);
  }

  /**
   * The embed as JSON.
   */
  public toJSON(): APIEmbed {
    return { ...this.data };
  }
}

/** `null` in place of a missing value. */
function valueOrNull<Value>(value: Value | undefined): Value | null {
  return value === undefined ? null : value;
}

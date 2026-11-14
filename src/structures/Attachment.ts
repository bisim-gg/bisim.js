import type { RawAttachmentData } from '../types/raw.js';
import { flatten } from '../util/Util.js';

/**
 * A file attached to a message.
 */
export class Attachment {
  /** The file's URL (the same as {@link Attachment.url}). */
  public attachment: string;
  /** The id. */
  public id: string;
  /** The file name. */
  public name: string;
  /** The size in bytes. */
  public size: number;
  /** The file's URL. */
  public url: string;
  /** The same as {@link Attachment.url} (Bisim has no proxy). */
  public proxyURL: string;
  /** The height of an image or video, or `null`. */
  public height: number | null;
  /** The width of an image or video, or `null`. */
  public width: number | null;
  /** The content type. */
  public contentType: string | null;
  /** The alt text. */
  public description: string | null;
  /** Always `false`: ephemeral messages never reach bots on Bisim. */
  public ephemeral: boolean;
  /** How long a voice message plays, in seconds. */
  public duration: number | null;
  /** The waveform of a voice message, base64. */
  public waveform: string | null;
  /** Always `null` on Bisim. */
  public flags: null = null;
  /** Always `null` on Bisim. */
  public title: string | null = null;
  /** Bisim's kind of file: IMAGE, VIDEO, AUDIO or FILE. */
  public kind: string | null;
  /** Whether Bisim's content scanner blocked the file (its URL is then empty). */
  public blocked: boolean;
  /** Whether the file is a video sent as a GIF. */
  public gif: boolean;
  private readonly isSpoiler: boolean;

  /**
   * @param data - The attachment from Bisim
   */
  public constructor(data: RawAttachmentData) {
    this.attachment = data.url;
    this.id = data.id;
    this.name = data.fileName;
    this.size = Number(data.sizeBytes ?? 0);
    this.url = data.url;
    this.proxyURL = data.url;
    this.height = data.height || null;
    this.width = data.width || null;
    this.contentType = data.contentType || null;
    this.description = data.description || null;
    this.ephemeral = false;
    this.duration = data.durationSecs || null;
    this.waveform = data.waveform || null;
    this.kind = data.kind ?? null;
    this.blocked = Boolean(data.blocked);
    this.gif = Boolean(data.gif);
    this.isSpoiler = Boolean(data.spoiler);
  }

  /**
   * Whether the file is shown behind a spoiler.
   */
  public get spoiler(): boolean {
    return this.isSpoiler || this.name.startsWith('SPOILER_');
  }

  /**
   * The attachment as a plain object.
   */
  public toJSON(): unknown {
    return flatten(this);
  }
}

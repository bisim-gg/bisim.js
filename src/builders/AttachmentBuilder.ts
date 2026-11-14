import { basename } from 'node:path';
import type { Readable } from 'node:stream';

/**
 * File data: a Buffer, a path on disk, an `http(s)` URL, or a readable stream.
 */
export type BufferResolvable = Buffer | Uint8Array | ArrayBuffer | string;

/**
 * Data for an {@link AttachmentBuilder}.
 */
export interface AttachmentData {
  /** The name of the file. */
  name?: string;
  /** Alt text for the file. */
  description?: string;
}

/**
 * A file to attach to a message, the discord.js way.
 *
 * @example
 * ```js
 * const file = new AttachmentBuilder('./images/logo.png', { name: 'logo.png' });
 * await channel.send({ files: [file] });
 * ```
 */
export class AttachmentBuilder {
  /** The file data (a Buffer, a path, a URL or a stream). */
  public attachment: BufferResolvable | Readable;
  /** The name of the file. */
  public name: string | undefined;
  /** Alt text for the file. */
  public description: string | undefined;

  /**
   * @param attachment - The file data
   * @param data - The name and description
   */
  public constructor(attachment: BufferResolvable | Readable, data: AttachmentData = {}) {
    this.attachment = attachment;
    const { name, description } = data;
    this.name = name;
    this.description = description;
  }

  /**
   * Sets the alt text.
   *
   * @param description - The description
   */
  public setDescription(description: string): this {
    this.description = description;
    return this;
  }

  /**
   * Sets the file data, and optionally the name.
   *
   * @param attachment - The file data
   * @param name - The name
   */
  public setFile(attachment: BufferResolvable | Readable, name?: string): this {
    this.attachment = attachment;
    if (name !== undefined) this.name = name;
    return this;
  }

  /**
   * Sets the name of the file.
   *
   * @param name - The name
   */
  public setName(name: string): this {
    this.name = name;
    return this;
  }

  /**
   * Sets whether the file is shown behind a spoiler.
   *
   * @param spoiler - Whether it is a spoiler
   */
  public setSpoiler(spoiler = true): this {
    if (spoiler === this.spoiler) return this;
    if (!spoiler) {
      while (this.spoiler) this.name = this.name!.slice('SPOILER_'.length);
      return this;
    }
    this.name = `SPOILER_${this.name ?? 'file'}`;
    return this;
  }

  /**
   * Whether the file is shown behind a spoiler.
   */
  public get spoiler(): boolean {
    return basename(this.name ?? '').startsWith('SPOILER_');
  }

  /**
   * The builder as a plain object.
   */
  public toJSON(): { name: string | undefined; description: string | undefined; spoiler: boolean } {
    return { name: this.name, description: this.description, spoiler: this.spoiler };
  }

  /**
   * Makes a builder from another attachment.
   *
   * @param other - The attachment to copy
   */
  public static from(other: { attachment: BufferResolvable | Readable; name?: string | null; description?: string | null }): AttachmentBuilder {
    return new AttachmentBuilder(other.attachment, { name: other.name ?? undefined, description: other.description ?? undefined });
  }
}

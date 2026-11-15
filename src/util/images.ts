import { basename } from 'node:path';
import type { BufferResolvable } from '../builders/AttachmentBuilder.js';
import { guessContentType } from '../rest/REST.js';
import { MessagePayload } from '../structures/MessagePayload.js';

/**
 * A picture as discord.js takes it for avatars and icons: a Buffer, a path, a URL, or a `data:` URI (base64).
 */
export type ImageResolvable = BufferResolvable | `data:${string}`;

const DATA_URI = /^data:([\w./+-]+)?(;base64)?,(.*)$/s;

/** The picture's kind from its first bytes, for a Buffer that came without a name. */
function sniff(bytes: Buffer): string | null {
  if (bytes.length >= 4 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'png';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpg';
  if (bytes.length >= 4 && bytes.toString('latin1', 0, 4) === 'GIF8') return 'gif';
  if (bytes.length >= 12 && bytes.toString('latin1', 0, 4) === 'RIFF' && bytes.toString('latin1', 8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Reads a picture into a multipart form, under `file`, the way Bisim's picture routes take it.
 *
 * @param image - The picture
 * @param fallbackName - The file name when the picture has none
 * @internal
 */
export async function imageForm(image: ImageResolvable, fallbackName = 'image.png'): Promise<FormData> {
  let bytes: Buffer;
  let name = fallbackName;
  let type: string | undefined;
  const uri = typeof image === 'string' ? DATA_URI.exec(image) : null;
  if (uri) {
    type = uri[1] || 'application/octet-stream';
    bytes = uri[2] ? Buffer.from(uri[3]!, 'base64') : Buffer.from(decodeURIComponent(uri[3]!));
    const extension = type.split('/')[1]?.split('+')[0];
    if (extension) name = `image.${extension === 'jpeg' ? 'jpg' : extension}`;
  } else {
    const raw = await MessagePayload.resolveFile({ attachment: image, name: undefined });
    bytes = raw.data as Buffer;
    if (raw.name && raw.name !== 'file.jpg') name = basename(raw.name);
    else {
      const sniffed = sniff(bytes);
      if (sniffed) name = `image.${sniffed}`;
    }
  }
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(bytes)], { type: type ?? guessContentType(name) }), name);
  return form;
}

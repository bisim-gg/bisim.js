import { createPublicKey, verify } from 'node:crypto';

const ED25519_SPKI_PREFIX = Buffer.from('302a300506032b6570032100', 'hex');

function toBuffer(value: string | Uint8Array | ArrayBuffer | Buffer): Buffer {
  if (Buffer.isBuffer(value)) return value;
  if (typeof value === 'string') return Buffer.from(value, 'utf8');
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
}

/**
 * Checks that an interaction sent to your Interactions URL really came from Bisim: an Ed25519 signature
 * (header `X-Signature-Ed25519`, hex) over the timestamp (header `X-Signature-Timestamp`) followed by the raw
 * body, made with your application's key. Discord's scheme exactly.
 *
 * @param rawBody - The request body exactly as received (string or bytes)
 * @param signature - The `X-Signature-Ed25519` header
 * @param timestamp - The `X-Signature-Timestamp` header
 * @param publicKey - Your application's public key (32 bytes as hex)
 * @returns Whether the signature is valid
 * @example
 * ```js
 * const valid = await verifyKey(rawBody, req.headers['x-signature-ed25519'], req.headers['x-signature-timestamp'], PUBLIC_KEY);
 * if (!valid) return res.writeHead(401).end('bad signature');
 * ```
 */
export async function verifyKey(
  rawBody: string | Uint8Array | ArrayBuffer | Buffer,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  publicKey: string,
): Promise<boolean> {
  return verifyKeySync(rawBody, signature, timestamp, publicKey);
}

/**
 * The synchronous form of {@link verifyKey}.
 *
 * @param rawBody - The request body exactly as received
 * @param signature - The `X-Signature-Ed25519` header
 * @param timestamp - The `X-Signature-Timestamp` header
 * @param publicKey - Your application's public key (hex)
 */
export function verifyKeySync(
  rawBody: string | Uint8Array | ArrayBuffer | Buffer,
  signature: string | null | undefined,
  timestamp: string | null | undefined,
  publicKey: string,
): boolean {
  if (!signature || !timestamp || !publicKey) return false;
  if (!/^[\da-f]+$/i.test(signature) || !/^[\da-f]{64}$/i.test(publicKey)) return false;
  try {
    const key = createPublicKey({
      key: Buffer.concat([ED25519_SPKI_PREFIX, Buffer.from(publicKey, 'hex')]),
      format: 'der',
      type: 'spki',
    });
    const message = Buffer.concat([Buffer.from(timestamp, 'utf8'), toBuffer(rawBody)]);
    return verify(null, message, key, Buffer.from(signature, 'hex'));
  } catch {
    return false;
  }
}

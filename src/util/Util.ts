import { BisimjsError, BisimjsRangeError, BisimjsTypeError, ErrorCodes } from '../errors/index.js';
import { Colors } from './Colors.js';

/**
 * Anything a color can be given as: a number, a `#rrggbb` or `#rgb` string, an `[r, g, b]` triple, a
 * name from {@link Colors}, `'Random'` or `'Default'`.
 */
export type ColorResolvable = keyof typeof Colors | 'Random' | readonly [red: number, green: number, blue: number] | number | `#${string}`;

const WHITE = 0xffffff;

/** The number for a hex string of three or six digits, with or without `#`, or `undefined`. */
function hexToNumber(text: string): number | undefined {
  const digits = text.startsWith('#') ? text.slice(1) : text;
  if (!/^[\da-f]+$/i.test(digits)) return undefined;
  if (digits.length === 6) return Number.parseInt(digits, 16);
  if (digits.length === 3) return Number.parseInt([...digits].map((digit) => digit.repeat(2)).join(''), 16);
  return undefined;
}

/**
 * Turns any {@link ColorResolvable} into the color number embeds and roles use.
 *
 * @param color - The color in any accepted form
 * @throws `BisimjsRangeError` (`ColorRange`) for a number outside 0 to 0xFFFFFF, and `BisimjsTypeError`
 * (`ColorConvert`) for anything that is not a color
 */
export function resolveColor(color: ColorResolvable): number {
  let value: number;
  if (Array.isArray(color)) {
    const [red, green, blue] = color as readonly number[];
    value = (red! << 16) + (green! << 8) + blue!;
  } else if (typeof color !== 'string') {
    value = color as number;
  } else if (color === 'Random') {
    return Math.floor(Math.random() * (WHITE + 1));
  } else if (color === 'Default') {
    return 0;
  } else {
    value = hexToNumber(color) ?? (Colors as Record<string, number>)[color] ?? Number.NaN;
  }
  if (value < 0 || value > WHITE) throw new BisimjsRangeError(ErrorCodes.ColorRange);
  if (typeof value !== 'number' || Number.isNaN(value)) throw new BisimjsTypeError(ErrorCodes.ColorConvert, color);
  return value;
}

/**
 * An emoji read from text: its name, and for a custom emoji its id and whether it moves.
 */
export interface PartialEmoji {
  animated: boolean;
  id: string | undefined;
  name: string;
}

/**
 * Reads an emoji from text. Accepts a plain emoji character (also when percent encoded, as in URLs),
 * `name:id`, `a:name:id`, or a custom emoji token such as `<:name:id>` or `<a:name:id>`.
 *
 * @param text - The emoji as text
 * @returns The emoji, or `null` when text with a colon is not a custom emoji
 */
export function parseEmoji(text: string): PartialEmoji | null {
  const decoded = text.includes('%') ? decodeOrKeep(text) : text;
  if (!decoded.includes(':')) return { animated: false, name: decoded, id: undefined };
  const custom = /<?(?:(a):)?(\w{2,32}):(\d{1,20})>?/.exec(decoded);
  if (!custom) return null;
  const [, animatedMark, name, id] = custom;
  return { animated: animatedMark !== undefined, name: name!, id };
}

function decodeOrKeep(text: string): string {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/**
 * Returns `data` when it is a string (and, if asked, not empty); throws otherwise.
 *
 * @param data - The value to check
 * @param error - The error class to throw
 * @param errorMessage - The message of the error
 * @param allowEmpty - Whether an empty string passes
 */
export function verifyString(
  data: string,
  error: new (message?: string) => Error = Error,
  errorMessage = `Expected a string, got ${String(data)} instead.`,
  allowEmpty = true,
): string {
  const acceptable = typeof data === 'string' && (allowEmpty || data !== '');
  if (!acceptable) throw new error(errorMessage);
  return data;
}

/**
 * Something with a position and an id, sortable by {@link bisimSort}.
 */
export interface Positioned {
  id: string;
  position?: number;
  rawPosition?: number;
}

/**
 * Sorts by position, then by id, the way Bisim's apps order roles and channels.
 *
 * @param collection - The items to sort
 */
export function bisimSort<Key, Value extends Positioned>(
  collection: { sorted(fn: (a: Value, b: Value) => number): Iterable<[Key, Value]> } & Iterable<[Key, Value]>,
): ReturnType<typeof collection.sorted> {
  return collection.sorted((a, b) => {
    const positionA = a.rawPosition ?? a.position ?? 0;
    const positionB = b.rawPosition ?? b.position ?? 0;
    if (positionA !== positionB) return positionA - positionB;
    return Number(BigInt(a.id) - BigInt(b.id));
  });
}

type Plain = Record<string, unknown>;

const isObjectLike = (value: unknown): value is Plain => typeof value === 'object' && value !== null;
const hasMethod = (value: unknown, method: string): boolean => isObjectLike(value) && typeof value[method] === 'function';

/** How one property value is written by {@link flatten}. */
function flattenValue(value: unknown): unknown {
  if (value instanceof Map) return [...value.keys()];
  if (Array.isArray(value)) return value.map((item) => (hasMethod(item, 'toJSON') ? (item as { toJSON(): unknown }).toJSON() : flatten(item)));
  if (!isObjectLike(value)) return value;
  const primitive = hasMethod(value, 'valueOf') ? (value as { valueOf(): unknown }).valueOf() : null;
  if (primitive instanceof Map) return [...primitive.keys()];
  if (typeof primitive !== 'object') return primitive;
  return hasMethod(value, 'toJSON') ? (value as { toJSON(): unknown }).toJSON() : flatten(value);
}

/**
 * A plain copy of an object for `toJSON`: own properties whose names do not start with `_`, maps and
 * collections as lists of their keys, and nested objects flattened the same way.
 *
 * @param obj - The object to copy
 * @param props - Extra rules: `{ name: false }` leaves a property out, `{ name: true }` adds one, and
 * `{ name: 'other' }` writes it under another name
 */
export function flatten(obj: unknown, ...props: Record<string, boolean | string>[]): unknown {
  if (!isObjectLike(obj)) return obj;
  const rules: Record<string, boolean | string> = {};
  for (const key of Object.keys(obj)) {
    if (!key.startsWith('_')) rules[key] = true;
  }
  Object.assign(rules, ...props);
  const copy: Plain = {};
  for (const [key, rule] of Object.entries(rules)) {
    if (!rule) continue;
    copy[rule === true ? key : rule] = flattenValue(obj[key]);
  }
  return copy;
}

/**
 * Breaks up code block fences in text, so it can be put inside a code block.
 *
 * @param text - The text to put in a block
 */
export function cleanCodeBlockContent(text: string): string {
  return text.replaceAll('```', '`​``');
}

/**
 * Something {@link cleanContent} can read names from.
 */
export interface CleanContentChannel {
  client: {
    users: { cache: Map<string, { username: string; displayName?: string }> };
    channels: { cache: Map<string, { name?: string | null }> };
  };
  guild?: {
    members: { cache: Map<string, { displayName: string }> };
    roles: { cache: Map<string, { name: string }> };
  } | null;
}

/**
 * Message content with every mention written as the name it stands for, and `@everyone` and `@here`
 * defused, so it can be shown or logged without pinging anyone. Unknown mentions are left as they are.
 *
 * @param text - The content
 * @param channel - The channel it was sent in, to read names from
 */
export function cleanContent(text: string, channel: CleanContentChannel): string {
  const { client, guild } = channel;
  const nameFor = (kind: string, id: string): string | undefined => {
    if (kind === '#') {
      const target = client.channels.cache.get(id)?.name;
      return target ? `#${target}` : undefined;
    }
    if (kind === '@&') {
      const roleName = guild?.roles.cache.get(id)?.name;
      return roleName === undefined ? undefined : `@${roleName}`;
    }
    const memberName = guild?.members.cache.get(id)?.displayName;
    if (memberName !== undefined) return `@${memberName}`;
    const person = client.users.cache.get(id);
    return person ? `@${person.displayName ?? person.username}` : undefined;
  };
  return text
    .replace(/<(@[!&]?|#)(\d{1,20})>/g, (token, kind: string, id: string) => nameFor(kind, id) ?? token)
    .replace(/@(everyone|here)/g, '@​$1');
}

/**
 * Throws a {@link BisimjsError} saying a feature is not on Bisim.
 *
 * @param feature - What is not supported, as a short phrase
 * @internal
 */
export function notSupported(feature: string): never {
  throw new BisimjsError(ErrorCodes.NotSupported, feature);
}

/**
 * Resolves after a number of milliseconds.
 *
 * @param ms - How long to wait
 * @param unref - Whether the wait may let the process exit
 * @internal
 */
export function sleep(ms: number, unref = false): Promise<void> {
  const { promise, resolve } = deferred();
  const timer = setTimeout(resolve, ms);
  if (unref) timer.unref?.();
  return promise;
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => (resolve = done));
  return { promise, resolve };
}

/**
 * Reads a date-ish value (ISO string, Date, ms number) as a timestamp in ms, or `null`.
 *
 * @internal
 */
export function toTimestamp(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const parsed = Date.parse(String(value));
  return Number.isNaN(parsed) ? null : parsed;
}

/**
 * The CDN address of a stored file key, or `null` when there is no key.
 *
 * @internal
 */
export function cdnURL(cdn: string, key: string | null | undefined, size?: number): string | null {
  if (!key) return null;
  if (/^https?:\/\//.test(key)) return key;
  const base = `${cdn.replace(/\/+$/, '')}/${key.replace(/^\/+/, '')}`;
  return size ? `${base}?width=${size}&height=${size}` : base;
}

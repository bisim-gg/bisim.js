import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';
import { Readable } from 'node:stream';
import type { AttachmentBuilder, BufferResolvable } from '../builders/AttachmentBuilder.js';
import type { APIEmbed } from '../builders/EmbedBuilder.js';
import { toBisimEmbed } from '../builders/EmbedBuilder.js';
import type { JSONEncodable } from '../builders/components.js';
import { BisimjsError, BisimjsTypeError, ErrorCodes } from '../errors/index.js';
import type { RawFile } from '../rest/types.js';
import type { RawComponentData } from '../types/raw.js';
import { MessageFlags } from '../util/Enums.js';
import { MessageFlagsBitField, type MessageFlagsString } from '../util/IntentsBitField.js';
import { toBisimComponent } from '../util/Transformers.js';
import type { BitFieldResolvable } from '../util/BitField.js';
import { type PollData, pollToBisim } from './Poll.js';
import type { Attachment } from './Attachment.js';

/**
 * Which mentions in a message ping, Discord's `allowed_mentions`. Left out, every mention in the text pings; given,
 * only what it names does, so `{ parse: [] }` pings nobody. A mention that may not ping stays in the text as plain
 * words. The client's `allowedMentions` option is the default for every message.
 */
export interface MessageMentionOptions {
  /** The kinds that may ping: `users` (anyone named), `roles` (any role named) and `everyone` (`@everyone` and `@here`). */
  parse?: readonly ('everyone' | 'roles' | 'users')[];
  /** Roles that may be pinged (up to 100). */
  roles?: readonly string[];
  /** People who may be pinged (up to 100). */
  users?: readonly string[];
  /** Accepted for compatibility: a reply pings nobody on Bisim. */
  repliedUser?: boolean;
}

/**
 * A file a message already has, to keep it in an edit: the {@link Attachment}, `{ id }` or its id.
 */
export type AttachmentKeepResolvable = Attachment | { id: string; name?: string | null } | string;

/**
 * A file to attach: an {@link AttachmentBuilder}, an object with the data and a name, a Buffer, a path, a URL
 * or a stream.
 */
export type AttachmentPayload =
  | AttachmentBuilder
  | { attachment: BufferResolvable | Readable; name?: string; description?: string }
  | RawFile
  | BufferResolvable
  | Readable;

/**
 * A message to reply to.
 */
export interface ReplyOptions {
  /** The message (or its id). */
  messageReference: { id: string } | string;
  /** Whether to fail when the message no longer exists (Bisim then sends without the reply). */
  failIfNotExists?: boolean;
}

/**
 * What every message can carry.
 */
export interface BaseMessageOptions {
  /** The text, up to 4000 characters. */
  content?: string | null;
  /** Embeds, as builders or JSON. */
  embeds?: readonly (APIEmbed | JSONEncodable<APIEmbed>)[];
  /** Rows of buttons and select menus, as builders or JSON (bots only). */
  components?: readonly (JSONEncodable<RawComponentData> | RawComponentData | Record<string, unknown>)[];
  /** Files to attach. */
  files?: readonly AttachmentPayload[];
  /** Which mentions ping (the client's `allowedMentions` when left out). */
  allowedMentions?: MessageMentionOptions;
}

/**
 * Options for sending a message to a channel.
 */
export interface MessageCreateOptions extends BaseMessageOptions {
  /** Not on Bisim: text to speech. */
  tts?: boolean;
  /** A nonce Bisim echoes back on the message. */
  nonce?: string | number;
  /** Accepted for compatibility. */
  enforceNonce?: boolean;
  /** The message to reply to. */
  reply?: ReplyOptions;
  /** A sticker to send (Bisim sends a sticker as a message of its own). */
  stickers?: readonly ({ id: string } | string)[];
  /** Message flags: `SuppressEmbeds` and `SuppressNotifications` (a silent message). */
  flags?: BitFieldResolvable<MessageFlagsString, number>;
  /** A poll. */
  poll?: PollData | JSONEncodable<PollData>;
}

/**
 * Options for replying to a message.
 */
export interface MessageReplyOptions extends Omit<MessageCreateOptions, 'reply'> {
  /** Whether to fail when the message no longer exists. */
  failIfNotExists?: boolean;
}

/**
 * Options for editing a message. As on Discord, `attachments` is the whole list of files the message keeps and
 * `files` adds new ones; with neither, every file stays, and with `files` alone the old files are replaced.
 */
export interface MessageEditOptions extends Omit<BaseMessageOptions, 'files'> {
  /** New files to add. */
  files?: readonly AttachmentPayload[];
  /** The files the message keeps (`[]` removes them all). */
  attachments?: readonly AttachmentKeepResolvable[];
  /** Message flags: an edit changes `SuppressEmbeds` only. */
  flags?: BitFieldResolvable<MessageFlagsString, number>;
}

/**
 * Options for replying to an interaction.
 */
export interface InteractionReplyOptions extends BaseMessageOptions {
  /** Not on Bisim: text to speech. */
  tts?: boolean;
  /** Whether only the person who ran the command sees the reply (the same as `flags: MessageFlags.Ephemeral`). */
  ephemeral?: boolean;
  /** Whether to resolve with the reply message. */
  fetchReply?: boolean;
  /** Whether to resolve with an {@link InteractionCallbackResponse}. */
  withResponse?: boolean;
  /** Message flags: `Ephemeral`, `SuppressEmbeds` and `SuppressNotifications`. */
  flags?: BitFieldResolvable<MessageFlagsString, number>;
  /** A poll, sent on its own (no text, embeds, files or components with it) and never ephemeral. */
  poll?: PollData | JSONEncodable<PollData>;
}

/**
 * Options for updating the message a component sits on.
 */
export interface InteractionUpdateOptions extends MessageEditOptions {
  fetchReply?: boolean;
  withResponse?: boolean;
}

/**
 * Options for editing an interaction's reply.
 */
export interface InteractionEditReplyOptions extends MessageEditOptions {
  /** Which message to edit: the reply (`@original`, the default) or a followup's id. */
  message?: { id: string } | string;
}

/**
 * Options for sending through a webhook.
 */
export interface WebhookMessageCreateOptions extends BaseMessageOptions {
  /** The name to post under, for this message only. */
  username?: string;
  /** Not on Bisim: per message avatars. */
  avatarURL?: string;
  /** Not on Bisim: threads. */
  threadId?: string;
  /** Not on Bisim: threads. */
  threadName?: string;
  /** Not on Bisim: text to speech. */
  tts?: boolean;
  /** Message flags: `SuppressEmbeds` and `SuppressNotifications`. */
  flags?: BitFieldResolvable<MessageFlagsString, number>;
}

/**
 * Options for editing a message a webhook posted.
 */
export interface WebhookMessageEditOptions extends MessageEditOptions {
  /** Not on Bisim: threads. */
  threadId?: string;
  /** Accepted for compatibility. */
  withComponents?: boolean;
}

/**
 * What a payload is for, which decides what Bisim accepts.
 */
export type PayloadKind = 'message' | 'edit' | 'interaction' | 'webhook';

const warned = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (warned.has(key)) return;
  warned.add(key);
  process.emitWarning(message, { code: 'BISIMJS_UNSUPPORTED_OPTION', type: 'BisimjsWarning' });
}

/**
 * The target a payload is sent to: a channel, a message, an interaction or a webhook.
 */
export interface MessageTarget {
  readonly id?: string;
}

/**
 * Turns message options (the discord.js shape) into the body and files Bisim's routes take.
 */
export class MessagePayload {
  /** What the payload is sent to. */
  public target: MessageTarget;
  /** The options. */
  public options: Record<string, unknown>;
  /** The body, once {@link MessagePayload.resolveBody} ran. */
  public body: Record<string, unknown> | null = null;
  /** The files, once {@link MessagePayload.resolveFiles} ran. */
  public files: RawFile[] | null = null;
  /** What the payload is for. */
  public kind: PayloadKind;
  /**
   * The files the edited message has now, when known: an edit that leaves `attachments` out keeps them, and an
   * embed may show one of them with `attachment://name`. `null` when the message is not known.
   */
  public existingAttachments: readonly { id: string; name: string }[] | null = null;

  /**
   * @param target - What the payload is sent to
   * @param options - The options
   * @param kind - What the payload is for
   */
  public constructor(target: MessageTarget, options: Record<string, unknown>, kind: PayloadKind = 'message') {
    this.target = target;
    this.options = options;
    this.kind = kind;
  }

  /**
   * Makes a payload from a string or options.
   *
   * @param target - What the payload is sent to
   * @param options - The text or the options
   * @param extra - Options to add
   */
  public static create(
    target: MessageTarget,
    options: string | MessagePayload | Record<string, unknown>,
    extra: Record<string, unknown> = {},
    kind: PayloadKind = 'message',
  ): MessagePayload {
    if (options instanceof MessagePayload) {
      options.options = { ...options.options, ...extra };
      options.kind = kind;
      return options;
    }
    const resolved = typeof options === 'string' ? { content: options } : { ...options };
    return new MessagePayload(target, { ...resolved, ...extra }, kind);
  }

  /**
   * The message flags the options name.
   */
  public resolveFlags(): number {
    const { flags, ephemeral } = this.options as { flags?: BitFieldResolvable<MessageFlagsString, number>; ephemeral?: boolean };
    let value = flags === undefined || flags === null ? 0 : new MessageFlagsBitField(flags).bitfield;
    if (ephemeral) value |= MessageFlags.Ephemeral;
    return value;
  }

  /**
   * Builds the JSON body.
   */
  public resolveBody(): this {
    const options = this.options as MessageCreateOptions & InteractionReplyOptions & WebhookMessageCreateOptions & MessageEditOptions;
    const body: Record<string, unknown> = {};

    if (options.content !== undefined && options.content !== null) {
      if (typeof options.content !== 'string') {
        if (typeof options.content === 'number' || typeof options.content === 'bigint') body.content = String(options.content);
        else throw new BisimjsTypeError(ErrorCodes.MessageContentType);
      } else body.content = options.content;
    } else if (options.content === null && this.kind === 'edit') {
      body.content = '';
    }

    if (options.stickers?.length) {
      const sticker = options.stickers[0]!;
      body.content = `<sticker:${typeof sticker === 'string' ? sticker : sticker.id}>`;
    }

    if (options.embeds !== undefined) {
      const attachmentNames = this.attachmentNames();
      body.embeds = options.embeds.map((embed) => toBisimEmbed(embed, { attachmentNames }));
    }
    if (options.components !== undefined) body.components = options.components.map((component) => toBisimComponent(component));

    if (options.tts) warnOnce('tts', 'Text to speech messages are not supported on Bisim: tts is ignored.');
    const allowedMentions = options.allowedMentions === undefined ? this.defaultAllowedMentions() : options.allowedMentions;
    if (allowedMentions) body.allowedMentions = toBisimAllowedMentions(allowedMentions);

    if (this.kind === 'message') {
      if (options.nonce !== undefined) body.nonce = String(options.nonce);
      if (options.reply?.messageReference) {
        const reference = options.reply.messageReference;
        body.referencedMessageId = typeof reference === 'string' ? reference : reference.id;
      }
      if (options.poll) body.poll = pollToBisim(options.poll);
      const flags = this.resolveFlags();
      if (flags) body.flags = flags;
    }

    if (this.kind === 'interaction') {
      const flags = this.resolveFlags();
      if (flags) body.flags = flags;
      if (options.poll) body.poll = pollToBisim(options.poll);
    }

    if (this.kind === 'edit') {
      if (options.attachments !== undefined) body.attachments = options.attachments.map((attachment) => ({ id: keptAttachmentId(attachment) }));
      else if (options.files?.length) body.attachments = [];
      // An edit changes one flag, SuppressEmbeds; `0` takes it off.
      if (options.flags !== undefined && options.flags !== null) body.flags = this.resolveFlags() & MessageFlags.SuppressEmbeds;
      if ((options as { threadId?: string }).threadId) throw new BisimjsError(ErrorCodes.NotSupported, 'Threads');
    }

    if (this.kind === 'webhook') {
      if (options.username) body.username = options.username;
      if (options.avatarURL) warnOnce('avatarURL', 'Per message webhook avatars are not supported on Bisim: avatarURL is ignored.');
      if (options.threadId || options.threadName) throw new BisimjsError(ErrorCodes.NotSupported, 'Threads');
      if (options.components?.length) throw new BisimjsError(ErrorCodes.NotSupported, 'Components in webhook messages');
      if (options.poll) throw new BisimjsError(ErrorCodes.NotSupported, 'Polls in webhook messages');
      const flags = this.resolveFlags();
      if (flags) body.flags = flags;
    }

    this.body = body;
    return this;
  }

  /**
   * The client's `allowedMentions` option (or a webhook client's), the default for every message.
   */
  private defaultAllowedMentions(): MessageMentionOptions | undefined {
    const target = this.target as { client?: { options?: { allowedMentions?: MessageMentionOptions } }; options?: { allowedMentions?: unknown } };
    const fromClient = target.client?.options?.allowedMentions;
    if (fromClient) return fromClient;
    const own = target.options?.allowedMentions;
    return own && typeof own === 'object' ? (own as MessageMentionOptions) : undefined;
  }

  /**
   * The names an embed's `attachment://` may use: the new files' and the kept files'. `null` when an edit keeps
   * files bisim.js does not know, so the server decides.
   */
  private attachmentNames(): ReadonlySet<string> | null {
    const options = this.options as MessageEditOptions;
    const names = new Set<string>();
    for (const file of options.files ?? []) names.add(MessagePayload.fileName(file));
    if (this.kind !== 'edit') return names;
    const existing = this.existingAttachments;
    if (options.attachments === undefined) {
      if (existing === null) return null;
      for (const attachment of existing) names.add(attachment.name);
      return names;
    }
    for (const kept of options.attachments) {
      const id = keptAttachmentId(kept);
      const name = typeof kept === 'object' && kept.name ? kept.name : existing?.find((attachment) => attachment.id === id)?.name;
      if (!name) return null;
      names.add(name);
    }
    return names;
  }

  /**
   * Reads the files into memory.
   */
  public async resolveFiles(): Promise<this> {
    const files = (this.options as BaseMessageOptions).files;
    if (!files?.length) {
      this.files = [];
      return this;
    }
    this.files = await Promise.all(files.map((file) => MessagePayload.resolveFile(file)));
    return this;
  }

  /**
   * The name a file is sent under (what `attachment://name` refers to), without reading it.
   *
   * @param file - The file
   */
  public static fileName(file: AttachmentPayload): string {
    if (file && typeof file === 'object' && 'data' in file && 'name' in file && !(file instanceof Readable)) return (file as RawFile).name;
    if (file && typeof file === 'object' && 'attachment' in file && !(file instanceof Readable) && !Buffer.isBuffer(file)) {
      const payload = file as { attachment: BufferResolvable | Readable; name?: string | null };
      return payload.name ?? findName(payload.attachment) ?? 'file.jpg';
    }
    return findName(file) ?? 'file.jpg';
  }

  /**
   * Reads one file into memory.
   *
   * @param file - The file
   */
  public static async resolveFile(file: AttachmentPayload): Promise<RawFile> {
    if (file && typeof file === 'object' && 'data' in file && 'name' in file && !(file instanceof Readable)) {
      return file as RawFile;
    }
    let attachment: BufferResolvable | Readable;
    let name: string | undefined;
    let description: string | undefined;
    if (file && typeof file === 'object' && 'attachment' in file && !(file instanceof Readable) && !Buffer.isBuffer(file)) {
      const payload = file as { attachment: BufferResolvable | Readable; name?: string | null; description?: string | null; spoiler?: boolean };
      attachment = payload.attachment;
      name = payload.name ?? undefined;
      description = payload.description ?? undefined;
    } else {
      attachment = file as BufferResolvable | Readable;
    }
    const data = await resolveData(attachment);
    name ??= findName(attachment) ?? 'file.jpg';
    const raw: RawFile = { name, data };
    if (description) raw.description = description;
    return raw;
  }
}

/** The id of a file an edit keeps. */
function keptAttachmentId(attachment: AttachmentKeepResolvable): string {
  if (typeof attachment === 'string') return attachment;
  if (attachment && typeof attachment.id === 'string') return attachment.id;
  throw new BisimjsTypeError(ErrorCodes.InvalidType, 'attachments', 'list of attachments or their ids');
}

/**
 * `allowedMentions` as Bisim takes it (the same fields, camelCase; Discord's `replied_user` is read too).
 *
 * @param allowed - The option
 * @internal
 */
export function toBisimAllowedMentions(allowed: MessageMentionOptions): Record<string, unknown> {
  const raw = allowed as MessageMentionOptions & { replied_user?: boolean };
  const ids = (list: readonly (string | { id: string })[]) => [...new Set(list.map((entry) => (typeof entry === 'string' ? entry : entry.id)))];
  const out: Record<string, unknown> = {};
  if (raw.parse !== undefined && raw.parse !== null) out.parse = [...new Set(raw.parse)];
  if (raw.users !== undefined && raw.users !== null) out.users = ids(raw.users);
  if (raw.roles !== undefined && raw.roles !== null) out.roles = ids(raw.roles);
  const repliedUser = raw.repliedUser ?? raw.replied_user;
  if (typeof repliedUser === 'boolean') out.repliedUser = repliedUser;
  return out;
}

function findName(attachment: unknown): string | undefined {
  if (typeof attachment === 'string') {
    const clean = attachment.split(/[?#]/)[0]!;
    const name = basename(clean);
    return name || undefined;
  }
  const path = (attachment as { path?: unknown })?.path;
  if (typeof path === 'string') return basename(path);
  return undefined;
}

async function resolveData(attachment: BufferResolvable | Readable): Promise<Buffer> {
  if (Buffer.isBuffer(attachment)) return attachment;
  if (attachment instanceof ArrayBuffer) return Buffer.from(attachment);
  if (ArrayBuffer.isView(attachment)) return Buffer.from(attachment.buffer, attachment.byteOffset, attachment.byteLength);
  if (typeof attachment === 'string') {
    if (/^https?:\/\//i.test(attachment)) {
      const res = await fetch(attachment);
      if (!res.ok) throw new BisimjsError(ErrorCodes.FileNotFound, attachment);
      return Buffer.from(await res.arrayBuffer());
    }
    try {
      return await readFile(attachment);
    } catch {
      throw new BisimjsError(ErrorCodes.FileNotFound, attachment);
    }
  }
  if (attachment && typeof (attachment as Readable).pipe === 'function') {
    const chunks: Buffer[] = [];
    for await (const chunk of attachment as Readable) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw new BisimjsTypeError(ErrorCodes.ReqResourceType);
}

import { BisimjsTypeError, ErrorCodes } from '../errors/index.js';
import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { TextBasedChannel } from '../structures/channels/index.js';
import { Emoji, emojiFromBisim } from '../structures/Emoji.js';
import { Message } from '../structures/Message.js';
import { type MessageEditOptions, MessagePayload } from '../structures/MessagePayload.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import type { RawMessageData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { CachedManager } from './BaseManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * A message, by structure or id.
 */
export type MessageResolvable = Message | string;

/**
 * An emoji to react with: Unicode characters, a custom emoji token `<:name:id>`, `name:id`, a custom
 * emoji's id, or an emoji structure.
 */
export type EmojiIdentifierResolvable = string | Emoji | { id?: string | null; name?: string | null; animated?: boolean | null };

/**
 * Options for fetching one message.
 */
export interface FetchMessageOptions {
  message: MessageResolvable;
  cache?: boolean;
  force?: boolean;
}

/**
 * Options for fetching several messages.
 */
export interface FetchMessagesOptions {
  /** How many, 1 to 100 (50 by default). */
  limit?: number;
  /** Only messages before this id. */
  before?: string;
  /** Only messages after this id. */
  after?: string;
  /** Only messages around this id. */
  around?: string;
  /** Whether to cache them. */
  cache?: boolean;
}

/**
 * Resolves an emoji to the text Bisim's reaction routes take, URL encoded.
 *
 * @param client - The client, to look custom emoji up by id
 * @param emoji - The emoji
 * @internal
 */
export function resolveReactionEmoji(
  client: { emojis: { cache: Map<string, { name: string | null; id: string | null; animated: boolean | null }> } },
  emoji: EmojiIdentifierResolvable,
): string {
  if (emoji instanceof Emoji || (typeof emoji === 'object' && emoji !== null)) {
    const { id, name, animated } = emoji;
    if (id) return encodeURIComponent(`<${animated ? 'a' : ''}:${name ?? '_'}:${id}>`);
    if (name) return encodeURIComponent(name);
    throw new BisimjsTypeError(ErrorCodes.EmojiType);
  }
  if (typeof emoji !== 'string') throw new BisimjsTypeError(ErrorCodes.EmojiType);
  if (/^\d{1,20}$/.test(emoji)) {
    const known = client.emojis.cache.get(emoji);
    if (!known) throw new BisimjsTypeError(ErrorCodes.EmojiType);
    return encodeURIComponent(`<${known.animated ? 'a' : ''}:${known.name}:${known.id}>`);
  }
  const custom = /^<?(a)?:?(\w{2,32}):(\d{1,20})>?$/.exec(emoji);
  if (custom) return encodeURIComponent(`<${custom[1] ? 'a' : ''}:${custom[2]}:${custom[3]}>`);
  return encodeURIComponent(emoji);
}

/**
 * Manages the messages of a channel.
 */
export class MessageManager extends CachedManager<string, Message, MessageResolvable> {
  /** The channel. */
  public declare readonly channel: TextBasedChannel;

  /**
   * @param channel - The channel
   */
  public constructor(channel: TextBasedChannel) {
    super(channel.client);
    attachHidden(this, 'channel', channel);
  }

  /**
   * Adds a message to the cache, or updates the cached one.
   *
   * @internal
   */
  public _add(data: RawMessageData, cache = true): Message {
    const refreshed = this.refreshCached(data.id, data);
    if (refreshed) return refreshed;
    const message = new Message(this.client, data);
    if (cache) {
      this.cache.set(message.id, message);
      const limit = this.client.options.makeCache?.messages ?? 200;
      while (this.cache.size > limit) this.cache.delete(this.cache.firstKey()!);
    }
    return message;
  }

  /**
   * Fetches one message by id, or several with options.
   *
   * @param options - The id, or what to fetch
   * @example
   * ```js
   * const message = await channel.messages.fetch('123');
   * const last50 = await channel.messages.fetch({ limit: 50 });
   * ```
   */
  public fetch(options: MessageResolvable | FetchMessageOptions): Promise<Message>;
  public fetch(options?: FetchMessagesOptions): Promise<Collection<string, Message>>;
  public async fetch(
    options?: MessageResolvable | FetchMessageOptions | FetchMessagesOptions,
  ): Promise<Message | Collection<string, Message>> {
    if (!options) return this.fetchMany();
    if (typeof options === 'string' || options instanceof Message) return this.fetchSingle(options, true, false);
    if ('message' in options) return this.fetchSingle(options.message, options.cache ?? true, options.force ?? false);
    return this.fetchMany(options as FetchMessagesOptions);
  }

  private async fetchSingle(message: MessageResolvable, cache: boolean, force: boolean): Promise<Message> {
    const id = typeof message === 'string' ? message : message.id;
    if (!force) {
      const cached = this.fromCache(id);
      if (cached) return cached;
    }
    let data: RawMessageData;
    try {
      data = (await this.client.rest.get(Routes.channelMessage(this.channel.id, id))) as RawMessageData;
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
      const around = (await this.client.rest.get(Routes.channelMessages(this.channel.id), { query: { around: id, limit: 1 } })) as RawMessageData[];
      const found = around.find((entry) => entry.id === id);
      if (!found) throw error;
      data = found;
    }
    return this._add(data, cache);
  }

  private async fetchMany(options: FetchMessagesOptions = {}): Promise<Collection<string, Message>> {
    const data = (await this.client.rest.get(Routes.channelMessages(this.channel.id), {
      query: { limit: options.limit ?? 50, before: options.before, after: options.after, around: options.around },
    })) as RawMessageData[];
    const messages = new Collection<string, Message>();
    for (const raw of data) {
      const message = this._add(raw, options.cache ?? true);
      messages.set(message.id, message);
    }
    return messages.sort((a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : BigInt(b.id) < BigInt(a.id) ? -1 : 0));
  }

  /**
   * Fetches the pinned messages of the channel.
   *
   * @param cache - Whether to cache them
   */
  public async fetchPinned(cache = true): Promise<Collection<string, Message>> {
    const data = (await this.client.rest.get(Routes.channelPins(this.channel.id))) as RawMessageData[];
    const messages = new Collection<string, Message>();
    for (const raw of data) {
      const message = this._add(raw, cache);
      messages.set(message.id, message);
    }
    return messages;
  }

  /**
   * Edits a message the bot wrote.
   *
   * @param message - The message
   * @param options - The new content
   */
  public async edit(message: MessageResolvable, options: string | MessagePayload | MessageEditOptions): Promise<Message> {
    const id = typeof message === 'string' ? message : message.id;
    const payload = MessagePayload.create(this.channel, options as Record<string, unknown>, {}, 'edit');
    payload.resolveBody();
    await payload.resolveFiles();
    const data = (await this.client.rest.patch(Routes.channelMessage(this.channel.id, id), { body: payload.body })) as RawMessageData;
    return this._add(data);
  }

  /**
   * Deletes a message.
   *
   * @param message - The message
   */
  public async delete(message: MessageResolvable): Promise<void> {
    const id = typeof message === 'string' ? message : message.id;
    await this.client.rest.delete(Routes.channelMessage(this.channel.id, id));
    const cached = this.cache.get(id);
    if (cached) cached.deleted = true;
    this.cache.delete(id);
  }

  /**
   * Reacts to a message.
   *
   * @param message - The message
   * @param emoji - The emoji
   */
  public async react(message: MessageResolvable, emoji: EmojiIdentifierResolvable): Promise<MessageReaction> {
    const id = typeof message === 'string' ? message : message.id;
    const encoded = resolveReactionEmoji(this.client, emoji);
    await this.client.rest.put(Routes.channelMessageOwnReaction(this.channel.id, id, encoded));
    const text = decodeURIComponent(encoded);
    const target = typeof message === 'string' ? (this.cache.get(id) ?? this._add({ id, channelId: this.channel.id } as RawMessageData, false)) : message;
    const parsed = emojiFromBisim(text);
    const existing = target.reactions.cache.get(parsed.id ?? parsed.name);
    if (existing) {
      if (!existing.me) existing._add(this.client.user);
      return existing;
    }
    const reaction = target.reactions._add({ emoji: text, count: 1, me: true });
    reaction.users.cache.set(this.client.user.id, this.client.user);
    return reaction;
  }

  /**
   * Pins a message.
   *
   * @param message - The message
   * @param reason - Why
   */
  public async pin(message: MessageResolvable, reason?: string): Promise<void> {
    const id = typeof message === 'string' ? message : message.id;
    await this.client.rest.put(Routes.channelPin(this.channel.id, id), { reason });
  }

  /**
   * Unpins a message.
   *
   * @param message - The message
   * @param reason - Why
   */
  public async unpin(message: MessageResolvable, reason?: string): Promise<void> {
    const id = typeof message === 'string' ? message : message.id;
    await this.client.rest.delete(Routes.channelPin(this.channel.id, id), { reason });
  }
}

import type { Client } from '../client/Client.js';
import { ReactionUserManager } from '../managers/ReactionUserManager.js';
import type { RawReactionData } from '../types/raw.js';
import { notSupported } from '../util/Util.js';
import { type GuildEmoji, ReactionEmoji, emojiFromBisim } from './Emoji.js';
import type { Message } from './Message.js';
import type { User } from './User.js';
import { attachHidden } from '../util/internal.js';

/**
 * A reaction on a message: one emoji, how many reacted with it, and whether the bot did.
 */
export class MessageReaction {
  /** The client. */
  public declare readonly client: Client<true>;
  /** The message. */
  public declare readonly message: Message;
  /** Whether the bot reacted with this emoji. */
  public me: boolean;
  /** How many reacted with this emoji. */
  public count: number;
  /** Always `false` on Bisim (no super reactions). */
  public meBurst = false;
  /** Always empty on Bisim. */
  public burstColors: string[] = [];
  /** The counts by kind (Bisim has normal reactions only). */
  public countDetails: { burst: number; normal: number };
  /** The users who reacted (fetch them with `users.fetch()`). */
  public readonly users: ReactionUserManager;
  /**
   * Bisim's text for the emoji: the Unicode characters or `<:name:id>`.
   *
   * @internal
   */
  public readonly _emojiText: string;
  private readonly _emoji: ReactionEmoji;

  /**
   * @param client - The client
   * @param data - The reaction from Bisim
   * @param message - The message
   */
  public constructor(client: Client, data: RawReactionData, message: Message) {
    attachHidden(this, 'client', client);
    attachHidden(this, 'message', message);
    this._emojiText = data.emoji;
    this.me = Boolean(data.me);
    this.count = data.count ?? 0;
    this.countDetails = { burst: 0, normal: this.count };
    this._emoji = new ReactionEmoji(this, emojiFromBisim(data.emoji));
    this.users = new ReactionUserManager(this);
  }

  /**
   * The key the reaction is cached under: the custom emoji's id, or the Unicode characters.
   */
  public get key(): string {
    return this._emoji.id ?? this._emoji.name ?? this._emojiText;
  }

  /**
   * The emoji: the server's {@link GuildEmoji} when it is cached, otherwise a {@link ReactionEmoji}.
   */
  public get emoji(): GuildEmoji | ReactionEmoji {
    if (this._emoji.id) {
      const known = this.client.emojis.cache.get(this._emoji.id);
      if (known) return known;
    }
    return this._emoji;
  }

  /**
   * Whether this reaction is partial.
   */
  public get partial(): boolean {
    return false;
  }

  /**
   * Not on Bisim: removing every reaction of one emoji. Use `message.reactions.removeAll()` or
   * `reaction.users.remove(user)`.
   */
  public remove(): Promise<MessageReaction> {
    return notSupported('Removing every reaction of one emoji');
  }

  /**
   * Refetches the message and returns this reaction as it is now.
   */
  public async fetch(): Promise<MessageReaction> {
    const message = await this.message.fetch(true);
    return message.reactions.cache.get(this.key) ?? this;
  }

  /**
   * Counts a user's reaction (from an event).
   *
   * @internal
   */
  public _add(user: User | { id: string }): void {
    const isMe = user.id === this.client.user?.id;
    if (this.users.cache.has(user.id) || (isMe && this.me && this.count > 0)) return;
    if (isMe) this.me = true;
    if ('username' in user) this.users.cache.set(user.id, user as User);
    this.count++;
    this.countDetails.normal = this.count;
  }

  /**
   * Uncounts a user's reaction (from an event).
   *
   * @internal
   */
  public _remove(user: User | { id: string }): void {
    if (user.id === this.client.user?.id) this.me = false;
    this.users.cache.delete(user.id);
    this.count = Math.max(0, this.count - 1);
    this.countDetails.normal = this.count;
  }

  /**
   * The reaction as a plain object.
   */
  public toJSON(): unknown {
    return { emoji: this._emojiText, count: this.count, me: this.me, messageId: this.message.id };
  }
}

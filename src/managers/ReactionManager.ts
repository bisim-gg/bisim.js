import { Routes } from '../rest/Routes.js';
import type { Message } from '../structures/Message.js';
import { MessageReaction } from '../structures/MessageReaction.js';
import { emojiFromBisim } from '../structures/Emoji.js';
import type { RawReactionData } from '../types/raw.js';
import { CachedManager } from './BaseManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * A reaction, by structure, emoji id or Unicode characters.
 */
export type MessageReactionResolvable = MessageReaction | string;

/**
 * Manages the reactions of a message.
 */
export class ReactionManager extends CachedManager<string, MessageReaction, MessageReactionResolvable> {
  /** The message. */
  public declare readonly message: Message;

  /**
   * @param message - The message
   */
  public constructor(message: Message) {
    super(message.client);
    attachHidden(this, 'message', message);
  }

  /**
   * Adds a reaction to the cache.
   *
   * @internal
   */
  public _add(data: RawReactionData): MessageReaction {
    const parsed = emojiFromBisim(data.emoji);
    const key = parsed.id ?? parsed.name;
    const existing = this.cache.get(key);
    if (existing) {
      existing.count = data.count;
      existing.countDetails.normal = data.count;
      existing.me = Boolean(data.me);
      return existing;
    }
    const reaction = new MessageReaction(this.client, data, this.message);
    this.cache.set(key, reaction);
    return reaction;
  }

  /**
   * Resolves a reaction from its emoji text, id or structure.
   *
   * @param reaction - The reaction
   */
  public override resolve(reaction: MessageReactionResolvable): MessageReaction | null {
    if (reaction instanceof MessageReaction) return reaction;
    if (this.cache.has(reaction)) return this.cache.get(reaction)!;
    const parsed = emojiFromBisim(reaction);
    return this.cache.get(parsed.id ?? parsed.name) ?? null;
  }

  /**
   * Removes every reaction from the message (needs Manage Messages).
   */
  public async removeAll(): Promise<Message> {
    await this.client.rest.delete(Routes.channelMessageAllReactions(this.message.channelId, this.message.id));
    this.cache.clear();
    return this.message;
  }
}

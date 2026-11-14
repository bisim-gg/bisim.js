import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { Routes } from '../rest/Routes.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import type { User } from '../structures/User.js';
import type { RawUserData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { CachedManager } from './BaseManager.js';
import { attachHidden } from '../util/internal.js';

/**
 * Options for {@link ReactionUserManager.fetch}.
 */
export interface FetchReactionUsersOptions {
  /** How many users, at most 100. */
  limit?: number;
  /** Only users after this id. */
  after?: string;
}

/**
 * Manages the users who reacted with one emoji.
 */
export class ReactionUserManager extends CachedManager<string, User, User | string> {
  /** The reaction. */
  public declare readonly reaction: MessageReaction;

  /**
   * @param reaction - The reaction
   */
  public constructor(reaction: MessageReaction) {
    super(reaction.client);
    attachHidden(this, 'reaction', reaction);
  }

  private get emojiParam(): string {
    return encodeURIComponent(this.reaction._emojiText);
  }

  /**
   * Fetches who reacted with this emoji.
   *
   * @param options - How many, and after whom
   */
  public async fetch(options: FetchReactionUsersOptions = {}): Promise<Collection<string, User>> {
    const { channelId, id: messageId } = this.reaction.message;
    const route = Routes.channelMessageReaction(channelId, messageId, this.emojiParam);
    const query = { limit: options.limit ?? 100, after: options.after };
    const data = (await this.client.rest.get(route, { query })) as RawUserData[];
    const reactors = new Collection(data.map((raw) => [raw.id, this.client.users._add(raw)] as const));
    for (const [id, reactor] of reactors) this.cache.set(id, reactor);
    return reactors;
  }

  /**
   * Removes a user's reaction: the bot's own by default, or someone else's (needs Manage Messages).
   *
   * @param user - Whose reaction
   */
  public async remove(user: User | string = this.client.user): Promise<MessageReaction> {
    const whose = typeof user === 'string' ? user : user?.id;
    if (!whose) throw new BisimjsError(ErrorCodes.ReactionResolveUser);
    const { channelId, id: messageId } = this.reaction.message;
    const own = whose === this.client.user.id;
    const target = own
      ? Routes.channelMessageOwnReaction(channelId, messageId, this.emojiParam)
      : Routes.channelMessageUserReaction(channelId, messageId, this.emojiParam, whose);
    await this.client.rest.delete(target);
    return this.reaction;
  }
}

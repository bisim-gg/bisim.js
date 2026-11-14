import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { Routes } from '../rest/Routes.js';
import type { RawMessageData, RawPollData, RawUserData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { toTimestamp } from '../util/Util.js';
import { Base } from './Base.js';
import { Emoji, emojiFromBisim } from './Emoji.js';
import type { Message } from './Message.js';
import type { User } from './User.js';
import { attachHidden } from '../util/internal.js';

/**
 * A poll's answer as a bot sends it.
 */
export interface PollAnswerData {
  text: string;
  emoji?: string;
}

/**
 * A poll as a bot sends it, discord.js's shape.
 */
export interface PollData {
  question: { text: string } | string;
  answers: readonly PollAnswerData[];
  /** How long the poll runs, in hours (1 to 768). */
  duration: number;
  allowMultiselect: boolean;
  /** Accepted for compatibility. */
  layoutType?: number;
}

/**
 * Converts discord.js's poll data to Bisim's.
 *
 * @internal
 */
export function pollToBisim(poll: PollData | { toJSON(): PollData }): Record<string, unknown> {
  const data = typeof (poll as { toJSON?: unknown }).toJSON === 'function' ? (poll as { toJSON(): PollData }).toJSON() : (poll as PollData);
  const raw = data as PollData & { poll_media?: unknown; allow_multiselect?: boolean };
  const question = typeof raw.question === 'string' ? raw.question : raw.question.text;
  return {
    question,
    answers: raw.answers.map((answer) => {
      const text = (answer as PollAnswerData).text ?? (answer as { poll_media?: { text: string } }).poll_media?.text;
      const emoji = (answer as PollAnswerData).emoji;
      return emoji ? { text, emoji: typeof emoji === 'string' ? emoji : String((emoji as { name?: string }).name ?? '') } : { text };
    }),
    multiselect: Boolean(raw.allowMultiselect ?? raw.allow_multiselect),
    durationHours: raw.duration,
  };
}

/**
 * Manages the voters of one answer.
 */
export class PollAnswerVoterManager {
  /** The answer. */
  public declare readonly answer: PollAnswer;
  /** The voters fetched so far. */
  public readonly cache = new Collection<string, User>();

  /**
   * @param answer - The answer
   */
  public constructor(answer: PollAnswer) {
    attachHidden(this, 'answer', answer);
  }

  /**
   * Fetches who voted for this answer.
   *
   * @param options - How many, and after whom
   */
  public async fetch(options: { after?: string; limit?: number } = {}): Promise<Collection<string, User>> {
    const message = this.answer.poll.message;
    const data = (await message.client.rest.get(Routes.pollAnswerVoters(message.channelId, message.id, this.answer.id), {
      query: { after: options.after, limit: options.limit },
    })) as RawUserData[] | { users: RawUserData[] };
    const list = Array.isArray(data) ? data : (data?.users ?? []);
    const users = new Collection<string, User>();
    for (const raw of list) {
      const user = message.client.users._add(raw);
      users.set(user.id, user);
      this.cache.set(user.id, user);
    }
    return users;
  }
}

/**
 * One answer of a poll.
 */
export class PollAnswer extends Base {
  /** The poll. */
  public declare readonly poll: Poll;
  /** The id of the answer. */
  public id: number;
  /** The text. */
  public text: string | null;
  /** How many voted for it. */
  public voteCount: number;
  /** Who voted for it. */
  public readonly voters: PollAnswerVoterManager;
  private readonly emojiText: string | null;

  /**
   * @param client - The client
   * @param data - The answer and its count
   * @param poll - The poll
   */
  public constructor(client: Client, data: { id: number; text: string; emoji?: string | null; count?: number }, poll: Poll) {
    super(client);
    attachHidden(this, 'poll', poll);
    this.id = data.id;
    this.text = data.text ?? null;
    this.emojiText = data.emoji || null;
    this.voteCount = data.count ?? 0;
    this.voters = new PollAnswerVoterManager(this);
  }

  /**
   * The emoji of the answer, or `null`.
   */
  public get emoji(): Emoji | null {
    return this.emojiText ? new Emoji(this.client, emojiFromBisim(this.emojiText)) : null;
  }

  /**
   * Fetches who voted for this answer.
   *
   * @deprecated Use `answer.voters.fetch()`
   */
  public fetchVoters(options?: { after?: string; limit?: number }): Promise<Collection<string, User>> {
    return this.voters.fetch(options);
  }
}

/**
 * A poll on a message.
 */
export class Poll extends Base {
  /** The message. */
  public declare readonly message: Message;
  /** The question. */
  public question!: { text: string };
  /** The answers, by id. */
  public answers!: Collection<number, PollAnswer>;
  /** When the poll ends, in milliseconds. */
  public expiresTimestamp!: number | null;
  /** Whether more than one answer can be picked. */
  public allowMultiselect!: boolean;
  /** Always 1 (the default layout). */
  public layoutType = 1;
  /** Whether the poll has ended and its results are final. */
  public resultsFinalized!: boolean;
  /** How many people voted. */
  public totalVoters!: number;
  /** When the poll ended, in milliseconds, or `null`. */
  public endedTimestamp!: number | null;

  /**
   * @param client - The client
   * @param data - The poll from Bisim
   * @param message - The message
   */
  public constructor(client: Client, data: RawPollData, message: Message) {
    super(client);
    attachHidden(this, 'message', message);
    this._patch(data);
  }

  public override _patch(data: Partial<RawPollData>): void {
    if (data.question !== undefined) this.question = { text: data.question };
    const counts = new Map((data.counts ?? []).map((count) => [count.answerId, count.count]));
    if (data.answers) {
      this.answers = new Collection(
        data.answers.map((answer) => [answer.id, new PollAnswer(this.client, { ...answer, count: counts.get(answer.id) ?? 0 }, this)]),
      );
    } else if (data.counts && this.answers) {
      for (const answer of this.answers.values()) answer.voteCount = counts.get(answer.id) ?? 0;
    }
    if (data.expiresAt !== undefined) this.expiresTimestamp = toTimestamp(data.expiresAt);
    if (data.multiselect !== undefined) this.allowMultiselect = Boolean(data.multiselect);
    else this.allowMultiselect ??= false;
    if (data.endedAt !== undefined) this.endedTimestamp = toTimestamp(data.endedAt);
    else this.endedTimestamp ??= null;
    this.resultsFinalized = this.endedTimestamp !== null;
    if (data.total !== undefined) this.totalVoters = data.total;
    else this.totalVoters ??= 0;
  }

  /**
   * When the poll ends.
   */
  public get expiresAt(): Date | null {
    return this.expiresTimestamp === null ? null : new Date(this.expiresTimestamp);
  }

  /**
   * Whether this poll is partial.
   */
  public get partial(): boolean {
    return false;
  }

  /**
   * Ends the poll now (the bot must have sent it).
   */
  public async end(): Promise<Message> {
    if (this.expiresTimestamp !== null && this.expiresTimestamp < Date.now()) throw new BisimjsError(ErrorCodes.PollAlreadyExpired);
    const data = (await this.client.rest.post(Routes.expirePoll(this.message.channelId, this.message.id))) as RawMessageData | RawPollData | undefined;
    if (data && 'id' in data) return this.message.channel?.messages._add(data as RawMessageData) ?? this.message;
    if (data && 'question' in data) this._patch(data as RawPollData);
    return this.message;
  }
}

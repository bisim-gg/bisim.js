import { EventEmitter } from 'node:events';
import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import type { BaseInteraction } from '../interactions/BaseInteraction.js';
import { Collection } from '../util/Collection.js';
import { type ComponentType, InteractionType } from '../util/Enums.js';
import { Events } from '../util/Events.js';
import { attachHidden } from '../util/internal.js';
import type { Message } from './Message.js';
import type { MessageReaction } from './MessageReaction.js';
import type { User } from './User.js';

/**
 * Decides whether an arriving item is kept. It may answer with a promise.
 */
export type CollectorFilter<Args extends unknown[]> = (...args: Args) => boolean | Promise<boolean>;

/**
 * Settings shared by every collector.
 */
export interface CollectorOptions<FilterArgs extends unknown[]> {
  /** Keeps only the items this returns `true` for; everything passes when it is left out. */
  filter?: CollectorFilter<FilterArgs>;
  /** Ends the collector this many milliseconds after it starts. */
  time?: number;
  /** Ends the collector when this many milliseconds pass without a kept item. */
  idle?: number;
  /** Takes kept items out again when they are deleted or removed. */
  dispose?: boolean;
}

/** A limit that ends a collector: the end reason, the limit (unset means none) and the count so far. */
type Limit = [reason: string, limit: number | undefined, count: number];

/** The reason of the first limit that is set and reached, or `null`. */
function firstReached(limits: Limit[]): string | null {
  for (const [reason, limit, count] of limits) {
    if (limit && count >= limit) return reason;
  }
  return null;
}

/** A one shot timer that can be restarted and never keeps the process alive. */
class Countdown {
  private handle: NodeJS.Timeout | null = null;

  public constructor(private readonly onExpire: () => void) {}

  /** Whether the timer was started and not cancelled. */
  public get running(): boolean {
    return this.handle !== null;
  }

  /** Starts the timer again from zero; does nothing without a duration. */
  public restart(milliseconds: number | undefined): void {
    this.cancel();
    if (milliseconds) this.handle = setTimeout(this.onExpire, milliseconds).unref();
  }

  public cancel(): void {
    if (this.handle !== null) clearTimeout(this.handle);
    this.handle = null;
  }
}

/** An event listener as the client's emitter takes it. */
type Listener = (...args: any[]) => void;

/**
 * What every collector has in common. A collector listens to the client, keeps the items that pass its
 * filter in {@link Collector.collected}, and ends on a time limit, an idle limit, a count limit or
 * {@link Collector.stop}. It emits `collect`, `ignore`, `dispose` and finally `end` with what it kept and
 * the reason.
 */
export abstract class Collector<Key, Value, Extras extends unknown[] = []> extends EventEmitter {
  /** The client the collector listens to. */
  public declare readonly client: Client<true>;
  /** The items kept so far, by key. */
  public collected = new Collection<Key, Value>();
  /** Whether the collector has ended. */
  public ended = false;
  /** The filter items must pass. */
  public filter: CollectorFilter<[Value, ...Extras]>;
  /** The settings the collector was made with. */
  public options: CollectorOptions<[Value, ...Extras]>;
  private readonly lifetime = new Countdown(() => this.stop('time'));
  private readonly idleness = new Countdown(() => this.stop('idle'));
  private readonly subscriptions: [event: string, listener: Listener][] = [];
  private finishedBecause: string | null = null;

  protected constructor(client: Client, options: CollectorOptions<[Value, ...Extras]> = {}) {
    super();
    attachHidden(this, 'client', client);
    this.options = options;
    this.filter = options.filter ?? acceptEverything;
    for (const handler of ['handleCollect', 'handleDispose'] as const) this[handler] = this[handler].bind(this);
    this.lifetime.restart(options.time);
    this.idleness.restart(options.idle);
  }

  /**
   * Why the collector ended (`'time'`, `'idle'`, `'limit'`, `'user'` and so on), or `null` while it runs.
   */
  public get endReason(): string | null {
    return this.finishedBecause;
  }

  /**
   * Called with the arguments of the event that brings items.
   *
   * @internal
   */
  public async handleCollect(...args: unknown[]): Promise<void> {
    const item = args as [Value, ...Extras];
    const key = await this.collect(...item);
    if (key === null || key === undefined || this.ended) return;
    if (await this.filter(...item)) {
      this.collected.set(key, item[0]);
      this.emit('collect', ...item);
      if (this.idleness.running) this.idleness.restart(this.options.idle);
    } else {
      this.emit('ignore', ...item);
    }
    this.checkEnd();
  }

  /**
   * Called with the arguments of the event that takes items away.
   *
   * @internal
   */
  public async handleDispose(...args: unknown[]): Promise<void> {
    const { dispose: dropRemoved } = this.options;
    if (!dropRemoved) return;
    const item = args as [Value, ...Extras];
    const key = this.dispose(...item);
    if (key === null || key === undefined) return;
    if (!(await this.filter(...item)) || !this.collected.delete(key)) return;
    this.emit('dispose', ...item);
    this.checkEnd();
  }

  /**
   * Resolves with the next item kept. Rejects with {@link Collector.collected} if the collector ends first,
   * or has already ended.
   */
  public get next(): Promise<Value> {
    if (this.ended) return Promise.reject(this.collected);
    return new Promise<Value>((resolve, reject) => {
      const settle = (kept: boolean, item?: Value) => {
        this.off('collect', onItem).off('end', onFinish);
        if (kept) resolve(item as Value);
        else reject(this.collected);
      };
      const onItem = (item: Value) => settle(true, item);
      const onFinish = () => settle(false);
      this.on('collect', onItem).on('end', onFinish);
    });
  }

  /**
   * Ends the collector now. Does nothing if it has already ended.
   *
   * @param reason - The end reason to report, `'user'` when left out
   */
  public stop(reason = 'user'): void {
    if (this.ended) return;
    this.lifetime.cancel();
    this.idleness.cancel();
    this.finishedBecause = reason;
    this.ended = true;
    this.releaseListeners();
    const { collected } = this;
    this.emit('end', collected, reason);
  }

  /**
   * Starts the running timers again from zero, optionally with new durations.
   *
   * @param options - New `time` and `idle` durations, in milliseconds
   */
  public resetTimer(options: { time?: number; idle?: number } = {}): void {
    if (this.lifetime.running) this.lifetime.restart(options.time ?? this.options.time);
    if (this.idleness.running) this.idleness.restart(options.idle ?? this.options.idle);
  }

  /**
   * Ends the collector if one of its count limits has been reached.
   *
   * @returns Whether it ended
   */
  public checkEnd(): boolean {
    const reached = this.endReasonNow();
    if (reached === null) return false;
    this.stop(reached);
    return true;
  }

  /**
   * Yields each kept item, with the event's other arguments, until the collector ends.
   */
  public async *[Symbol.asyncIterator](): AsyncIterableIterator<[Value, ...Extras]> {
    const waiting: [Value, ...Extras][] = [];
    let wake: (() => void) | null = null;
    const onItem = (...item: [Value, ...Extras]) => {
      waiting.push(item);
      wake?.();
    };
    const onFinish = () => wake?.();
    this.on('collect', onItem).on('end', onFinish);
    try {
      for (;;) {
        const item = waiting.shift();
        if (item) {
          yield item;
          continue;
        }
        if (this.ended) return;
        await new Promise<void>((resolve) => (wake = resolve));
        wake = null;
      }
    } finally {
      this.off('collect', onItem).off('end', onFinish);
    }
  }

  /**
   * Listens to a client event until the collector ends.
   *
   * @param event - The client event
   * @param listener - What to call
   */
  protected listen(event: string, listener: Listener): void {
    if (this.subscriptions.length === 0) this.client.incrementMaxListeners();
    this.subscriptions.push([event, listener]);
    this.client.on(event, listener);
  }

  private releaseListeners(): void {
    if (this.subscriptions.length === 0) return;
    const { client } = this;
    for (const [event, listener] of this.subscriptions.splice(0)) client.off(event, listener);
    client.decrementMaxListeners();
  }

  /** The key an arriving item is kept under, or `null` when it is not for this collector. */
  public abstract collect(...args: [Value, ...Extras]): Key | null | Promise<Key | null>;
  /** The key of an item that went away, or `null` when it is not for this collector. */
  public abstract dispose(...args: [Value, ...Extras]): Key | null;
  /** The reason of the count limit reached, or `null` while none is. */
  protected abstract endReasonNow(): string | null;
}

function acceptEverything(): boolean {
  return true;
}

/**
 * Settings for collecting messages.
 */
export interface MessageCollectorOptions extends CollectorOptions<[Message]> {
  /** Ends after keeping this many messages. */
  max?: number;
  /** Ends after seeing this many messages in the channel, kept or not. */
  maxProcessed?: number;
}

/**
 * Settings for waiting on messages with a promise.
 */
export interface AwaitMessagesOptions extends MessageCollectorOptions {
  /** End reasons that reject the promise rather than resolve it. */
  errors?: string[];
}

/**
 * Gathers the messages sent in one channel. Made by `channel.createMessageCollector()`.
 */
export class MessageCollector extends Collector<string, Message> {
  /** The channel being watched. */
  public declare readonly channel: { id: string };
  /** How many messages arrived in the channel, kept or not. */
  public received = 0;
  public declare options: MessageCollectorOptions;

  /**
   * @param channel - The channel to watch
   * @param options - What to keep, and when to end
   */
  public constructor(channel: { id: string; client: Client }, options: MessageCollectorOptions = {}) {
    super(channel.client, options);
    attachHidden(this, 'channel', channel);
    this.listen(Events.MessageCreate, this.handleCollect);
    this.listen(Events.MessageDelete, this.handleDispose);
  }

  public collect(message: Message): string | null {
    if (!this.watches(message)) return null;
    this.received += 1;
    return message.id;
  }

  public dispose(message: Message): string | null {
    return this.watches(message) ? message.id : null;
  }

  protected endReasonNow(): string | null {
    return firstReached([
      ['limit', this.options.max, this.collected.size],
      ['processedLimit', this.options.maxProcessed, this.received],
    ]);
  }

  private watches(message: Message): boolean {
    return message.channelId === this.channel.id;
  }
}

/**
 * Settings for collecting reactions.
 */
export interface ReactionCollectorOptions extends CollectorOptions<[MessageReaction, User]> {
  /** Ends after this many reactions are added. */
  max?: number;
  /** Ends after this many different emoji are kept. */
  maxEmojis?: number;
  /** Ends after this many different people have reacted. */
  maxUsers?: number;
}

/**
 * Settings for waiting on reactions with a promise.
 */
export interface AwaitReactionsOptions extends ReactionCollectorOptions {
  /** End reasons that reject the promise rather than resolve it. */
  errors?: string[];
}

/**
 * Gathers the reactions added to one message, keyed by emoji. Made by `message.createReactionCollector()`.
 */
export class ReactionCollector extends Collector<string, MessageReaction, [User]> {
  /** The message being watched. */
  public declare readonly message: Message;
  /** The people whose reactions were kept. */
  public users = new Collection<string, User>();
  /** How many reactions were kept. */
  public total = 0;
  public declare options: ReactionCollectorOptions;

  /**
   * @param message - The message to watch
   * @param options - What to keep, and when to end
   */
  public constructor(message: Message, options: ReactionCollectorOptions = {}) {
    super(message.client, options);
    attachHidden(this, 'message', message);
    this.on('collect', (_reaction: MessageReaction, reactor: User) => {
      this.total += 1;
      this.users.set(reactor.id, reactor);
    });
    this.listen(Events.MessageReactionAdd, this.handleCollect);
    this.listen(Events.MessageReactionRemove, this.handleDispose);
  }

  public collect(reaction: MessageReaction): string | null {
    return reaction.message.id === this.message.id ? reaction.key : null;
  }

  public dispose(reaction: MessageReaction): string | null {
    const lastOneGone = reaction.message.id === this.message.id && reaction.count <= 0;
    return lastOneGone ? reaction.key : null;
  }

  protected endReasonNow(): string | null {
    return firstReached([
      ['limit', this.options.max, this.total],
      ['emojiLimit', this.options.maxEmojis, this.collected.size],
      ['userLimit', this.options.maxUsers, this.users.size],
    ]);
  }

  /**
   * The key a reaction is kept under: its emoji.
   *
   * @param reaction - The reaction
   */
  public static key(reaction: MessageReaction): string {
    return reaction.key;
  }
}

/**
 * Settings for collecting interactions.
 */
export interface InteractionCollectorOptions<Interaction extends BaseInteraction = BaseInteraction> extends CollectorOptions<[Interaction]> {
  /** Keeps only interactions from this channel. */
  channel?: { id: string } | string;
  /** Keeps only interactions from this server. */
  guild?: { id: string } | string;
  /** Keeps only interactions on this message. */
  message?: { id: string } | string;
  /** Keeps only interactions on the reply this response stands for. */
  interactionResponse?: { interaction: { id: string }; id?: string };
  /** Keeps only this kind of interaction. */
  interactionType?: InteractionType;
  /** Keeps only clicks and choices on this kind of component. */
  componentType?: ComponentType;
  /** Ends after keeping this many interactions. */
  max?: number;
  /** Ends after this many interactions were kept, counted over the collector's life even after `empty()`. */
  maxComponents?: number;
  /** Ends after this many different people have interacted. */
  maxUsers?: number;
}

/**
 * Settings for collecting button clicks and menu choices on a message.
 */
export type MessageComponentCollectorOptions = Omit<InteractionCollectorOptions, 'channel' | 'guild' | 'interactionType' | 'message'>;

/**
 * Settings for waiting on one button click or menu choice.
 */
export type AwaitMessageComponentOptions = Omit<MessageComponentCollectorOptions, 'max' | 'maxComponents' | 'maxUsers'>;

/**
 * Settings for waiting on a modal to be submitted.
 */
export interface AwaitModalSubmitOptions {
  filter?: CollectorFilter<[BaseInteraction]>;
  /** How long to wait, in milliseconds. Required, as in discord.js. */
  time: number;
}

const idOf = (target: { id: string } | string | undefined): string | null =>
  (typeof target === 'string' ? target : target?.id) ?? null;

/**
 * Gathers interactions: button clicks, menu choices and modal submissions, narrowed down by channel,
 * server, message, interaction type and component type.
 */
export class InteractionCollector<Interaction extends BaseInteraction = BaseInteraction> extends Collector<string, Interaction> {
  /** The channel interactions must come from, if any. */
  public channelId: string | null;
  /** The server interactions must come from, if any. */
  public guildId: string | null;
  /** The message interactions must be on, if any. */
  public messageId: string | null;
  /** The kind of interaction kept, if narrowed. */
  public interactionType: InteractionType | null;
  /** The kind of component kept, if narrowed. */
  public componentType: ComponentType | null;
  /** The people whose interactions were kept. */
  public users = new Collection<string, User>();
  /** How many interactions were kept. */
  public total = 0;
  public declare options: InteractionCollectorOptions<Interaction>;

  /**
   * @param client - The client to listen to
   * @param options - What to keep, and when to end
   */
  public constructor(client: Client, options: InteractionCollectorOptions<Interaction> = {}) {
    super(client, options as CollectorOptions<[Interaction]>);
    const { interactionType = null, componentType = null } = options;
    this.channelId = idOf(options.channel);
    this.guildId = idOf(options.guild);
    this.messageId = idOf(options.message);
    this.interactionType = interactionType;
    this.componentType = componentType;
    this.on('collect', (interaction: Interaction) => {
      const { user: clicker } = interaction;
      this.total += 1;
      this.users.set(clicker.id, clicker);
    });
    this.listen(Events.InteractionCreate, this.handleCollect);
  }

  public collect(interaction: Interaction): string | null {
    const component = interaction as unknown as { componentType?: ComponentType; message?: { id: string } };
    const wanted: [expected: unknown, actual: unknown][] = [
      [this.interactionType, interaction.type],
      [this.componentType, component.componentType],
      [this.messageId, component.message?.id],
      [this.channelId, interaction.channelId],
      [this.guildId, interaction.guildId],
    ];
    return wanted.every(([expected, actual]) => expected === null || expected === actual) ? interaction.id : null;
  }

  public dispose(interaction: Interaction): string | null {
    return interaction.id;
  }

  /**
   * Forgets everything kept so far and resets the counts, then checks the limits again.
   */
  public empty(): void {
    this.total = 0;
    this.collected.clear();
    this.users.clear();
    this.checkEnd();
  }

  protected endReasonNow(): string | null {
    return firstReached([
      ['limit', this.options.max, this.collected.size],
      ['componentLimit', this.options.maxComponents, this.total],
      ['userLimit', this.options.maxUsers, this.users.size],
    ]);
  }
}

/** Resolves when the collector ends, with what it kept and why it ended. */
function whenEnded<Key, Value>(collector: Collector<Key, Value, any[]>): Promise<[Collection<Key, Value>, string]> {
  return new Promise((done) => collector.once('end', (kept: Collection<Key, Value>, why: string) => done([kept, why])));
}

/**
 * Waits for the first interaction that matches the options.
 *
 * @internal
 */
export async function awaitInteraction<Interaction extends BaseInteraction>(
  client: Client,
  options: InteractionCollectorOptions<Interaction>,
): Promise<Interaction> {
  const [kept, why] = await whenEnded(new InteractionCollector<Interaction>(client, { ...options, max: 1 }));
  const first = kept.first();
  if (first === undefined) throw new BisimjsError(ErrorCodes.InteractionCollectorError, why);
  return first;
}

/**
 * A promise for what a collector keeps: it resolves when the collector ends, and rejects with the same
 * collection when the end reason is one of `errors`.
 *
 * @internal
 */
export async function awaitCollector<Value>(
  collector: Collector<string, Value, any[]>,
  errors: string[] | undefined,
): Promise<Collection<string, Value>> {
  const [kept, why] = await whenEnded(collector);
  return errors?.includes(why) ? Promise.reject(kept) : kept;
}

export { InteractionType };

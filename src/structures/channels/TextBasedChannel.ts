import { BisimjsTypeError, ErrorCodes } from '../../errors/index.js';
import type { MessageManager, MessageResolvable } from '../../managers/MessageManager.js';
import { isRouteMissing } from '../../rest/missing.js';
import { Routes } from '../../rest/Routes.js';
import type { RawMessageData, RawWebhookData } from '../../types/raw.js';
import { Collection } from '../../util/Collection.js';
import { SnowflakeUtil } from '../../util/SnowflakeUtil.js';
import { notSupported } from '../../util/Util.js';
import {
  type AwaitMessageComponentOptions,
  type AwaitMessagesOptions,
  InteractionCollector,
  MessageCollector,
  type MessageCollectorOptions,
  type MessageComponentCollectorOptions,
  awaitCollector,
  awaitInteraction,
} from '../Collectors.js';
import type { Message } from '../Message.js';
import { type MessageCreateOptions, MessagePayload } from '../MessagePayload.js';
import { Webhook } from '../Webhook.js';
import type { MessageComponentInteraction } from '../../interactions/MessageComponentInteraction.js';
import type { Client } from '../../client/Client.js';
import { onComponents } from '../collectorScope.js';

/**
 * Options for creating a webhook.
 */
export interface ChannelWebhookCreateOptions {
  /** The name (1 to 80 characters). */
  name: string;
  /** Not on Bisim through the API: webhook avatars. */
  avatar?: unknown;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * What every channel that holds messages offers: sending, typing, fetching and collecting.
 */
export interface TextBasedChannelFields {
  /** The id of the last message, or `null`. */
  lastMessageId: string | null;
  /** Always `null` on Bisim. */
  lastPinTimestamp: number | null;
  /** The messages of the channel. */
  messages: MessageManager;
  /** The last message, if cached. */
  readonly lastMessage: Message | null;
  /** When the last message was pinned (always `null` on Bisim). */
  readonly lastPinAt: Date | null;
  /** Sends a message. */
  send(options: string | MessagePayload | MessageCreateOptions): Promise<Message>;
  /** Shows "bot is typing" for a few seconds. */
  sendTyping(): Promise<void>;
  /** Deletes several messages at once (needs Manage Messages). */
  bulkDelete(messages: Collection<string, Message> | readonly MessageResolvable[] | number, filterOld?: boolean): Promise<Collection<string, Message | undefined>>;
  /** Collects messages sent in the channel. */
  createMessageCollector(options?: MessageCollectorOptions): MessageCollector;
  /** Waits for messages sent in the channel. */
  awaitMessages(options?: AwaitMessagesOptions): Promise<Collection<string, Message>>;
  /** Collects component clicks in the channel. */
  createMessageComponentCollector(options?: MessageComponentCollectorOptions): InteractionCollector<MessageComponentInteraction>;
  /** Waits for one component click in the channel. */
  awaitMessageComponent(options?: AwaitMessageComponentOptions): Promise<MessageComponentInteraction>;
}

interface TextBasedHost {
  id: string;
  client: Client<true>;
  messages: MessageManager;
  lastMessageId: string | null;
  guildId?: string;
}

/**
 * The methods of {@link TextBasedChannelFields}, applied to the channel classes.
 *
 * @internal
 */
export class TextBasedChannelMethods {
  public get lastMessage(): Message | null {
    const host = this as unknown as TextBasedHost;
    return host.lastMessageId ? (host.messages.cache.get(host.lastMessageId) ?? null) : null;
  }

  public get lastPinAt(): Date | null {
    const host = this as unknown as { lastPinTimestamp: number | null };
    return host.lastPinTimestamp ? new Date(host.lastPinTimestamp) : null;
  }

  public async send(this: TextBasedHost, options: string | MessagePayload | MessageCreateOptions): Promise<Message> {
    const payload = MessagePayload.create(this, options as Record<string, unknown>);
    payload.resolveBody();
    await payload.resolveFiles();
    const data = (await this.client.rest.post(Routes.channelMessages(this.id), {
      body: payload.body,
      files: payload.files ?? undefined,
    })) as RawMessageData;
    const message = this.messages._add({ guildId: this.guildId, ...data });
    this.lastMessageId = message.id;
    return message;
  }

  public async sendTyping(this: TextBasedHost): Promise<void> {
    try {
      await this.client.rest.post(Routes.channelTyping(this.id));
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
      this.client.ws.sendTyping(this.id, this.guildId);
    }
  }

  public async bulkDelete(
    this: TextBasedHost,
    messages: Collection<string, Message> | readonly MessageResolvable[] | number,
    filterOld = false,
  ): Promise<Collection<string, Message | undefined>> {
    let ids: string[];
    if (typeof messages === 'number') {
      const fetched = await this.messages.fetch({ limit: messages });
      ids = [...fetched.keys()];
    } else if (messages instanceof Collection) {
      ids = [...messages.keys()];
    } else if (Array.isArray(messages)) {
      ids = messages.map((message: MessageResolvable) => (typeof message === 'string' ? message : message.id));
    } else {
      throw new BisimjsTypeError(ErrorCodes.MessageBulkDeleteType);
    }
    if (filterOld) {
      const cutoff = Date.now() - 1_209_600_000;
      ids = ids.filter((id) => SnowflakeUtil.timestampFrom(id) > cutoff);
    }
    const deleted = new Collection<string, Message | undefined>();
    if (ids.length === 0) return deleted;
    if (ids.length === 1) {
      await this.client.rest.delete(Routes.channelMessage(this.id, ids[0]!));
    } else {
      try {
        for (let index = 0; index < ids.length; index += 100) {
          await this.client.rest.post(Routes.channelBulkDelete(this.id), { body: { messages: ids.slice(index, index + 100) } });
        }
      } catch (error) {
        if (!isRouteMissing(error)) throw error;
        for (const id of ids) await this.client.rest.delete(Routes.channelMessage(this.id, id));
      }
    }
    for (const id of ids) {
      const cached = this.messages.cache.get(id);
      if (cached) cached.deleted = true;
      deleted.set(id, cached);
      this.messages.cache.delete(id);
    }
    return deleted;
  }

  public createMessageCollector(this: TextBasedHost, options: MessageCollectorOptions = {}): MessageCollector {
    return new MessageCollector(this, options);
  }

  public awaitMessages(this: TextBasedHost, options: AwaitMessagesOptions = {}): Promise<Collection<string, Message>> {
    return awaitCollector(new MessageCollector(this, options), options.errors);
  }

  public createMessageComponentCollector(
    this: TextBasedHost,
    options: MessageComponentCollectorOptions = {},
  ): InteractionCollector<MessageComponentInteraction> {
    return new InteractionCollector<MessageComponentInteraction>(this.client, onComponents(options, { channel: this.id }));
  }

  public awaitMessageComponent(this: TextBasedHost, options: AwaitMessageComponentOptions = {}): Promise<MessageComponentInteraction> {
    return awaitInteraction<MessageComponentInteraction>(this.client, onComponents(options, { channel: this.id }));
  }

  public async fetchWebhooks(this: TextBasedHost): Promise<Collection<string, Webhook>> {
    const data = (await this.client.rest.get(Routes.channelWebhooks(this.id))) as RawWebhookData[];
    return new Collection(data.map((raw) => [raw.id, new Webhook(this.client, raw)]));
  }

  public async createWebhook(this: TextBasedHost, options: ChannelWebhookCreateOptions): Promise<Webhook> {
    if (options.avatar !== undefined && options.avatar !== null) notSupported('Webhook avatars through the API');
    const data = (await this.client.rest.post(Routes.channelWebhooks(this.id), { body: { name: options.name }, reason: options.reason })) as RawWebhookData;
    return new Webhook(this.client, data);
  }
}

/**
 * Copies the text channel methods onto a channel class.
 *
 * @param target - The channel class
 * @param ignore - Methods to leave out
 * @internal
 */
export function applyTextBased(target: { prototype: object }, ignore: string[] = []): void {
  for (const prop of Object.getOwnPropertyNames(TextBasedChannelMethods.prototype)) {
    if (prop === 'constructor' || ignore.includes(prop)) continue;
    Object.defineProperty(target.prototype, prop, Object.getOwnPropertyDescriptor(TextBasedChannelMethods.prototype, prop)!);
  }
}

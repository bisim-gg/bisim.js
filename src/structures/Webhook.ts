import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { REST } from '../rest/REST.js';
import { Routes } from '../rest/Routes.js';
import type { RESTOptions } from '../rest/types.js';
import type { RawMessageData, RawWebhookData } from '../types/raw.js';
import { WebhookType } from '../util/Enums.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { cdnURL } from '../util/Util.js';
import type { TextChannel } from './channels/TextChannel.js';
import { Message } from './Message.js';
import {
  type MessageMentionOptions,
  MessagePayload,
  type WebhookMessageCreateOptions,
  type WebhookMessageEditOptions,
} from './MessagePayload.js';
import type { User } from './User.js';
import { attachHidden, dateFrom } from '../util/internal.js';
import { type ImageResolvable, imageForm } from '../util/images.js';

/**
 * Options for editing a webhook.
 */
export interface WebhookEditOptions {
  /** The new name. */
  name?: string;
  /** The picture its messages show: a Buffer, a path, a URL or a `data:` URI; `null` takes it off. */
  avatar?: ImageResolvable | null;
  /** Moves the webhook to another channel. */
  channel?: TextChannel | string;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * Options for fetching a message a webhook posted.
 */
export interface WebhookFetchMessageOptions {
  /** Whether to cache the message (`true` by default). */
  cache?: boolean;
  /** Not on Bisim: threads. */
  threadId?: string;
}

/**
 * Reads a webhook URL (`<api>/webhooks/{id}/{token}`) into its id and token.
 *
 * @param url - The URL
 */
export function parseWebhookURL(url: string): { id: string; token: string; api: string } | null {
  const match = /^(https?:\/\/.+?)\/webhooks\/(\d{1,20})\/([\w-]{16,})\/?(?:[?#].*)?$/.exec(url.trim());
  if (!match) return null;
  return { api: match[1]!, id: match[2]!, token: match[3]! };
}

interface WebhookTarget {
  id: string;
}

async function executeWebhook(
  rest: REST,
  target: WebhookTarget,
  token: string,
  options: string | MessagePayload | WebhookMessageCreateOptions,
): Promise<RawMessageData> {
  const payload = MessagePayload.create(target, options as Record<string, unknown>, {}, 'webhook');
  payload.resolveBody();
  await payload.resolveFiles();
  return (await rest.post(Routes.webhook(target.id, token), {
    auth: false,
    body: payload.body,
    files: payload.files?.length ? payload.files : undefined,
    query: { wait: true },
  })) as RawMessageData;
}

const messageIdOf = (message: string | { id: string }): string => (typeof message === 'string' ? message : message.id);

async function fetchWebhookMessage(rest: REST, id: string, token: string, message: string | { id: string }, threadId?: string): Promise<RawMessageData> {
  if (threadId) throw new BisimjsError(ErrorCodes.NotSupported, 'Threads');
  return (await rest.get(Routes.webhookMessage(id, token, messageIdOf(message)), { auth: false })) as RawMessageData;
}

async function editWebhookMessage(
  rest: REST,
  target: WebhookTarget,
  token: string,
  message: string | { id: string },
  options: string | MessagePayload | WebhookMessageEditOptions,
  existing: readonly { id: string; name: string }[] | null,
): Promise<RawMessageData> {
  const payload = MessagePayload.create(target, options as Record<string, unknown>, {}, 'edit');
  payload.existingAttachments = existing;
  payload.resolveBody();
  await payload.resolveFiles();
  return (await rest.patch(Routes.webhookMessage(target.id, token, messageIdOf(message)), {
    auth: false,
    body: payload.body,
    files: payload.files?.length ? payload.files : undefined,
  })) as RawMessageData;
}

async function deleteWebhookMessage(rest: REST, id: string, token: string, message: string | { id: string }, threadId?: string): Promise<void> {
  if (threadId) throw new BisimjsError(ErrorCodes.NotSupported, 'Threads');
  await rest.delete(Routes.webhookMessage(id, token, messageIdOf(message)), { auth: false });
}

/**
 * A webhook: a URL that posts into one channel.
 */
export class Webhook {
  /** The client. */
  public declare readonly client: Client<true>;
  /** The id. */
  public id: string;
  /** The name. */
  public name: string;
  /** The token, which is the whole credential. */
  public token: string | null;
  /** The CDN key of the avatar. */
  public avatar: string | null;
  /** Always {@link WebhookType.Incoming} on Bisim. */
  public type: WebhookType = WebhookType.Incoming;
  /** Always `null` on Bisim. */
  public applicationId: string | null = null;
  /** The server's id. */
  public guildId: string;
  /** The channel's id. */
  public channelId: string;
  /** Who made the webhook. */
  public owner: User | null;
  /** Always `null` on Bisim. */
  public sourceGuild: null = null;
  /** Always `null` on Bisim. */
  public sourceChannel: null = null;

  /**
   * @param client - The client
   * @param data - The webhook from Bisim
   */
  public constructor(client: Client, data: RawWebhookData) {
    attachHidden(this, 'client', client);
    this.id = data.id;
    this.name = data.name;
    this.token = data.token ?? null;
    this.avatar = data.avatarKey ?? null;
    this.guildId = data.guildId;
    this.channelId = data.channelId;
    this.owner = data.creator ? client.users._add(data.creator) : null;
  }

  /**
   * The channel, when cached.
   */
  public get channel(): TextChannel | null {
    return (this.client.channels.cache.get(this.channelId) as TextChannel | undefined) ?? null;
  }

  /**
   * When the webhook was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the webhook was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The webhook's URL, `<api>/webhooks/{id}/{token}`.
   */
  public get url(): string {
    return `${this.client.options.rest.api}/webhooks/${this.id}/${this.token ?? ''}`;
  }

  /**
   * The avatar URL, or `null`.
   */
  public avatarURL(options: { size?: number } = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.avatar, options.size);
  }

  /**
   * Sends a message through the webhook: text, embeds and files (`username` sets the name for this message).
   *
   * @param options - The message
   */
  public async send(options: string | MessagePayload | WebhookMessageCreateOptions): Promise<Message> {
    const data = await executeWebhook(this.client.rest, this, this.requireToken(), options);
    return this.toMessage(data);
  }

  /** The token, or the error discord.js throws without one. */
  private requireToken(): string {
    if (this.token) return this.token;
    throw new BisimjsError(ErrorCodes.WebhookTokenUnavailable);
  }

  private toMessage(data: RawMessageData, cache = true): Message {
    const channel = this.channel;
    if (channel) return channel.messages._add({ guildId: this.guildId, ...data }, cache);
    return new Message(this.client, { guildId: this.guildId, ...data });
  }

  /**
   * Sends a Slack formatted message through the webhook's Slack adapter.
   *
   * @param body - Slack's message body
   */
  public async sendSlackMessage(body: unknown): Promise<boolean> {
    await this.client.rest.post(`${Routes.webhook(this.id, this.requireToken())}/slack`, { auth: false, body });
    return true;
  }

  /**
   * Edits the webhook: its name, its channel, or its picture (needs Manage Webhooks).
   *
   * @param options - What to change
   */
  public async edit(options: WebhookEditOptions): Promise<Webhook> {
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.channel !== undefined) body.channelId = typeof options.channel === 'string' ? options.channel : options.channel.id;
    if (Object.keys(body).length) {
      const data = (await this.client.rest.patch(Routes.webhook(this.id), { body, reason: options.reason })) as RawWebhookData;
      this.applyData(data);
    }
    if (options.avatar === null) {
      this.applyData((await this.client.rest.delete(Routes.webhookAvatar(this.id), { reason: options.reason })) as RawWebhookData);
    } else if (options.avatar !== undefined) {
      const form = await imageForm(options.avatar);
      const data = (await this.client.rest.post(Routes.webhookAvatar(this.id), { body: form, passThroughBody: true, reason: options.reason })) as RawWebhookData;
      this.applyData(data);
    }
    return this;
  }

  private applyData(data: RawWebhookData | undefined): void {
    if (!data || typeof data !== 'object') return;
    if (data.name !== undefined) this.name = data.name;
    if (data.channelId !== undefined) this.channelId = data.channelId;
    if ('avatarKey' in data) this.avatar = data.avatarKey ?? null;
    if (data.token) this.token = data.token;
  }

  /**
   * Deletes the webhook.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<void> {
    await this.client.rest.delete(Routes.webhook(this.id), { reason });
  }

  /**
   * Fetches a message this webhook posted.
   *
   * @param message - The message's id
   * @param options - Whether to cache it
   */
  public async fetchMessage(message: string | { id: string }, options: WebhookFetchMessageOptions = {}): Promise<Message> {
    const data = await fetchWebhookMessage(this.client.rest, this.id, this.requireToken(), message, options.threadId);
    return this.toMessage(data, options.cache ?? true);
  }

  /**
   * Edits a message this webhook posted: its text, embeds and files (`attachments` lists the files it keeps).
   *
   * @param message - The message or its id
   * @param options - The new content
   */
  public async editMessage(message: string | { id: string }, options: string | MessagePayload | WebhookMessageEditOptions): Promise<Message> {
    const known = this.channel?.messages.cache.get(messageIdOf(message));
    const existing = known && !known.partial ? [...known.attachments.values()].map((attachment) => ({ id: attachment.id, name: attachment.name })) : null;
    const data = await editWebhookMessage(this.client.rest, this, this.requireToken(), message, options, existing);
    return this.toMessage(data);
  }

  /**
   * Deletes a message this webhook posted.
   *
   * @param message - The message or its id
   * @param threadId - Not on Bisim: threads
   */
  public async deleteMessage(message: string | { id: string }, threadId?: string): Promise<void> {
    await deleteWebhookMessage(this.client.rest, this.id, this.requireToken(), message, threadId);
    const cached = this.channel?.messages.cache.get(messageIdOf(message));
    if (cached) cached.deleted = true;
    this.channel?.messages.cache.delete(messageIdOf(message));
  }

  /** Whether a user made this webhook (always `true` on Bisim). */
  public isUserCreated(): boolean {
    return true;
  }

  /** Always `false` on Bisim. */
  public isApplicationCreated(): boolean {
    return false;
  }

  /** Always `false` on Bisim. */
  public isChannelFollower(): boolean {
    return false;
  }

  /** Always `true` on Bisim. */
  public isIncoming(): boolean {
    return true;
  }
}

/**
 * Options for a {@link WebhookClient}.
 */
export interface WebhookClientOptions {
  /** REST options, for example `{ api: 'http://localhost:3000/api' }`. */
  rest?: Partial<RESTOptions>;
  /** Which mentions ping, for every message this client sends (see {@link MessageMentionOptions}). */
  allowedMentions?: MessageMentionOptions;
}

/**
 * Sends through a webhook without a bot: only the id and token (or the URL) are needed.
 *
 * @example
 * ```js
 * const webhookClient = new WebhookClient({ url: 'https://api.bisim.gg/api/webhooks/123/abc' });
 * await webhookClient.send({ content: 'Webhook test', username: 'some-username' });
 * ```
 */
export class WebhookClient {
  /** The webhook's id. */
  public id: string;
  /** The webhook's token. */
  public token: string;
  /** The REST manager this client uses. */
  public rest: REST;
  /** The options. */
  public options: WebhookClientOptions;

  /**
   * @param data - The id and token, or the URL
   * @param options - The options
   */
  public constructor(data: { id: string; token: string } | { url: string }, options: WebhookClientOptions = {}) {
    let api = options.rest?.api;
    if ('url' in data) {
      const parsed = parseWebhookURL(data.url);
      if (!parsed) throw new BisimjsError(ErrorCodes.WebhookURLInvalid);
      this.id = parsed.id;
      this.token = parsed.token;
      api ??= parsed.api;
    } else {
      this.id = data.id;
      this.token = data.token;
    }
    this.options = options;
    this.rest = new REST({ handlerSweepInterval: 0, ...options.rest, ...(api ? { api } : {}) });
  }

  /**
   * The webhook's URL.
   */
  public get url(): string {
    return `${this.rest.options.api}/webhooks/${this.id}/${this.token}`;
  }

  /**
   * Sends a message through the webhook. Resolves with the message as Bisim returned it.
   *
   * @param options - The message
   */
  public send(options: string | MessagePayload | WebhookMessageCreateOptions): Promise<RawMessageData> {
    return executeWebhook(this.rest, this, this.token, options);
  }

  /**
   * Sends a Slack formatted message through the webhook's Slack adapter.
   *
   * @param body - Slack's message body
   */
  public async sendSlackMessage(body: unknown): Promise<boolean> {
    await this.rest.post(`${Routes.webhook(this.id, this.token)}/slack`, { auth: false, body });
    return true;
  }

  /**
   * Fetches a message this webhook posted, as Bisim returned it.
   *
   * @param message - The message's id
   * @param options - Not on Bisim: threads
   */
  public fetchMessage(message: string | { id: string }, options: { threadId?: string } = {}): Promise<RawMessageData> {
    return fetchWebhookMessage(this.rest, this.id, this.token, message, options.threadId);
  }

  /**
   * Edits a message this webhook posted, and resolves with it as Bisim returned it.
   *
   * @param message - The message or its id
   * @param options - The new content
   */
  public editMessage(message: string | { id: string }, options: string | MessagePayload | WebhookMessageEditOptions): Promise<RawMessageData> {
    return editWebhookMessage(this.rest, this, this.token, message, options, null);
  }

  /**
   * Deletes a message this webhook posted.
   *
   * @param message - The message or its id
   * @param threadId - Not on Bisim: threads
   */
  public deleteMessage(message: string | { id: string }, threadId?: string): Promise<void> {
    return deleteWebhookMessage(this.rest, this.id, this.token, message, threadId);
  }

  /**
   * Stops the client's timers.
   */
  public destroy(): void {
    this.rest.clearHandlerSweeper();
  }
}

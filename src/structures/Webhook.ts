import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { REST } from '../rest/REST.js';
import { Routes } from '../rest/Routes.js';
import type { RESTOptions } from '../rest/types.js';
import type { RawMessageData, RawWebhookData } from '../types/raw.js';
import { WebhookType } from '../util/Enums.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { cdnURL, notSupported } from '../util/Util.js';
import type { TextChannel } from './channels/TextChannel.js';
import { Message } from './Message.js';
import { MessagePayload, type WebhookMessageCreateOptions } from './MessagePayload.js';
import type { User } from './User.js';
import { attachHidden, dateFrom } from '../util/internal.js';

/**
 * Options for editing a webhook.
 */
export interface WebhookEditOptions {
  name?: string;
  /** Not on Bisim through the API. */
  avatar?: unknown;
  /** Moves the webhook to another channel. */
  channel?: TextChannel | string;
  reason?: string;
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

async function executeWebhook(
  rest: REST,
  id: string,
  token: string,
  options: string | MessagePayload | WebhookMessageCreateOptions,
): Promise<RawMessageData> {
  const payload = MessagePayload.create({ id }, options as Record<string, unknown>, {}, 'webhook');
  payload.resolveBody();
  await payload.resolveFiles();
  return (await rest.post(Routes.webhook(id, token), {
    auth: false,
    body: payload.body,
    query: { wait: true },
  })) as RawMessageData;
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
   * Sends a message through the webhook (text and embeds; `username` sets the name for this message).
   *
   * @param options - The message
   */
  public async send(options: string | MessagePayload | WebhookMessageCreateOptions): Promise<Message> {
    if (!this.token) throw new BisimjsError(ErrorCodes.WebhookTokenUnavailable);
    const data = await executeWebhook(this.client.rest, this.id, this.token, options);
    const channel = this.channel;
    if (channel) return channel.messages._add({ guildId: this.guildId, ...data });
    return new Message(this.client, { guildId: this.guildId, ...data });
  }

  /**
   * Sends a Slack formatted message through the webhook's Slack adapter.
   *
   * @param body - Slack's message body
   */
  public async sendSlackMessage(body: unknown): Promise<boolean> {
    if (!this.token) throw new BisimjsError(ErrorCodes.WebhookTokenUnavailable);
    await this.client.rest.post(`${Routes.webhook(this.id, this.token)}/slack`, { auth: false, body });
    return true;
  }

  /**
   * Edits the webhook (its name, or its channel).
   *
   * @param options - What to change
   */
  public async edit(options: WebhookEditOptions): Promise<Webhook> {
    if (options.avatar !== undefined && options.avatar !== null) notSupported('Webhook avatars through the API');
    const body: Record<string, unknown> = {};
    if (options.name !== undefined) body.name = options.name;
    if (options.channel !== undefined) body.channelId = typeof options.channel === 'string' ? options.channel : options.channel.id;
    const data = (await this.client.rest.patch(Routes.webhook(this.id), { body, reason: options.reason })) as RawWebhookData;
    this.name = data.name;
    this.channelId = data.channelId;
    this.avatar = data.avatarKey ?? null;
    return this;
  }

  /**
   * Deletes the webhook.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<void> {
    await this.client.rest.delete(Routes.webhook(this.id), { reason });
  }

  /** Not on Bisim yet: fetching past webhook messages. */
  public fetchMessage(_message: string): Promise<never> {
    return notSupported('Fetching webhook messages');
  }

  /** Not on Bisim yet: editing past webhook messages. */
  public editMessage(_message: string, _options: unknown): Promise<never> {
    return notSupported('Editing webhook messages');
  }

  /** Not on Bisim yet: deleting past webhook messages through the token. */
  public deleteMessage(_message: string): Promise<never> {
    return notSupported('Deleting webhook messages through the token');
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
  /** Accepted for compatibility. */
  allowedMentions?: unknown;
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
    return executeWebhook(this.rest, this.id, this.token, options);
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

  /** Not on Bisim yet. */
  public fetchMessage(_message: string): Promise<never> {
    return notSupported('Fetching webhook messages');
  }

  /** Not on Bisim yet. */
  public editMessage(_message: string, _options: unknown): Promise<never> {
    return notSupported('Editing webhook messages');
  }

  /** Not on Bisim yet. */
  public deleteMessage(_message: string): Promise<never> {
    return notSupported('Deleting webhook messages through the token');
  }

  /**
   * Stops the client's timers.
   */
  public destroy(): void {
    this.rest.clearHandlerSweeper();
  }
}

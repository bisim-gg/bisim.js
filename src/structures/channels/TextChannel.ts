import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import type { RawChannelData } from '../../types/raw.js';
import { notSupported } from '../../util/Util.js';
import type { Guild } from '../Guild.js';
import { GuildChannel } from './GuildChannel.js';
import { type TextBasedChannelFields, applyTextBased, type ChannelWebhookCreateOptions } from './TextBasedChannel.js';
import type { Collection } from '../../util/Collection.js';
import type { Webhook } from '../Webhook.js';

/**
 * A text channel in a server.
 */
export class TextChannel extends GuildChannel {
  /** The topic. */
  public topic!: string | null;
  /** The slow mode, in seconds between messages (0 for none). */
  public rateLimitPerUser!: number;
  /** The id of the last message, or `null`. */
  public lastMessageId!: string | null;
  /** Always `null` on Bisim. */
  public lastPinTimestamp: number | null = null;
  /** The messages of the channel. */
  public messages!: MessageManager;
  /** Always `undefined` on Bisim (no threads). */
  public defaultAutoArchiveDuration?: number;
  /** Always `null` on Bisim (no threads). */
  public defaultThreadRateLimitPerUser: number | null = null;

  /**
   * @param guild - The server
   * @param data - The channel from Bisim
   * @param client - The client
   */
  public constructor(guild: Guild, data: RawChannelData, client?: Client) {
    super(guild, data, client);
  }

  public override _patch(data: Partial<RawChannelData>): void {
    this.messages ??= new MessageManager(this);
    super._patch(data);
    if ('topic' in data) this.topic = data.topic || null;
    else this.topic ??= null;
    if (data.slowmodeSec !== undefined) this.rateLimitPerUser = data.slowmodeSec ?? 0;
    else this.rateLimitPerUser ??= 0;
    if ('lastMessageId' in data) this.lastMessageId = data.lastMessageId ?? null;
    else this.lastMessageId ??= null;
  }

  /**
   * Sets the topic.
   *
   * @param topic - The topic, or `null` to clear it
   * @param reason - Why
   */
  public setTopic(topic: string | null, reason?: string): Promise<this> {
    return this.edit({ reason, topic });
  }

  /**
   * Sets whether the channel is age restricted.
   *
   * @param nsfw - Whether it is
   * @param reason - Why
   */
  public setNSFW(nsfw = true, reason?: string): Promise<this> {
    return this.edit({ reason, nsfw });
  }

  /**
   * Sets the slow mode.
   *
   * @param rateLimitPerUser - Seconds between messages (0 for none)
   * @param reason - Why
   */
  public setRateLimitPerUser(rateLimitPerUser: number, reason?: string): Promise<this> {
    return this.edit({ reason, rateLimitPerUser });
  }

  /** Not on Bisim: threads. */
  public setDefaultAutoArchiveDuration(_duration: number, _reason?: string): Promise<this> {
    return notSupported('Threads');
  }

  /** Not on Bisim: announcement channels. */
  public setType(_type: unknown, _reason?: string): Promise<this> {
    return notSupported('Announcement channels');
  }

  /**
   * Not on Bisim: threads. Reading it throws a {@link BisimjsError} that says so.
   */
  public get threads(): never {
    return notSupported('Threads');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface TextChannel extends TextBasedChannelFields {
  /** Fetches the webhooks of the channel. */
  fetchWebhooks(): Promise<Collection<string, Webhook>>;
  /** Creates a webhook in the channel (needs Manage Webhooks). */
  createWebhook(options: ChannelWebhookCreateOptions): Promise<Webhook>;
}

applyTextBased(TextChannel);

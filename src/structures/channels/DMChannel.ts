import type { Client } from '../../client/Client.js';
import { MessageManager } from '../../managers/MessageManager.js';
import type { RawChannelData, RawUserData } from '../../types/raw.js';
import { Collection } from '../../util/Collection.js';
import { cdnURL, notSupported } from '../../util/Util.js';
import type { User } from '../User.js';
import { BaseChannel } from './BaseChannel.js';
import { type TextBasedChannelFields, applyTextBased } from './TextBasedChannel.js';

/**
 * A direct message channel between the bot and one user.
 */
export class DMChannel extends BaseChannel {
  /** The id of the other user. */
  public recipientId!: string;
  /** The id of the last message, or `null`. */
  public lastMessageId!: string | null;
  /** Always `null` on Bisim. */
  public lastPinTimestamp!: number | null;
  /** The messages of the channel. */
  public messages!: MessageManager;

  /**
   * @param client - The client
   * @param data - The channel from Bisim
   */
  public constructor(client: Client, data: RawChannelData & { recipientId?: string }) {
    super(client, data, false);
    this.messages = new MessageManager(this);
    this.lastMessageId = null;
    this.lastPinTimestamp = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawChannelData> & { recipientId?: string }): void {
    super._patch(data);
    if (data.recipientId) this.recipientId = data.recipientId;
    if (data.participants) {
      for (const participant of data.participants) this.client.users._add(participant);
      const other = data.participants.find((participant: RawUserData) => participant.id !== this.client.user?.id) ?? data.participants[0];
      if (other) this.recipientId = other.id;
    }
    if ('lastMessageId' in data) this.lastMessageId = data.lastMessageId ?? null;
  }

  /**
   * Whether this channel is partial (the other user is not known).
   */
  public override get partial(): boolean {
    return this.recipientId === undefined;
  }

  /**
   * The other user.
   */
  public get recipient(): User | null {
    return this.client.users.cache.get(this.recipientId) ?? null;
  }

  /**
   * Bisim does not let bots close DMs: this forgets the channel locally.
   */
  public async delete(): Promise<this> {
    this.client.channels.cache.delete(this.id);
    return this;
  }

  /**
   * The channel as a mention of the other user, `<@id>`.
   */
  public override toString(): `<#${string}>` {
    return `<@${this.recipientId}>` as `<#${string}>`;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface DMChannel extends TextBasedChannelFields {}

applyTextBased(DMChannel, ['fetchWebhooks', 'createWebhook']);

/**
 * A group DM the bot is in.
 */
export class PartialGroupDMChannel extends BaseChannel {
  /** The name of the group, or `null`. */
  public name!: string | null;
  /** The CDN key of the group's icon, or `null`. */
  public icon!: string | null;
  /** The users in the group. */
  public recipients!: { id: string; username: string | null }[];
  /** The id of the owner. */
  public ownerId!: string | null;
  /** The id of the last message, or `null`. */
  public lastMessageId!: string | null;
  /** Always `null` on Bisim. */
  public lastPinTimestamp!: number | null;
  /** The messages of the channel. */
  public messages!: MessageManager;

  /**
   * @param client - The client
   * @param data - The channel from Bisim
   */
  public constructor(client: Client, data: RawChannelData) {
    super(client, data, false);
    this.messages = new MessageManager(this);
    this.name = null;
    this.icon = null;
    this.recipients = [];
    this.ownerId = null;
    this.lastMessageId = null;
    this.lastPinTimestamp = null;
    this._patch(data);
  }

  public override _patch(data: Partial<RawChannelData>): void {
    super._patch(data);
    if ('name' in data) this.name = data.name ?? null;
    if ('iconKey' in data) this.icon = data.iconKey ?? null;
    if ('ownerId' in data) this.ownerId = data.ownerId ?? null;
    if ('lastMessageId' in data) this.lastMessageId = data.lastMessageId ?? null;
    if (data.participants) {
      this.recipients = data.participants.map((participant) => {
        this.client.users._add(participant);
        return { id: participant.id, username: participant.username };
      });
    }
  }

  /**
   * The users in the group.
   */
  public get users(): Collection<string, User> {
    const users = new Collection<string, User>();
    for (const recipient of this.recipients) {
      const user = this.client.users.cache.get(recipient.id);
      if (user) users.set(user.id, user);
    }
    return users;
  }

  /**
   * The URL of the group's icon, or `null`.
   */
  public iconURL(options: { size?: number } = {}): string | null {
    return cdnURL(this.client.options.rest.cdn, this.icon, options.size);
  }

  /** Not on Bisim: bots cannot leave or delete group DMs. */
  public delete(): Promise<this> {
    return notSupported('Deleting a group DM');
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface PartialGroupDMChannel extends TextBasedChannelFields {}

applyTextBased(PartialGroupDMChannel, ['fetchWebhooks', 'createWebhook']);

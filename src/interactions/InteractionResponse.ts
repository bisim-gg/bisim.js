import type { Client } from '../client/Client.js';
import {
  type AwaitMessageComponentOptions,
  InteractionCollector,
  type MessageComponentCollectorOptions,
  awaitInteraction,
} from '../structures/Collectors.js';
import type { Message } from '../structures/Message.js';
import type { InteractionEditReplyOptions, MessagePayload } from '../structures/MessagePayload.js';
import type { RawMessageData } from '../types/raw.js';
import { InteractionType, MessageFlags, type InteractionResponseType } from '../util/Enums.js';
import type { BaseInteraction } from './BaseInteraction.js';
import type { MessageComponentInteraction } from './MessageComponentInteraction.js';
import { attachHidden } from '../util/internal.js';
import { onComponents } from '../structures/collectorScope.js';

interface Answerable extends BaseInteraction {
  ephemeral: boolean | null;
  editReply(options: string | MessagePayload | InteractionEditReplyOptions): Promise<Message>;
  deleteReply(message?: string): Promise<void>;
  fetchReply(message?: string): Promise<Message>;
}

/**
 * What `reply()` and friends resolve with by default: a handle on the answer.
 */
export class InteractionResponse {
  /** The client. */
  public declare readonly client: Client<true>;
  /** The interaction answered. */
  public readonly interaction: Answerable;
  /** The id of the answer message when known, otherwise the interaction's id. */
  public readonly id: string;
  private readonly messageKnown: boolean;

  /**
   * @param interaction - The interaction answered
   * @param id - The id of the answer message, when known
   */
  public constructor(interaction: BaseInteraction, id?: string | null) {
    attachHidden(this, 'client', interaction.client);
    this.interaction = interaction as Answerable;
    this.id = id ?? interaction.id;
    this.messageKnown = Boolean(id);
  }

  private filterTarget(): { message?: string; channel?: string } {
    return this.messageKnown ? { message: this.id } : { channel: this.interaction.channelId ?? undefined };
  }

  /**
   * Waits for one button or select menu click on the answer.
   *
   * @param options - What to wait for and for how long
   */
  public awaitMessageComponent(options: AwaitMessageComponentOptions = {}): Promise<MessageComponentInteraction> {
    return awaitInteraction<MessageComponentInteraction>(this.client, onComponents(options, this.filterTarget()));
  }

  /**
   * Collects button and select menu clicks on the answer.
   *
   * @param options - What to collect and for how long
   */
  public createMessageComponentCollector(options: MessageComponentCollectorOptions = {}): InteractionCollector<MessageComponentInteraction> {
    return new InteractionCollector<MessageComponentInteraction>(this.client, onComponents(options, this.filterTarget()));
  }

  /**
   * Fetches the answer message.
   */
  public fetch(): Promise<Message> {
    return this.interaction.fetchReply();
  }

  /**
   * Deletes the answer.
   */
  public delete(): Promise<void> {
    return this.interaction.deleteReply();
  }

  /**
   * Edits the answer.
   *
   * @param options - The new content
   */
  public edit(options: string | MessagePayload | InteractionEditReplyOptions): Promise<Message> {
    return this.interaction.editReply(options);
  }
}

/**
 * What an answer resolves with when `withResponse: true` is passed.
 */
export class InteractionCallbackResponse {
  /** The client. */
  public declare readonly client: Client<true>;
  /** The interaction and how it was answered. */
  public interaction: {
    id: string;
    type: InteractionType;
    activityInstanceId: string | null;
    responseMessageId: string | null;
    responseMessageLoading: boolean | null;
    responseMessageEphemeral: boolean | null;
    readonly createdTimestamp: number;
    readonly createdAt: Date;
  };
  /** What the answer made. */
  public resource: { type: InteractionResponseType; message: Message | null; activityInstance: null } | null;

  /**
   * @param client - The client
   * @param interaction - The interaction answered
   * @param type - How it was answered
   * @param message - The answer message, when there is one
   */
  public constructor(client: Client, interaction: BaseInteraction & { ephemeral?: boolean | null }, type: InteractionResponseType, message: Message | null) {
    attachHidden(this, 'client', client);
    this.interaction = {
      id: interaction.id,
      type: interaction.type,
      activityInstanceId: null,
      responseMessageId: message?.id ?? null,
      responseMessageLoading: message ? message.flags.has(MessageFlags.Loading) : null,
      responseMessageEphemeral: interaction.ephemeral ?? null,
      get createdTimestamp() {
        return interaction.createdTimestamp;
      },
      get createdAt() {
        return interaction.createdAt;
      },
    };
    this.resource = { type, message, activityInstance: null };
  }

  /**
   * Builds the response from what Bisim answered.
   *
   * @internal
   */
  public static from(interaction: BaseInteraction, type: InteractionResponseType, data: unknown): InteractionCallbackResponse {
    let message: Message | null = null;
    if (data && typeof data === 'object' && 'id' in data && 'channelId' in data) {
      const raw = data as RawMessageData;
      const channel = interaction.channel;
      message = channel?.messages ? channel.messages._add({ guildId: interaction.guildId ?? undefined, ...raw }) : null;
    }
    return new InteractionCallbackResponse(interaction.client, interaction as BaseInteraction & { ephemeral?: boolean | null }, type, message);
  }
}

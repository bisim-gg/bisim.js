import type { Client } from '../client/Client.js';
import { BisimjsTypeError, ErrorCodes } from '../errors/index.js';
import { ActionRow, TextInputComponent } from '../structures/Component.js';
import { Message } from '../structures/Message.js';
import type { RawComponentData, RawInteractionData, RawMessageData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { ComponentType } from '../util/Enums.js';
import { BaseInteraction, type CacheType } from './BaseInteraction.js';
import { InteractionResponses, applyInteractionResponses } from './InteractionResponses.js';

/**
 * A field of a submitted modal.
 */
export interface ModalData {
  customId: string;
  type: ComponentType;
  value: string;
}

/**
 * The fields of a submitted modal.
 */
export class ModalSubmitFields {
  /** The rows of the modal. */
  public components: ActionRow<TextInputComponent>[];
  /** The fields, by custom id. */
  public fields: Collection<string, ModalData>;

  /**
   * @param components - The rows as Bisim sent them
   */
  public constructor(components: RawComponentData[]) {
    this.components = components.map((row) => new ActionRow<TextInputComponent>(row));
    this.fields = new Collection();
    for (const row of components) {
      for (const component of row.components ?? []) {
        if (component.customId) {
          this.fields.set(component.customId, { customId: component.customId, type: component.type, value: component.value ?? '' });
        }
      }
    }
  }

  /**
   * Gets a field by custom id.
   *
   * @param customId - The custom id
   * @param type - The type it must have
   */
  public getField(customId: string, type?: ComponentType): ModalData {
    const field = this.fields.get(customId);
    if (!field) throw new BisimjsTypeError(ErrorCodes.ModalSubmitInteractionFieldNotFound, customId);
    if (type !== undefined && type !== field.type) {
      throw new BisimjsTypeError(ErrorCodes.ModalSubmitInteractionFieldType, customId, field.type, type);
    }
    return field;
  }

  /**
   * Gets what the user typed in a text input.
   *
   * @param customId - The text input's custom id
   */
  public getTextInputValue(customId: string): string {
    return this.getField(customId, ComponentType.TextInput).value;
  }
}

/**
 * A submitted modal.
 *
 * @example
 * ```js
 * if (interaction.isModalSubmit()) {
 *   const nickname = interaction.fields.getTextInputValue('nickname');
 *   await interaction.reply(`Signed up as ${nickname}.`);
 * }
 * ```
 */
export class ModalSubmitInteraction<Cached extends CacheType = CacheType> extends BaseInteraction<Cached> {
  /** The modal's custom id. */
  public customId: string;
  /** The rows of the modal. */
  public components: ActionRow<TextInputComponent>[];
  /** The fields. */
  public fields: ModalSubmitFields;
  /** The message whose component opened the modal, or `null`. */
  public message: Message | null;
  /** Whether the answer was deferred. */
  public deferred = false;
  /** Whether the answer is ephemeral. */
  public ephemeral: boolean | null = null;
  /** Whether the interaction was answered. */
  public replied = false;
  /**
   * The answer message, when Bisim returned it.
   *
   * @internal
   */
  public _replyMessage: RawMessageData | null = null;
  /**
   * Whether a deferral was filled in.
   *
   * @internal
   */
  public _deferralFilled = false;

  /**
   * @param client - The client
   * @param data - The interaction payload
   */
  public constructor(client: Client, data: RawInteractionData) {
    super(client, data);
    this.customId = data.data?.customId ?? '';
    let rows = data.data?.components;
    if (!rows?.length && data.data?.fields) {
      rows = data.data.fields.map((field) => ({
        type: ComponentType.ActionRow,
        components: [{ type: field.type ?? ComponentType.TextInput, customId: field.customId, value: field.value }],
      }));
    }
    this.fields = new ModalSubmitFields(rows ?? []);
    this.components = this.fields.components;
    if (data.message) {
      const channel = this.channel;
      this.message = channel?.messages ? channel.messages._add({ guildId: data.guildId ?? undefined, ...data.message }) : new Message(client, data.message);
    } else {
      this.message = null;
    }
  }

  /**
   * Whether the modal was opened from a component on a message (so `update` can edit it).
   */
  public isFromMessage(): this is ModalSubmitInteraction<Cached> & { message: Message } {
    return this.message !== null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface ModalSubmitInteraction<Cached extends CacheType = CacheType> extends Omit<InteractionResponses, 'showModal' | 'awaitModalSubmit'> {}

applyInteractionResponses(ModalSubmitInteraction, ['showModal', 'awaitModalSubmit']);

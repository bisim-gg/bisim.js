import type { ModalBuilder } from '../builders/components.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { isRouteMissing } from '../rest/missing.js';
import { Routes } from '../rest/Routes.js';
import type { TextBasedChannel } from '../structures/channels/index.js';
import { type AwaitModalSubmitOptions, awaitInteraction } from '../structures/Collectors.js';
import { Message } from '../structures/Message.js';
import {
  type InteractionEditReplyOptions,
  type InteractionReplyOptions,
  type InteractionUpdateOptions,
  MessagePayload,
} from '../structures/MessagePayload.js';
import type { RawMessageData } from '../types/raw.js';
import { InteractionResponseType, InteractionType, MessageFlags } from '../util/Enums.js';
import { toBisimComponent } from '../util/Transformers.js';
import { notSupported } from '../util/Util.js';
import type { BaseInteraction } from './BaseInteraction.js';
import { InteractionCallbackResponse, InteractionResponse } from './InteractionResponse.js';
import type { ModalSubmitInteraction } from './ModalSubmitInteraction.js';

/**
 * Options for deferring a reply.
 */
export interface InteractionDeferReplyOptions {
  /** Whether only the person who ran the command sees the reply. */
  ephemeral?: boolean;
  /** Message flags (`Ephemeral`). */
  flags?: number | MessageFlags | string | readonly (number | string)[];
  /** Whether to resolve with the reply message. */
  fetchReply?: boolean;
  /** Whether to resolve with an {@link InteractionCallbackResponse}. */
  withResponse?: boolean;
}

/**
 * Options for deferring an update.
 */
export interface InteractionDeferUpdateOptions {
  fetchReply?: boolean;
  withResponse?: boolean;
}

/**
 * The state the answering methods keep.
 */
interface ResponseHost extends BaseInteraction {
  deferred: boolean;
  replied: boolean;
  ephemeral: boolean | null;
  /** @internal */
  _replyMessage: RawMessageData | null;
  /** @internal */
  _deferralFilled: boolean;
  message?: Message | null;
  fetchReply(message?: string | { id: string }): Promise<Message>;
}

function toMessage(host: ResponseHost, data: RawMessageData): Message {
  const channel = host.channel as TextBasedChannel | null;
  const withGuild = { guildId: host.guildId ?? undefined, ...data };
  if (channel?.messages) return channel.messages._add(withGuild, !data.ephemeral);
  return new Message(host.client, withGuild);
}

function isMessageData(data: unknown): data is RawMessageData {
  return Boolean(data && typeof data === 'object' && 'id' in data && 'channelId' in data);
}

/** The files a message the interaction answered with has now, when bisim.js knows them. */
function knownAttachments(host: ResponseHost, id: string): { id: string; name: string }[] | null {
  if (id === '@original' && host._replyMessage?.attachments) {
    return host._replyMessage.attachments.map((attachment) => ({ id: attachment.id, name: attachment.fileName }));
  }
  const messageId = id === '@original' ? host._replyMessage?.id : id;
  const channel = host.channel as TextBasedChannel | null;
  const cached = messageId ? channel?.messages?.cache.get(messageId) : undefined;
  if (cached && !cached.partial) return [...cached.attachments.values()].map((attachment) => ({ id: attachment.id, name: attachment.name }));
  return null;
}

/**
 * The answering methods every repliable interaction has: `reply`, `deferReply`, `editReply`, `deleteReply`,
 * `fetchReply`, `followUp`, and for components `update` and `deferUpdate`. They are applied to the
 * interaction classes.
 *
 * @internal
 */
export class InteractionResponses {
  /**
   * Says "the bot is thinking" now and answers later with `editReply()`.
   *
   * @param options - Whether the answer is ephemeral, and what to resolve with
   */
  public deferReply(this: ResponseHost, options: InteractionDeferReplyOptions & { withResponse: true }): Promise<InteractionCallbackResponse>;
  public deferReply(this: ResponseHost, options: InteractionDeferReplyOptions & { fetchReply: true }): Promise<Message>;
  public deferReply(this: ResponseHost, options?: InteractionDeferReplyOptions): Promise<InteractionResponse>;
  public async deferReply(this: ResponseHost, options: InteractionDeferReplyOptions = {}): Promise<InteractionResponse | Message | InteractionCallbackResponse> {
    mustBeUnanswered(this);
    const flags = MessagePayload.create(this, options as Record<string, unknown>, {}, 'interaction').resolveFlags() & MessageFlags.Ephemeral;
    const data = await this.client.rest.post(Routes.interactionCallback(this.id, this.token), {
      auth: false,
      body: { type: InteractionResponseType.DeferredChannelMessageWithSource, data: flags ? { flags } : undefined },
    });
    this.deferred = true;
    this.ephemeral = Boolean(flags);
    if (isMessageData(data)) this._replyMessage = data;
    if (options.withResponse) return InteractionCallbackResponse.from(this, InteractionResponseType.DeferredChannelMessageWithSource, data);
    if (options.fetchReply) return this.fetchReply();
    return new InteractionResponse(this, isMessageData(data) ? data.id : null);
  }

  /**
   * Answers with a message.
   *
   * @param options - The answer
   * @example
   * ```js
   * await interaction.reply({ content: 'Pong!', flags: MessageFlags.Ephemeral });
   * ```
   */
  public reply(this: ResponseHost, options: InteractionReplyOptions & { withResponse: true }): Promise<InteractionCallbackResponse>;
  public reply(this: ResponseHost, options: InteractionReplyOptions & { fetchReply: true }): Promise<Message>;
  public reply(this: ResponseHost, options: string | MessagePayload | InteractionReplyOptions): Promise<InteractionResponse>;
  public async reply(this: ResponseHost, options: string | MessagePayload | InteractionReplyOptions): Promise<InteractionResponse | Message | InteractionCallbackResponse> {
    mustBeUnanswered(this);
    const payload = MessagePayload.create(this, options as Record<string, unknown>, {}, 'interaction');
    payload.resolveBody();
    await payload.resolveFiles();
    const body = payload.body!;
    const data = await this.client.rest.post(Routes.interactionCallback(this.id, this.token), {
      auth: false,
      body: { type: InteractionResponseType.ChannelMessageWithSource, data: body },
      files: payload.files?.length ? payload.files : undefined,
    });
    this.replied = true;
    this.ephemeral = Boolean(((body.flags as number | undefined) ?? 0) & MessageFlags.Ephemeral);
    if (isMessageData(data)) this._replyMessage = data;
    const resolved = typeof options === 'object' && !(options instanceof MessagePayload) ? options : {};
    if (resolved.withResponse) return InteractionCallbackResponse.from(this, InteractionResponseType.ChannelMessageWithSource, data);
    if (resolved.fetchReply) return isMessageData(data) ? toMessage(this, data) : this.fetchReply();
    return new InteractionResponse(this, isMessageData(data) ? data.id : null);
  }

  /**
   * Fetches the reply, or a followup by id.
   *
   * @param message - `@original` (the reply) or a followup's id
   */
  public async fetchReply(this: ResponseHost, message: string | { id: string } = '@original'): Promise<Message> {
    const id = typeof message === 'string' ? message : message.id;
    try {
      const data = (await this.client.rest.get(Routes.interactionMessage(this.id, this.token, id), { auth: false })) as RawMessageData;
      return toMessage(this, data);
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
      if (id === '@original' && this._replyMessage) return toMessage(this, this._replyMessage);
      if (id === '@original' && this.message) return this.message;
      throw error;
    }
  }

  /**
   * Edits the reply (after a deferral this sends the answer), or a followup.
   *
   * @param options - The new content, and optionally which message
   */
  public async editReply(this: ResponseHost, options: string | MessagePayload | InteractionEditReplyOptions): Promise<Message> {
    mustBeAnswered(this);
    const resolved = typeof options === 'string' ? { content: options } : options instanceof MessagePayload ? options.options : options;
    const target = (resolved as InteractionEditReplyOptions).message;
    const id = target === undefined ? '@original' : typeof target === 'string' ? target : target.id;
    const payload = MessagePayload.create(this, options as Record<string, unknown>, {}, 'edit');
    payload.existingAttachments = knownAttachments(this, id);
    payload.resolveBody();
    await payload.resolveFiles();
    const body = { ...payload.body! };
    const files = payload.files?.length ? payload.files : undefined;
    try {
      const data = (await this.client.rest.patch(Routes.interactionMessage(this.id, this.token, id), { auth: false, body, files })) as RawMessageData;
      this.replied = true;
      if (id === '@original') this._deferralFilled = true;
      return isMessageData(data) ? toMessage(this, data) : this.fetchReply(id);
    } catch (error) {
      if (!isRouteMissing(error) || id !== '@original') throw error;
      if (this.deferred && !this._deferralFilled) {
        const data = (await this.client.rest.post(Routes.interactionFollowup(this.id, this.token), {
          auth: false,
          body: this.ephemeral ? { ...body, flags: MessageFlags.Ephemeral } : body,
          files,
        })) as RawMessageData;
        this._deferralFilled = true;
        this.replied = true;
        if (isMessageData(data)) this._replyMessage = data;
        return toMessage(this, data);
      }
      if (this._replyMessage && !this.ephemeral) {
        const data = (await this.client.rest.patch(Routes.channelMessage(this._replyMessage.channelId, this._replyMessage.id), { body, files })) as RawMessageData;
        return toMessage(this, data);
      }
      throw error;
    }
  }

  /**
   * Deletes the reply, or a followup.
   *
   * @param message - `@original` (the reply) or a followup's id
   */
  public async deleteReply(this: ResponseHost, message: string | { id: string } = '@original'): Promise<void> {
    const id = typeof message === 'string' ? message : message.id;
    try {
      await this.client.rest.delete(Routes.interactionMessage(this.id, this.token, id), { auth: false });
    } catch (error) {
      if (!isRouteMissing(error)) throw error;
      const known = id === '@original' ? this._replyMessage : null;
      if (known && !this.ephemeral) {
        await this.client.rest.delete(Routes.channelMessage(known.channelId, known.id));
        return;
      }
      throw error;
    }
  }

  /**
   * Sends another message about the same interaction (within 15 minutes).
   *
   * @param options - The message
   */
  public async followUp(this: ResponseHost, options: string | MessagePayload | InteractionReplyOptions): Promise<Message> {
    mustBeAnswered(this);
    const payload = MessagePayload.create(this, options as Record<string, unknown>, {}, 'interaction');
    payload.resolveBody();
    await payload.resolveFiles();
    const data = (await this.client.rest.post(Routes.interactionFollowup(this.id, this.token), {
      auth: false,
      body: payload.body,
      files: payload.files?.length ? payload.files : undefined,
    })) as RawMessageData;
    return toMessage(this, data);
  }

  /**
   * Acknowledges a component interaction without changing the message yet.
   *
   * @param options - What to resolve with
   */
  public deferUpdate(this: ResponseHost, options: InteractionDeferUpdateOptions & { withResponse: true }): Promise<InteractionCallbackResponse>;
  public deferUpdate(this: ResponseHost, options: InteractionDeferUpdateOptions & { fetchReply: true }): Promise<Message>;
  public deferUpdate(this: ResponseHost, options?: InteractionDeferUpdateOptions): Promise<InteractionResponse>;
  public async deferUpdate(this: ResponseHost, options: InteractionDeferUpdateOptions = {}): Promise<InteractionResponse | Message | InteractionCallbackResponse> {
    mustBeUnanswered(this);
    const data = await this.client.rest.post(Routes.interactionCallback(this.id, this.token), {
      auth: false,
      body: { type: InteractionResponseType.DeferredMessageUpdate },
    });
    this.deferred = true;
    this._deferralFilled = true;
    if (options.withResponse) return InteractionCallbackResponse.from(this, InteractionResponseType.DeferredMessageUpdate, data);
    if (options.fetchReply) return this.fetchReply();
    return new InteractionResponse(this, this.message?.id ?? null);
  }

  /**
   * Edits the message a component sits on, as the answer.
   *
   * @param options - The new content
   */
  public update(this: ResponseHost, options: InteractionUpdateOptions & { withResponse: true }): Promise<InteractionCallbackResponse>;
  public update(this: ResponseHost, options: InteractionUpdateOptions & { fetchReply: true }): Promise<Message>;
  public update(this: ResponseHost, options: string | MessagePayload | InteractionUpdateOptions): Promise<InteractionResponse>;
  public async update(this: ResponseHost, options: string | MessagePayload | InteractionUpdateOptions): Promise<InteractionResponse | Message | InteractionCallbackResponse> {
    mustBeUnanswered(this);
    const payload = MessagePayload.create(this, options as Record<string, unknown>, {}, 'edit');
    if (this.message && !this.message.partial) {
      payload.existingAttachments = [...this.message.attachments.values()].map((attachment) => ({ id: attachment.id, name: attachment.name }));
    }
    payload.resolveBody();
    await payload.resolveFiles();
    const data = await this.client.rest.post(Routes.interactionCallback(this.id, this.token), {
      auth: false,
      body: { type: InteractionResponseType.UpdateMessage, data: payload.body },
      files: payload.files?.length ? payload.files : undefined,
    });
    this.replied = true;
    this._deferralFilled = true;
    const resolved = typeof options === 'object' && !(options instanceof MessagePayload) ? options : {};
    if (resolved.withResponse) return InteractionCallbackResponse.from(this, InteractionResponseType.UpdateMessage, data);
    if (resolved.fetchReply) return isMessageData(data) ? toMessage(this, data) : this.fetchReply();
    return new InteractionResponse(this, isMessageData(data) ? data.id : (this.message?.id ?? null));
  }

  /**
   * Shows a modal (a form) to the user.
   *
   * @param modal - The modal
   */
  public async showModal(this: ResponseHost, modal: ModalBuilder | { toJSON(): unknown } | Record<string, unknown>, options: { withResponse?: boolean } = {}): Promise<undefined | InteractionCallbackResponse> {
    mustBeUnanswered(this);
    const data =
      typeof (modal as { toJSON?: unknown }).toJSON === 'function' ? (modal as { toJSON(): unknown }).toJSON() : modalFromPlain(modal as Record<string, unknown>);
    const callback = Routes.interactionCallback(this.id, this.token);
    const response = await this.client.rest.post(callback, { auth: false, body: { type: InteractionResponseType.Modal, data } });
    this.replied = true;
    if (options.withResponse) return InteractionCallbackResponse.from(this, InteractionResponseType.Modal, response);
    return undefined;
  }

  /**
   * Waits for the user to submit a modal this interaction showed.
   *
   * @param options - The filter and how long to wait (required)
   */
  public awaitModalSubmit(this: ResponseHost, options: AwaitModalSubmitOptions): Promise<ModalSubmitInteraction> {
    if (typeof options?.time !== 'number') throw new BisimjsError(ErrorCodes.InvalidType, 'time', 'number');
    const userId = this.user.id;
    const filter = options.filter;
    return awaitInteraction<ModalSubmitInteraction>(this.client, {
      interactionType: InteractionType.ModalSubmit,
      time: options.time,
      filter: async (interaction) => interaction.user.id === userId && (filter ? await filter(interaction) : true),
    });
  }

  /** Not on Bisim: premium. */
  public sendPremiumRequired(this: ResponseHost): Promise<never> {
    return notSupported('Premium');
  }

  /** Not on Bisim: activities. */
  public launchActivity(this: ResponseHost, _options?: unknown): Promise<never> {
    return notSupported('Activities');
  }
}

function modalFromPlain(modal: Record<string, unknown>): Record<string, unknown> {
  return {
    customId: modal.customId ?? modal.custom_id,
    title: modal.title,
    components: ((modal.components as unknown[]) ?? []).map((row) => toBisimComponent(row)),
  };
}

/**
 * The names of the answering methods, by which interaction classes get them.
 *
 * @internal
 */
export type InteractionResponseMethod = Exclude<keyof InteractionResponses, 'constructor'>;

/**
 * Copies the answering methods onto an interaction class.
 *
 * @param target - The class
 * @param ignore - Methods to leave out
 * @internal
 */
export function applyInteractionResponses(target: { prototype: object }, ignore: InteractionResponseMethod[] = []): void {
  for (const prop of Object.getOwnPropertyNames(InteractionResponses.prototype)) {
    if (prop === 'constructor' || ignore.includes(prop as InteractionResponseMethod)) continue;
    Object.defineProperty(target.prototype, prop, Object.getOwnPropertyDescriptor(InteractionResponses.prototype, prop)!);
  }
}

/** Throws when the interaction was already answered or deferred. */
function mustBeUnanswered(interaction: { deferred: boolean; replied: boolean }): void {
  if (interaction.deferred || interaction.replied) throw new BisimjsError(ErrorCodes.InteractionAlreadyReplied);
}

/** Throws when the interaction was neither answered nor deferred yet. */
function mustBeAnswered(interaction: { deferred: boolean; replied: boolean }): void {
  if (!(interaction.deferred || interaction.replied)) throw new BisimjsError(ErrorCodes.InteractionNotReplied);
}

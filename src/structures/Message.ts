import type { Client } from '../client/Client.js';
import { BisimjsError, ErrorCodes } from '../errors/index.js';
import { ReactionManager } from '../managers/ReactionManager.js';
import { Routes } from '../rest/Routes.js';
import type { RawMessageData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { ChannelType, ComponentType, InteractionType, MessageFlags, MessageType } from '../util/Enums.js';
import { messageLink } from '../util/Formatters.js';
import { MessageFlagsBitField } from '../util/IntentsBitField.js';
import { PermissionFlagsBits } from '../util/PermissionsBitField.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { messageTypeFromBisim } from '../util/Transformers.js';
import { cleanContent, notSupported, toTimestamp } from '../util/Util.js';
import { Attachment } from './Attachment.js';
import { Base } from './Base.js';
import type { TextBasedChannel } from './channels/index.js';
import { ActionRow, type Component } from './Component.js';
import { Embed } from './Embed.js';
import { Sticker } from './Emoji.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import { type MessageMentionLists, MessageMentions } from './MessageMentions.js';
import { type MessageEditOptions, MessagePayload, type MessageReplyOptions } from './MessagePayload.js';
import type { MessageReaction } from './MessageReaction.js';
import { Poll } from './Poll.js';
import type { User } from './User.js';
import type { Webhook } from './Webhook.js';
import type { EmojiIdentifierResolvable } from '../managers/MessageManager.js';
import {
  type AwaitMessageComponentOptions,
  type AwaitReactionsOptions,
  type CollectorFilter,
  InteractionCollector,
  type MessageComponentCollectorOptions,
  ReactionCollector,
  type ReactionCollectorOptions,
  awaitCollector,
  awaitInteraction,
} from './Collectors.js';
import type { MessageComponentInteraction } from '../interactions/MessageComponentInteraction.js';
import { dateFrom } from '../util/internal.js';
import { onComponents } from './collectorScope.js';

/**
 * The message a message replies to.
 */
export interface MessageReference {
  channelId: string;
  guildId: string | undefined;
  messageId: string | undefined;
  /** Always 0 (a reply). */
  type: number;
}

/**
 * The command a bot's message answers.
 */
export interface MessageInteraction {
  /** Always `null` on Bisim (it does not say which interaction). */
  id: string | null;
  type: InteractionType;
  commandName: string;
  user: User;
}

const STICKER_TOKEN = /<sticker:(\d{1,20})>/g;

/**
 * A message.
 */
export class Message<InGuild extends boolean = boolean> extends Base {
  /** Brands the type so `inGuild()` narrows it (types only, nothing at runtime). */
  private declare readonly _inGuildBrand: InGuild;
  /** The id. */
  public id: string;
  /** The channel's id. */
  public channelId: string;
  /** The server's id, or `null` in a DM. */
  public guildId!: InGuild extends true ? string : string | null;
  /** When the message was sent, in milliseconds. */
  public createdTimestamp!: number;
  /** The type. */
  public type!: MessageType | null;
  /** Whether Bisim sent the message itself (a join, a pin, an AutoMod alert). */
  public system!: boolean | null;
  /** The text. */
  public content!: string | null;
  /** The author (a webhook message shows the webhook). */
  public author!: User | null;
  /** Whether the message is pinned. */
  public pinned!: boolean | null;
  /** Always `false` on Bisim. */
  public tts!: boolean | null;
  /** The nonce the sender attached. */
  public nonce!: string | null;
  /** The embeds. */
  public embeds!: Embed[];
  /** The rows of components. */
  public components!: ActionRow<Component>[];
  /** The attachments, by id. */
  public attachments!: Collection<string, Attachment>;
  /** The stickers in the message, by id. */
  public stickers!: Collection<string, Sticker>;
  /** Always `null` on Bisim. */
  public position!: number | null;
  /** When the message was last edited, in milliseconds. */
  public editedTimestamp!: number | null;
  /** The reactions. */
  public reactions!: ReactionManager;
  /** Who and what the message mentions. */
  public mentions!: MessageMentions;
  /** The webhook that sent it, or `null`. */
  public webhookId!: string | null;
  /** The bot whose command this message answers, or `null`. */
  public applicationId!: string | null;
  /** Always `null` on Bisim. */
  public activity!: null;
  /** The message's flags. */
  public flags!: Readonly<MessageFlagsBitField>;
  /** The message this one replies to. */
  public reference!: MessageReference | null;
  /** The command this message answers, or `null`. */
  public interaction!: MessageInteraction | null;
  /** The same as {@link Message.interaction}. */
  public interactionMetadata!: MessageInteraction | null;
  /** The poll, or `null`. */
  public poll!: Poll | null;
  /** Always `null` on Bisim. */
  public call!: null;
  /** Always empty on Bisim (no forwards). */
  public messageSnapshots!: Collection<string, unknown>;
  /** Whether the bot's deferred answer is still "thinking". */
  public loading!: boolean;
  /** Whether the message was deleted (set when a delete event arrives). */
  public deleted = false;
  /**
   * The message this one replies to, as Bisim embedded it.
   *
   * @internal
   */
  public _referencedMessage: RawMessageData['referencedMessage'] = null;

  /**
   * @param client - The client
   * @param data - The message from Bisim
   */
  public constructor(client: Client, data: RawMessageData) {
    super(client);
    this.id = data.id;
    this.channelId = data.channelId;
    this.createdTimestamp = data.createdAt ? (toTimestamp(data.createdAt) ?? SnowflakeUtil.timestampFrom(data.id)) : SnowflakeUtil.timestampFrom(data.id);
    this.guildId = (data.guildId || (client.channels.cache.get(data.channelId) as { guildId?: string | null } | undefined)?.guildId || null) as never;
    this.type = null;
    this.system = null;
    this.content = null;
    this.author = null;
    this.pinned = null;
    this.tts = false;
    this.nonce = null;
    this.embeds = [];
    this.components = [];
    this.attachments = new Collection<string, Attachment>();
    this.stickers = new Collection<string, Sticker>();
    this.position = null;
    this.editedTimestamp = null;
    this.reactions = new ReactionManager(this as Message);
    this.webhookId = null;
    this.applicationId = null;
    this.activity = null;
    this.flags = new MessageFlagsBitField(0).freeze();
    this.reference = null;
    this.interaction = null;
    this.interactionMetadata = null;
    this.poll = null;
    this.call = null;
    this.messageSnapshots = new Collection();
    this.loading = false;
    this.mentions = new MessageMentions(this, null);
    this._patch(data);
  }

  public override _patch(data: Partial<RawMessageData>): void {
    if (data.guildId) this.guildId = data.guildId as never;
    if ('content' in data) this.content = data.content ?? '';
    else if (this.content === null && data.author) this.content = '';
    if ('interaction' in data || 'type' in data) {
      this.type = messageTypeFromBisim(data.type ?? 'DEFAULT', Boolean(data.interaction ?? this.interaction));
      this.system = typeof data.type === 'string' && data.type.startsWith('SYSTEM_');
    }
    if (data.author) this.author = this.client.users._add(data.author);
    if ('pinned' in data) this.pinned = Boolean(data.pinned);
    if ('nonce' in data) this.nonce = data.nonce ?? null;
    if ('editedAt' in data) this.editedTimestamp = toTimestamp(data.editedAt);
    if ('webhookId' in data) this.webhookId = data.webhookId || null;
    if (data.embeds) this.embeds = data.embeds.map((embed) => new Embed(embed));
    if (data.components) {
      this.components = data.components.filter((row) => row.type === ComponentType.ActionRow).map((row) => new ActionRow(row));
    }
    if (data.attachments) {
      this.attachments = new Collection(data.attachments.map((attachment) => [attachment.id, new Attachment(attachment)]));
    }
    if (data.reactions) {
      this.reactions.cache.clear();
      for (const reaction of data.reactions) this.reactions._add(reaction);
    }
    if ('poll' in data) this.poll = data.poll ? new Poll(this.client, data.poll, this) : null;
    if ('loading' in data) this.loading = Boolean(data.loading);
    let flags = data.flags ?? this.flags.bitfield;
    if (this.loading) flags |= MessageFlags.Loading;
    else flags &= ~MessageFlags.Loading;
    if (data.ephemeral) flags |= MessageFlags.Ephemeral;
    this.flags = new MessageFlagsBitField(flags).freeze();
    if ('referencedMessageId' in data) {
      this.reference = data.referencedMessageId
        ? { channelId: this.channelId, guildId: this.guildId ?? undefined, messageId: data.referencedMessageId, type: 0 }
        : null;
    }
    if ('referencedMessage' in data) this._referencedMessage = data.referencedMessage ?? null;
    if ('interaction' in data) {
      if (data.interaction) {
        const user =
          this.client.users.cache.get(data.interaction.userId) ??
          this.client.users._add({ id: data.interaction.userId, username: data.interaction.username ?? '' });
        this.interaction = { id: null, type: InteractionType.ApplicationCommand, commandName: data.interaction.name, user };
        this.applicationId = this.author?.id ?? null;
      } else {
        this.interaction = null;
      }
      this.interactionMetadata = this.interaction;
    }
    if (data.member && data.author && !this.webhookId) {
      // The author's membership, sent with the message: cached, as discord.js does, so `message.member` works
      // without the member list.
      const guild = this.guild;
      if (guild) guild.members._add({ ...data.member, guildId: guild.id, userId: data.member.userId || data.author.id, user: data.author });
    }
    const lists = mentionListsOf(data);
    if ('content' in data || data.author || lists) {
      this.stickers = new Collection();
      for (const match of (this.content ?? '').matchAll(STICKER_TOKEN)) {
        const id = match[1]!;
        const known = this.guild?.stickers.cache.get(id);
        this.stickers.set(id, known ?? new Sticker(this.client, { id }));
      }
      this.mentions = new MessageMentions(this, this._referencedMessage?.author ?? null, lists);
    }
  }

  /**
   * Whether this message is partial (only its id and channel are known).
   */
  public get partial(): boolean {
    const complete = typeof this.content === 'string' && this.author !== null;
    return !complete;
  }

  /**
   * When the message was sent.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * When the message was last edited, or `null`.
   */
  public get editedAt(): Date | null {
    return this.editedTimestamp === null ? null : new Date(this.editedTimestamp);
  }

  /**
   * The channel.
   */
  public get channel(): TextBasedChannel {
    return this.client.channels.cache.get(this.channelId) as TextBasedChannel;
  }

  /**
   * The server, or `null` in a DM.
   */
  public get guild(): InGuild extends true ? Guild : Guild | null {
    return (this.guildId ? (this.client.guilds.cache.get(this.guildId) ?? null) : null) as never;
  }

  /**
   * The author as a member of the server, or `null`.
   */
  public get member(): GuildMember | null {
    if (!this.author || !this.guild) return null;
    return this.guild.members.cache.get(this.author.id) ?? null;
  }

  /**
   * Always `false` on Bisim (no threads).
   */
  public get hasThread(): boolean {
    return false;
  }

  /**
   * Always `null` on Bisim (no threads).
   */
  public get thread(): null {
    return null;
  }

  /**
   * The link to the message: `https://bisim.gg/channels/{guildId or @me}/{channelId}/{messageId}`.
   */
  public get url(): string {
    return messageLink(this.channelId, this.id, this.guildId ?? undefined);
  }

  /**
   * The content with mentions replaced by names.
   */
  public get cleanContent(): string | null {
    return this.content === null ? null : cleanContent(this.content, this.channel as never);
  }

  /**
   * Whether the bot can edit this message (it wrote it).
   */
  public get editable(): boolean {
    return Boolean(this.author && this.author.id === this.client.user?.id && !this.webhookId);
  }

  /**
   * Whether the bot can delete this message.
   */
  public get deletable(): boolean {
    if (this.deleted) return false;
    if (this.author?.id === this.client.user?.id) return true;
    if (!this.guild) return false;
    const channel = this.channel as { permissionsFor?: (member: unknown) => { has(bit: bigint): boolean } | null };
    return channel?.permissionsFor?.(this.client.user)?.has(PermissionFlagsBits.ManageMessages) ?? false;
  }

  /**
   * Whether the bot can bulk delete this message.
   */
  public get bulkDeletable(): boolean {
    return this.deletable && this.guild !== null && Date.now() - this.createdTimestamp < 1_209_600_000;
  }

  /**
   * Whether the bot can pin this message.
   */
  public get pinnable(): boolean {
    if (this.system === true) return false;
    if (this.guild === null) return true;
    const channel = this.channel as { permissionsFor?: (member: unknown) => { has(bit: bigint): boolean } | null };
    return channel?.permissionsFor?.(this.client.user)?.has(PermissionFlagsBits.ManageMessages) ?? false;
  }

  /**
   * Always `false` on Bisim (no announcement channels).
   */
  public get crosspostable(): boolean {
    return false;
  }

  /**
   * Whether the message was sent in a server.
   */
  public inGuild(): this is Message<true> {
    return Boolean(this.guildId);
  }

  /**
   * Edits the message (the bot must have written it).
   *
   * @param options - The new content
   */
  public async edit(options: string | MessagePayload | MessageEditOptions): Promise<Message> {
    return this.channel.messages.edit(this.id, options);
  }

  /**
   * Deletes the message.
   */
  public async delete(): Promise<Message> {
    await this.client.rest.delete(Routes.channelMessage(this.channelId, this.id));
    this.deleted = true;
    this.channel?.messages?.cache.delete(this.id);
    return this;
  }

  /**
   * Replies to the message.
   *
   * @param options - The reply
   * @example
   * ```js
   * await message.reply('Pong!');
   * ```
   */
  public reply(options: string | MessagePayload | MessageReplyOptions): Promise<Message> {
    const reply = { messageReference: this.id, failIfNotExists: true };
    if (!(options instanceof MessagePayload)) {
      const resolved = typeof options === 'string' ? { content: options } : { ...options };
      if (resolved.failIfNotExists !== undefined) reply.failIfNotExists = resolved.failIfNotExists;
      return this.channel.send({ ...resolved, reply });
    }
    Object.assign(options.options, { reply });
    return this.channel.send(options);
  }

  /**
   * Reacts to the message.
   *
   * @param emoji - A Unicode emoji, a custom emoji token or id, or an emoji structure
   */
  public async react(emoji: EmojiIdentifierResolvable): Promise<MessageReaction> {
    return this.channel.messages.react(this, emoji);
  }

  /**
   * Pins the message.
   *
   * @param reason - Why
   */
  public async pin(reason?: string): Promise<Message> {
    await this.client.rest.put(Routes.channelPin(this.channelId, this.id), { reason });
    this.pinned = true;
    return this;
  }

  /**
   * Unpins the message.
   *
   * @param reason - Why
   */
  public async unpin(reason?: string): Promise<Message> {
    await this.client.rest.delete(Routes.channelPin(this.channelId, this.id), { reason });
    this.pinned = false;
    return this;
  }

  /**
   * Fetches the message again.
   *
   * @param force - Whether to skip the cache
   */
  public fetch(force = true): Promise<Message> {
    return this.channel.messages.fetch({ force, message: this.id });
  }

  /**
   * Fetches the message this one replies to.
   */
  public async fetchReference(): Promise<Message> {
    if (!this.reference?.messageId) throw new BisimjsError(ErrorCodes.MessageReferenceMissing);
    return this.channel.messages.fetch(this.reference.messageId);
  }

  /**
   * Fetches the webhook that sent this message.
   */
  public async fetchWebhook(): Promise<Webhook> {
    const { webhookId } = this;
    if (webhookId === null) throw new BisimjsError(ErrorCodes.WebhookMessage);
    return this.client.fetchWebhook(webhookId);
  }

  /**
   * Finds a component on this message by its custom id.
   *
   * @param customId - The custom id
   */
  public resolveComponent(customId: string): Component | null {
    for (const row of this.components) {
      const found = row.components.find((component) => (component.data as { customId?: string }).customId === customId);
      if (found) return found;
    }
    return null;
  }

  /** Not on Bisim: announcement channels. */
  public crosspost(): Promise<Message> {
    return notSupported('Crossposting');
  }

  /** Not on Bisim: forwarding messages. */
  public forward(_channel: unknown): Promise<Message> {
    return notSupported('Forwarding messages');
  }

  /** Not on Bisim: threads. */
  public startThread(_options: unknown): Promise<never> {
    return notSupported('Threads');
  }

  /**
   * Hides or shows the message's embeds (the bot must have written it). With them hidden, `embeds` is empty.
   *
   * @param suppress - Whether to hide them
   */
  public suppressEmbeds(suppress = true): Promise<Message> {
    const flags = new MessageFlagsBitField(this.flags.bitfield & MessageFlags.SuppressEmbeds);
    if (suppress) flags.add(MessageFlags.SuppressEmbeds);
    else flags.remove(MessageFlags.SuppressEmbeds);
    return this.edit({ flags: flags.bitfield });
  }

  /**
   * Removes every file from the message (the bot must have written it).
   */
  public removeAttachments(): Promise<Message> {
    return this.edit({ attachments: [] });
  }

  /**
   * Collects button and select menu clicks on this message.
   *
   * @param options - What to collect and for how long
   */
  public createMessageComponentCollector(options: MessageComponentCollectorOptions = {}): InteractionCollector<MessageComponentInteraction> {
    return new InteractionCollector<MessageComponentInteraction>(this.client, onComponents(options, { message: this }));
  }

  /**
   * Waits for one button or select menu click on this message.
   *
   * @param options - What to wait for and for how long
   */
  public awaitMessageComponent(options: AwaitMessageComponentOptions = {}): Promise<MessageComponentInteraction> {
    return awaitInteraction<MessageComponentInteraction>(this.client, onComponents(options, { message: this }));
  }

  /**
   * Collects reactions on this message.
   *
   * @param options - What to collect and for how long
   */
  public createReactionCollector(options: ReactionCollectorOptions = {}): ReactionCollector {
    const collector = new ReactionCollector(this, options);
    return collector;
  }

  /**
   * Waits for reactions on this message.
   *
   * @param options - What to wait for and for how long
   */
  public awaitReactions(options: AwaitReactionsOptions = {}): Promise<Collection<string, MessageReaction>> {
    return awaitCollector(this.createReactionCollector(options), options.errors);
  }

  /**
   * Whether this message is the same as another.
   *
   * @param message - The other message
   */
  public equals(message: Message): boolean {
    if (!message) return false;
    const fields = ['id', 'content', 'editedTimestamp', 'pinned'] as const;
    return this.author?.id === message.author?.id && fields.every((field) => this[field] === message[field]);
  }

  /**
   * The content of the message.
   */
  public override toString(): string {
    return this.content ?? '';
  }

  public override toJSON(): unknown {
    return {
      id: this.id,
      channelId: this.channelId,
      guildId: this.guildId,
      type: this.type,
      content: this.content,
      authorId: this.author?.id ?? null,
      pinned: this.pinned,
      createdTimestamp: this.createdTimestamp,
      editedTimestamp: this.editedTimestamp,
      embeds: this.embeds.map((embed) => embed.toJSON()),
      components: this.components.map((row) => row.toJSON()),
      attachments: [...this.attachments.values()].map((attachment) => attachment.toJSON()),
      webhookId: this.webhookId,
      flags: this.flags.bitfield,
      reference: this.reference,
    };
  }
}

/**
 * The mention lists Bisim sent with a message (`mentions` on events, `mentionIds` on REST, and the roles and
 * `@everyone` on both), or `null` when it sent none and the text has to be read instead.
 */
function mentionListsOf(data: Partial<RawMessageData>): MessageMentionLists | null {
  const sent = data.mentions !== undefined || data.mentionIds !== undefined || data.mentionRoleIds !== undefined || data.mentionEveryone !== undefined;
  if (!sent) return null;
  return { users: data.mentions, userIds: data.mentionIds, roleIds: data.mentionRoleIds ?? [], everyone: data.mentionEveryone ?? false };
}

/**
 * Whether a channel type holds messages on Bisim.
 *
 * @internal
 */
export function isMessageChannelType(type: ChannelType): boolean {
  return type === ChannelType.GuildText || type === ChannelType.DM || type === ChannelType.GroupDM;
}

/**
 * A filter for collectors.
 */
export type { CollectorFilter };

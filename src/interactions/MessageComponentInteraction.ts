import type { Client } from '../client/Client.js';
import type { Channel } from '../structures/channels/index.js';
import type { Component } from '../structures/Component.js';
import type { GuildMember } from '../structures/GuildMember.js';
import { Message } from '../structures/Message.js';
import type { Role } from '../structures/Role.js';
import type { User } from '../structures/User.js';
import type { RawInteractionData, RawMessageData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { ComponentType } from '../util/Enums.js';
import { BaseInteraction, type CacheType } from './BaseInteraction.js';
import { type CommandInteractionResolvedData, transformResolved } from './CommandInteractionOptionResolver.js';
import { InteractionResponses, applyInteractionResponses } from './InteractionResponses.js';

/**
 * A button press or a select menu choice on a message.
 */
export class MessageComponentInteraction<Cached extends CacheType = CacheType> extends BaseInteraction<Cached> {
  /** The message the component sits on. */
  public message: Message;
  /** The component's custom id. */
  public customId: string;
  /** The component's type. */
  public componentType: ComponentType;
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
    this.componentType = data.data?.componentType ?? ComponentType.Button;
    const raw = data.message ?? ({ id: '0', channelId: data.channelId ?? '' } as RawMessageData);
    const channel = this.channel;
    this.message = channel?.messages ? channel.messages._add({ guildId: data.guildId ?? undefined, ...raw }) : new Message(client, { guildId: data.guildId ?? undefined, ...raw });
  }

  /**
   * The component that was used.
   */
  public get component(): Component | null {
    return this.message.resolveComponent(this.customId);
  }

  /**
   * The interaction's webhook: `send` posts a followup.
   */
  public get webhook(): { id: string; token: string; send: (options: unknown) => Promise<Message> } {
    return {
      id: this.applicationId,
      token: this.token,
      send: (options) => (this as unknown as InteractionResponses).followUp.call(this as never, options as never),
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface MessageComponentInteraction<Cached extends CacheType = CacheType> extends InteractionResponses {}

applyInteractionResponses(MessageComponentInteraction);

/**
 * A button press.
 */
export class ButtonInteraction<Cached extends CacheType = CacheType> extends MessageComponentInteraction<Cached> {}

abstract class SelectMenuInteractionBase<Cached extends CacheType = CacheType> extends MessageComponentInteraction<Cached> {
  /** The values chosen (option values, or ids). */
  public values: string[];
  /**
   * What the values point at.
   *
   * @internal
   */
  protected readonly resolvedData: CommandInteractionResolvedData;

  public constructor(client: Client, data: RawInteractionData) {
    super(client, data);
    this.values = data.data?.values ?? [];
    this.resolvedData = transformResolved(client, this.guild as never, data.data?.resolved);
  }
}

/**
 * A choice in a select menu of the bot's own options.
 */
export class StringSelectMenuInteraction<Cached extends CacheType = CacheType> extends SelectMenuInteractionBase<Cached> {}

/**
 * The old name of {@link StringSelectMenuInteraction}.
 *
 * @deprecated Use {@link StringSelectMenuInteraction}
 */
export const SelectMenuInteraction = StringSelectMenuInteraction;

function pickUsers(interaction: SelectMenuInteractionBase, resolved: CommandInteractionResolvedData): Collection<string, User> {
  const users = new Collection<string, User>();
  for (const id of interaction.values) {
    const user = resolved.users?.get(id) ?? interaction.client.users.cache.get(id);
    if (user) users.set(id, user);
  }
  return users;
}

function pickMembers(interaction: SelectMenuInteractionBase, resolved: CommandInteractionResolvedData): Collection<string, GuildMember> {
  const members = new Collection<string, GuildMember>();
  for (const id of interaction.values) {
    const member = resolved.members?.get(id) ?? interaction.guild?.members.cache.get(id);
    if (member) members.set(id, member);
  }
  return members;
}

function pickRoles(interaction: SelectMenuInteractionBase, resolved: CommandInteractionResolvedData): Collection<string, Role> {
  const roles = new Collection<string, Role>();
  for (const id of interaction.values) {
    const role = resolved.roles?.get(id) ?? interaction.guild?.roles.cache.get(id);
    if (role) roles.set(id, role);
  }
  return roles;
}

/**
 * A choice in a select menu of members.
 */
export class UserSelectMenuInteraction<Cached extends CacheType = CacheType> extends SelectMenuInteractionBase<Cached> {
  /** The users chosen. */
  public get users(): Collection<string, User> {
    return pickUsers(this, this.resolvedData);
  }

  /** The users chosen, as members. */
  public get members(): Collection<string, GuildMember> {
    return pickMembers(this, this.resolvedData);
  }
}

/**
 * A choice in a select menu of roles.
 */
export class RoleSelectMenuInteraction<Cached extends CacheType = CacheType> extends SelectMenuInteractionBase<Cached> {
  /** The roles chosen. */
  public get roles(): Collection<string, Role> {
    return pickRoles(this, this.resolvedData);
  }
}

/**
 * A choice in a select menu of users and roles.
 */
export class MentionableSelectMenuInteraction<Cached extends CacheType = CacheType> extends SelectMenuInteractionBase<Cached> {
  /** The users chosen. */
  public get users(): Collection<string, User> {
    return pickUsers(this, this.resolvedData);
  }

  /** The users chosen, as members. */
  public get members(): Collection<string, GuildMember> {
    return pickMembers(this, this.resolvedData);
  }

  /** The roles chosen. */
  public get roles(): Collection<string, Role> {
    return pickRoles(this, this.resolvedData);
  }
}

/**
 * A choice in a select menu of channels.
 */
export class ChannelSelectMenuInteraction<Cached extends CacheType = CacheType> extends SelectMenuInteractionBase<Cached> {
  /** The channels chosen. */
  public get channels(): Collection<string, Channel> {
    const channels = new Collection<string, Channel>();
    for (const id of this.values) {
      const channel = this.resolvedData.channels?.get(id) ?? this.client.channels.cache.get(id);
      if (channel) channels.set(id, channel);
    }
    return channels;
  }
}

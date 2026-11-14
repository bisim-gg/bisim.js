import type { Client } from '../client/Client.js';
import type { ApplicationCommand } from '../structures/ApplicationCommand.js';
import type { GuildMember } from '../structures/GuildMember.js';
import type { Message } from '../structures/Message.js';
import type { User } from '../structures/User.js';
import type { RawInteractionData } from '../types/raw.js';
import { ApplicationCommandOptionType, ApplicationCommandType } from '../util/Enums.js';
import { commandTypeFromBisim } from '../util/Transformers.js';
import { BaseInteraction, type CacheType } from './BaseInteraction.js';
import {
  type CommandInteractionOption,
  CommandInteractionOptionResolver,
  type CommandInteractionResolvedData,
  transformOption,
  transformResolved,
} from './CommandInteractionOptionResolver.js';
import { InteractionResponses, applyInteractionResponses } from './InteractionResponses.js';
import type { RawMessageData } from '../types/raw.js';

/**
 * A command a user ran: a slash command or a context menu command.
 */
export class CommandInteraction<Cached extends CacheType = CacheType> extends BaseInteraction<Cached> {
  /** The command's id. */
  public commandId: string;
  /** The command's name. */
  public commandName: string;
  /** The command's type. */
  public commandType: ApplicationCommandType;
  /** The server the command belongs to, or `null` for a global command. */
  public commandGuildId: string | null;
  /** Whether the reply was deferred. */
  public deferred = false;
  /** Whether the reply is ephemeral. */
  public ephemeral: boolean | null = null;
  /** Whether the interaction was answered. */
  public replied = false;
  /** What the options point at. */
  public resolved: CommandInteractionResolvedData;
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
    this.commandId = data.data?.id ?? '';
    this.commandName = data.data?.name ?? '';
    this.commandType = commandTypeFromBisim(data.data?.type);
    this.commandGuildId = data.data?.guildId ?? null;
    this.resolved = transformResolved(client, this.guild as never, data.data?.resolved);
  }

  /**
   * The command, when cached.
   */
  public get command(): ApplicationCommand | null {
    const id = this.commandId;
    return (this.guild as { commands?: { cache: Map<string, ApplicationCommand> } } | null)?.commands?.cache.get(id) ?? this.client.application?.commands.cache.get(id) ?? null;
  }

  /**
   * The interaction's webhook: `send` posts a followup, `editMessage` and `deleteMessage` change answers.
   */
  public get webhook(): { id: string; token: string; send: (options: unknown) => Promise<Message>; editMessage: (message: string, options: unknown) => Promise<Message>; fetchMessage: (message: string) => Promise<Message>; deleteMessage: (message: string) => Promise<void> } {
    return {
      id: this.applicationId,
      token: this.token,
      send: (options) => (this as unknown as InteractionResponses).followUp.call(this as never, options as never),
      editMessage: (message, options) => (this as unknown as InteractionResponses).editReply.call(this as never, { ...(options as object), message } as never),
      fetchMessage: (message) => (this as unknown as InteractionResponses).fetchReply.call(this as never, message),
      deleteMessage: (message) => (this as unknown as InteractionResponses).deleteReply.call(this as never, message),
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-declaration-merging
export interface CommandInteraction<Cached extends CacheType = CacheType> extends Omit<InteractionResponses, 'deferUpdate' | 'update'> {}

applyInteractionResponses(CommandInteraction, ['deferUpdate', 'update']);

function buildOptions(interaction: CommandInteraction, data: RawInteractionData): CommandInteractionOption[] {
  return (data.data?.options ?? []).map((option) =>
    transformOption(interaction.client, interaction.guild as never, option, interaction.resolved),
  );
}

/**
 * A slash command a user ran.
 *
 * @example
 * ```js
 * client.on(Events.InteractionCreate, async (interaction) => {
 *   if (!interaction.isChatInputCommand()) return;
 *   if (interaction.commandName === 'ping') await interaction.reply('Pong!');
 * });
 * ```
 */
export class ChatInputCommandInteraction<Cached extends CacheType = CacheType> extends CommandInteraction<Cached> {
  /** The options the user filled in. */
  public options: CommandInteractionOptionResolver;

  /**
   * @param client - The client
   * @param data - The interaction payload
   */
  public constructor(client: Client, data: RawInteractionData) {
    super(client, data);
    this.options = new CommandInteractionOptionResolver(client, buildOptions(this, data), this.resolved);
  }

  /**
   * The command as the user typed it, for example `/ban target:@someone`.
   */
  public override toString(): string {
    const parts = [this.commandName];
    const group = this.options.getSubcommandGroup(false);
    if (group) parts.push(group);
    const sub = this.options.getSubcommand(false);
    if (sub) parts.push(sub);
    const hoisted = (this.options as unknown as { _hoistedOptions: CommandInteractionOption[] })._hoistedOptions;
    const options = hoisted.map((option) => `${option.name}:${String(option.value)}`);
    return `/${parts.join(' ')}${options.length ? ` ${options.join(' ')}` : ''}`;
  }
}

/**
 * A context menu command a user ran (on a user or on a message).
 */
export class ContextMenuCommandInteraction<Cached extends CacheType = CacheType> extends CommandInteraction<Cached> {
  /** The id of the user or message the command ran on. */
  public targetId: string;
  /** The target, as an option named `user` or `message`. */
  public options: CommandInteractionOptionResolver;

  /**
   * @param client - The client
   * @param data - The interaction payload
   */
  public constructor(client: Client, data: RawInteractionData) {
    super(client, data);
    this.targetId = data.data?.targetId ?? '';
    const options: CommandInteractionOption[] = [];
    if (this.commandType === ApplicationCommandType.User) {
      const user = this.resolved.users?.get(this.targetId) ?? client.users.cache.get(this.targetId);
      options.push({
        name: 'user',
        type: ApplicationCommandOptionType.User,
        value: this.targetId,
        user,
        member: this.resolved.members?.get(this.targetId) ?? this.guild?.members.cache.get(this.targetId) ?? null,
      });
    } else if (this.commandType === ApplicationCommandType.Message) {
      const message = this.resolved.messages?.get(this.targetId) ?? this.channel?.messages?.cache.get(this.targetId);
      options.push({ name: 'message', type: -1 as ApplicationCommandOptionType, value: this.targetId, message });
    }
    this.options = new CommandInteractionOptionResolver(client, options, this.resolved);
  }
}

/**
 * A context menu command that ran on a user.
 */
export class UserContextMenuCommandInteraction<Cached extends CacheType = CacheType> extends ContextMenuCommandInteraction<Cached> {
  /** The user the command ran on. */
  public get targetUser(): User {
    return this.options.getUser('user', true);
  }

  /** The user as a member of the server, or `null`. */
  public get targetMember(): GuildMember | null {
    return this.options.getMember('user');
  }
}

/**
 * A context menu command that ran on a message.
 */
export class MessageContextMenuCommandInteraction<Cached extends CacheType = CacheType> extends ContextMenuCommandInteraction<Cached> {
  /** The message the command ran on. */
  public get targetMessage(): Message {
    return this.options.getMessage('message', true);
  }
}

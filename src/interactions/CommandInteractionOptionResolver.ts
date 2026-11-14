import type { Client } from '../client/Client.js';
import { BisimjsTypeError, ErrorCodes } from '../errors/index.js';
import { Attachment } from '../structures/Attachment.js';
import type { Channel } from '../structures/channels/index.js';
import type { Guild } from '../structures/Guild.js';
import type { GuildMember } from '../structures/GuildMember.js';
import type { Message } from '../structures/Message.js';
import type { Role } from '../structures/Role.js';
import type { User } from '../structures/User.js';
import type { RawInteractionOptionData, RawResolvedData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { ApplicationCommandOptionType, type ChannelType } from '../util/Enums.js';
import { optionTypeFromBisim } from '../util/Transformers.js';
import { attachHidden } from '../util/internal.js';

/**
 * One option of a command as the bot received it.
 */
export interface CommandInteractionOption {
  name: string;
  type: ApplicationCommandOptionType;
  value?: string | number | boolean;
  options?: CommandInteractionOption[];
  focused?: boolean;
  autocomplete?: boolean;
  user?: User;
  member?: GuildMember | null;
  channel?: Channel | null;
  role?: Role | null;
  attachment?: Attachment;
  message?: Message;
}

/**
 * The users, members, roles, channels, messages and files an interaction points at.
 */
export interface CommandInteractionResolvedData {
  users?: Collection<string, User>;
  members?: Collection<string, GuildMember>;
  roles?: Collection<string, Role>;
  channels?: Collection<string, Channel>;
  messages?: Collection<string, Message>;
  attachments?: Collection<string, Attachment>;
}

function entries<Value>(value: Record<string, Value> | Value[] | undefined): [string, Value][] {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((item) => [String((item as { id?: string; userId?: string }).id ?? (item as { userId?: string }).userId), item]);
  return Object.entries(value);
}

/**
 * Builds the resolved data of an interaction from Bisim's payload, filling the gaps from the caches.
 *
 * @internal
 */
export function transformResolved(client: Client, guild: Guild | null, resolved: RawResolvedData | undefined): CommandInteractionResolvedData {
  const result: CommandInteractionResolvedData = {};
  if (!resolved) return result;
  const users = entries(resolved.users);
  if (users.length) result.users = new Collection(users.map(([id, raw]) => [id, client.users._add({ ...raw, id })]));
  const members = entries(resolved.members);
  if (members.length && guild) {
    result.members = new Collection(
      members.map(([id, raw]) => [id, guild.members._add({ ...raw, userId: raw.userId ?? id, user: raw.user ?? (resolved.users ? (entries(resolved.users).find(([key]) => key === id)?.[1] ?? null) : null) })]),
    );
  }
  const roles = entries(resolved.roles);
  if (roles.length && guild) result.roles = new Collection(roles.map(([id, raw]) => [id, guild.roles._add({ ...raw, id })]));
  const channels = entries(resolved.channels);
  if (channels.length) {
    result.channels = new Collection(
      channels.map(([id, raw]) => [id, client.channels.cache.get(id) ?? client.channels._add({ guildId: guild?.id, ...raw, id }, guild)]),
    );
  }
  const messages = entries(resolved.messages);
  if (messages.length) {
    result.messages = new Collection(
      messages.map(([id, raw]) => {
        const channel = client.channels.cache.get(raw.channelId) as { messages?: { _add(data: unknown): Message } } | undefined;
        const message = channel?.messages ? channel.messages._add({ guildId: guild?.id, ...raw, id }) : null;
        return [id, message!];
      }),
    );
  }
  const attachments = entries(resolved.attachments);
  if (attachments.length) result.attachments = new Collection(attachments.map(([id, raw]) => [id, new Attachment({ ...raw, id })]));
  return result;
}

/**
 * Builds one option as the bot sees it: typed value, plus the user, member, channel, role or file it points at.
 *
 * @internal
 */
export function transformOption(
  client: Client,
  guild: Guild | null,
  option: RawInteractionOptionData,
  resolved: CommandInteractionResolvedData,
): CommandInteractionOption {
  const type = optionTypeFromBisim(option.type);
  const result: CommandInteractionOption = { name: option.name, type };
  if (option.value !== undefined && option.value !== null) {
    let value: string | number | boolean = option.value;
    if ((type === ApplicationCommandOptionType.Integer || type === ApplicationCommandOptionType.Number) && typeof value === 'string' && value.trim() !== '' && !option.focused) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) value = parsed;
    }
    if (type === ApplicationCommandOptionType.Boolean && typeof value === 'string') value = value === 'true';
    result.value = value;
  }
  if (option.options) result.options = option.options.map((nested) => transformOption(client, guild, nested, resolved));
  if (option.focused) result.focused = true;

  const id = typeof option.value === 'string' ? option.value : String(option.value ?? '');
  if (type === ApplicationCommandOptionType.User || type === ApplicationCommandOptionType.Mentionable) {
    const user = resolved.users?.get(id) ?? client.users.cache.get(id);
    if (user) {
      result.user = user;
      result.member = resolved.members?.get(id) ?? guild?.members.cache.get(id) ?? null;
    }
  }
  if (type === ApplicationCommandOptionType.Channel) {
    result.channel = resolved.channels?.get(id) ?? client.channels.cache.get(id) ?? null;
  }
  if (type === ApplicationCommandOptionType.Role || (type === ApplicationCommandOptionType.Mentionable && !result.user)) {
    result.role = resolved.roles?.get(id) ?? guild?.roles.cache.get(id) ?? null;
  }
  if (type === ApplicationCommandOptionType.Attachment) {
    const attachment = resolved.attachments?.get(id);
    if (attachment) result.attachment = attachment;
  }
  return result;
}

const T = ApplicationCommandOptionType;

type OptionKindSpec = { types: readonly ApplicationCommandOptionType[]; fields: readonly (keyof CommandInteractionOption)[] };

/** For each getter: the option types it accepts, and the fields that hold its value. */
const optionKinds = {
  boolean: { types: [T.Boolean], fields: ['value'] },
  channel: { types: [T.Channel], fields: ['channel'] },
  string: { types: [T.String], fields: ['value'] },
  integer: { types: [T.Integer], fields: ['value'] },
  number: { types: [T.Number], fields: ['value'] },
  user: { types: [T.User, T.Mentionable], fields: ['user'] },
  member: { types: [T.User, T.Mentionable], fields: ['member'] },
  role: { types: [T.Role, T.Mentionable], fields: ['role'] },
  attachment: { types: [T.Attachment], fields: ['attachment'] },
  mentionable: { types: [T.Mentionable], fields: ['user', 'member', 'role'] },
  // Context menu commands carry their target as a pseudo option.
  message: { types: [-1 as ApplicationCommandOptionType], fields: ['message'] },
} satisfies Record<string, OptionKindSpec>;

type OptionKind = keyof typeof optionKinds;

/** Steps into a subcommand group and a subcommand, when there are any, to reach the options typed. */
function unwrapSubcommands(options: CommandInteractionOption[]): {
  group: string | null;
  subcommand: string | null;
  leaves: CommandInteractionOption[];
} {
  let level = options;
  let group: string | null = null;
  let subcommand: string | null = null;
  if (level[0]?.type === T.SubcommandGroup) {
    group = level[0].name;
    level = level[0].options ?? [];
  }
  if (level[0]?.type === T.Subcommand) {
    subcommand = level[0].name;
    level = level[0].options ?? [];
  }
  return { group, subcommand, leaves: level };
}

/**
 * Reads the options of a command, the discord.js way.
 *
 * @example
 * ```js
 * const input = interaction.options.getString('input', true);
 * const target = interaction.options.getUser('target');
 * const sub = interaction.options.getSubcommand();
 * ```
 */
export class CommandInteractionOptionResolver {
  /** The client. */
  public declare readonly client: Client<true>;
  /** The options, as received. */
  public readonly data: readonly CommandInteractionOption[];
  /** What the options point at. */
  public readonly resolved: Readonly<CommandInteractionResolvedData> | null;
  private readonly _group: string | null;
  private readonly _subcommand: string | null;
  private readonly _hoistedOptions: CommandInteractionOption[];

  /**
   * @param client - The client
   * @param options - The options
   * @param resolved - What they point at
   */
  public constructor(client: Client, options: CommandInteractionOption[] = [], resolved: CommandInteractionResolvedData | null = null) {
    attachHidden(this, 'client', client);
    this.data = options;
    this.resolved = resolved;
    const { group, subcommand, leaves } = unwrapSubcommands(options);
    this._group = group;
    this._subcommand = subcommand;
    this._hoistedOptions = leaves;
  }

  /**
   * Gets an option by name.
   *
   * @param name - The name
   * @param required - Whether to throw when it is missing
   */
  public get(name: string, required: true): CommandInteractionOption;
  public get(name: string, required?: boolean): CommandInteractionOption | null;
  public get(name: string, required = false): CommandInteractionOption | null {
    const option = this._hoistedOptions.find((opt) => opt.name === name);
    if (!option) {
      if (required) throw new BisimjsTypeError(ErrorCodes.CommandInteractionOptionNotFound, name);
      return null;
    }
    return option;
  }

  /** Finds an option and checks it is of the kind asked for (and, when required, that it holds a value). */
  private pick(name: string, required: boolean, kind: OptionKind): CommandInteractionOption | null {
    const found = this.get(name, required);
    if (found === null) return null;
    const { types, fields }: OptionKindSpec = optionKinds[kind];
    if (!types.includes(found.type)) throw new BisimjsTypeError(ErrorCodes.CommandInteractionOptionType, name, found.type, types.join(', '));
    const holdsNothing = fields.every((field) => found[field] === undefined || found[field] === null);
    if (required && holdsNothing) throw new BisimjsTypeError(ErrorCodes.CommandInteractionOptionEmpty, name, found.type);
    return found;
  }

  /**
   * The subcommand that ran.
   *
   * @param required - Whether to throw when there is none
   */
  public getSubcommand(required?: true): string;
  public getSubcommand(required: boolean): string | null;
  public getSubcommand(required = true): string | null {
    if (required && !this._subcommand) throw new BisimjsTypeError(ErrorCodes.CommandInteractionOptionNoSubcommand);
    return this._subcommand;
  }

  /**
   * The subcommand group that ran.
   *
   * @param required - Whether to throw when there is none
   */
  public getSubcommandGroup(required: true): string;
  public getSubcommandGroup(required?: boolean): string | null;
  public getSubcommandGroup(required = false): string | null {
    if (required && !this._group) throw new BisimjsTypeError(ErrorCodes.CommandInteractionOptionNoSubcommandGroup);
    return this._group;
  }

  /** Gets a true or false option. */
  public getBoolean(name: string, required: true): boolean;
  public getBoolean(name: string, required?: boolean): boolean | null;
  public getBoolean(name: string, required = false): boolean | null {
    const value = this.pick(name, required, 'boolean')?.value as boolean | undefined;
    return value ?? null;
  }

  /**
   * Gets a channel option.
   *
   * @param name - The name
   * @param required - Whether to throw when it is missing
   * @param channelTypes - The channel types allowed
   */
  public getChannel(name: string, required: true, channelTypes?: readonly ChannelType[]): Channel;
  public getChannel(name: string, required?: boolean, channelTypes?: readonly ChannelType[]): Channel | null;
  public getChannel(name: string, required = false, channelTypes: readonly ChannelType[] = []): Channel | null {
    const picked = this.pick(name, required, 'channel')?.channel ?? null;
    if (picked === null || channelTypes.length === 0 || channelTypes.includes(picked.type)) return picked;
    throw new BisimjsTypeError(ErrorCodes.CommandInteractionOptionInvalidChannelType, name, picked.type, channelTypes.join(', '));
  }

  /** Gets a text option. */
  public getString(name: string, required: true): string;
  public getString(name: string, required?: boolean): string | null;
  public getString(name: string, required = false): string | null {
    const value = this.pick(name, required, 'string')?.value;
    return value === undefined ? null : String(value);
  }

  /** Gets a whole number option. */
  public getInteger(name: string, required: true): number;
  public getInteger(name: string, required?: boolean): number | null;
  public getInteger(name: string, required = false): number | null {
    const value = this.pick(name, required, 'integer')?.value;
    return value === undefined ? null : Number(value);
  }

  /** Gets a number option. */
  public getNumber(name: string, required: true): number;
  public getNumber(name: string, required?: boolean): number | null;
  public getNumber(name: string, required = false): number | null {
    const value = this.pick(name, required, 'number')?.value;
    return value === undefined ? null : Number(value);
  }

  /** Gets a user option. */
  public getUser(name: string, required: true): User;
  public getUser(name: string, required?: boolean): User | null;
  public getUser(name: string, required = false): User | null {
    return this.pick(name, required, 'user')?.user ?? null;
  }

  /** Gets a user option as a member of the server. */
  public getMember(name: string): GuildMember | null {
    return this.pick(name, false, 'member')?.member ?? null;
  }

  /** Gets a role option. */
  public getRole(name: string, required: true): Role;
  public getRole(name: string, required?: boolean): Role | null;
  public getRole(name: string, required = false): Role | null {
    return this.pick(name, required, 'role')?.role ?? null;
  }

  /** Gets a file option. */
  public getAttachment(name: string, required: true): Attachment;
  public getAttachment(name: string, required?: boolean): Attachment | null;
  public getAttachment(name: string, required = false): Attachment | null {
    return this.pick(name, required, 'attachment')?.attachment ?? null;
  }

  /** Gets a user or role option. */
  public getMentionable(name: string, required: true): User | GuildMember | Role;
  public getMentionable(name: string, required?: boolean): User | GuildMember | Role | null;
  public getMentionable(name: string, required = false): User | GuildMember | Role | null {
    const found = this.pick(name, required, 'mentionable');
    if (found === null) return null;
    return found.member ?? found.user ?? found.role ?? null;
  }

  /**
   * Gets the message a message context menu command ran on.
   *
   * @param name - Always `message`
   * @param required - Whether to throw when it is missing
   */
  public getMessage(name: string, required: true): Message;
  public getMessage(name: string, required?: boolean): Message | null;
  public getMessage(name: string, required = false): Message | null {
    return this.pick(name, required, 'message')?.message ?? null;
  }

  /**
   * Gets the option the user is typing in, for autocomplete.
   *
   * @param getFull - Whether to return the whole option instead of its value
   */
  public getFocused(getFull: true): CommandInteractionOption;
  public getFocused(getFull?: boolean): string | number;
  public getFocused(getFull = false): CommandInteractionOption | string | number {
    const focused = this._hoistedOptions.find((option) => option.focused);
    if (!focused) throw new BisimjsTypeError(ErrorCodes.AutocompleteInteractionOptionNoFocusedOption);
    return getFull ? focused : (focused.value as string | number);
  }
}

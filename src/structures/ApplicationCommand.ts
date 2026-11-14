import type { Client } from '../client/Client.js';
import type { ApplicationCommandDataResolvable, ApplicationCommandManager } from '../managers/ApplicationCommandManager.js';
import type { RawApplicationCommandData, RawApplicationCommandOptionData } from '../types/raw.js';
import type { ApplicationCommandOptionType, ApplicationCommandType, ChannelType, InteractionContextType } from '../util/Enums.js';
import { PermissionsBitField, type PermissionResolvable } from '../util/PermissionsBitField.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { channelTypeFromBisim, commandTypeFromBisim, contextFromBisim, optionTypeFromBisim, toBisimCommand } from '../util/Transformers.js';
import { notSupported } from '../util/Util.js';
import { Base } from './Base.js';
import type { Guild } from './Guild.js';
import { dateFrom } from '../util/internal.js';

/**
 * A choice of an option, as discord.js shows it.
 */
export interface ApplicationCommandOptionChoice {
  name: string;
  nameLocalizations?: Record<string, string> | null;
  value: string | number;
}

/**
 * An option of a command, as discord.js shows it (numbers for types, camelCase).
 */
export interface ApplicationCommandOption {
  type: ApplicationCommandOptionType;
  name: string;
  nameLocalizations?: Record<string, string> | null;
  description: string;
  descriptionLocalizations?: Record<string, string> | null;
  required?: boolean;
  autocomplete?: boolean;
  choices?: ApplicationCommandOptionChoice[];
  options?: ApplicationCommandOption[];
  channelTypes?: ChannelType[];
  minValue?: number;
  maxValue?: number;
  minLength?: number;
  maxLength?: number;
}

/**
 * Converts an option as Bisim stores it into discord.js's shape.
 *
 * @internal
 */
export function optionFromBisim(option: RawApplicationCommandOptionData): ApplicationCommandOption {
  const result: ApplicationCommandOption = {
    type: optionTypeFromBisim(option.type),
    name: option.name,
    description: option.description ?? '',
  };
  if (option.required) result.required = true;
  if (option.autocomplete) result.autocomplete = true;
  if (option.nameLocalizations) result.nameLocalizations = option.nameLocalizations;
  if (option.descriptionLocalizations) result.descriptionLocalizations = option.descriptionLocalizations;
  if (option.choices?.length) {
    result.choices = option.choices.map((choice) => ({ name: choice.name, value: choice.value, nameLocalizations: choice.nameLocalizations ?? null }));
  }
  if (option.options?.length) result.options = option.options.map((nested) => optionFromBisim(nested));
  if (option.channelTypes?.length) result.channelTypes = option.channelTypes.map((type) => channelTypeFromBisim(type));
  if (option.minValue !== undefined && option.minValue !== null) result.minValue = option.minValue;
  if (option.maxValue !== undefined && option.maxValue !== null) result.maxValue = option.maxValue;
  if (option.minLength !== undefined && option.minLength !== null) result.minLength = option.minLength;
  if (option.maxLength !== undefined && option.maxLength !== null) result.maxLength = option.maxLength;
  return result;
}

/**
 * One of the bot's commands.
 */
export class ApplicationCommand extends Base {
  /** The id. */
  public id: string;
  /** The application (the bot) the command belongs to. */
  public applicationId!: string;
  /** The server it belongs to, or `null` for a global command. */
  public guildId!: string | null;
  /** The name. */
  public name!: string;
  /** The name in other languages. */
  public nameLocalizations!: Record<string, string> | null;
  /** Always `undefined` (Bisim does not localize on fetch). */
  public nameLocalized?: string | null;
  /** The description. */
  public description!: string;
  /** The description in other languages. */
  public descriptionLocalizations!: Record<string, string> | null;
  /** Always `undefined` (Bisim does not localize on fetch). */
  public descriptionLocalized?: string | null;
  /** The type. */
  public type!: ApplicationCommandType;
  /** The options. */
  public options!: ApplicationCommandOption[];
  /** Who may run it by default, or `null` for everyone. */
  public defaultMemberPermissions!: Readonly<PermissionsBitField> | null;
  /** Whether it can run in the bot's DMs (from `contexts`). */
  public dmPermission!: boolean | null;
  /** Where it can run. */
  public contexts!: InteractionContextType[] | null;
  /** Always `null` on Bisim. */
  public integrationTypes!: number[] | null;
  /** Whether it is age restricted. */
  public nsfw!: boolean;
  /** Always the id (Bisim has no command versions). */
  public version!: string;
  /** The server the command belongs to, when cached. */
  public declare readonly guild: Guild | null;

  /**
   * @param client - The client
   * @param data - The command from Bisim
   * @param guild - The server it belongs to
   */
  public constructor(client: Client, data: RawApplicationCommandData, guild?: Guild | null) {
    super(client);
    this.id = data.id;
    Object.defineProperty(this, 'guild', { value: guild ?? (data.guildId ? (client.guilds.cache.get(data.guildId) ?? null) : null), writable: true });
    this.guildId = guild?.id ?? data.guildId ?? null;
    this.nameLocalizations = null;
    this.descriptionLocalizations = null;
    this.options = [];
    this.defaultMemberPermissions = null;
    this.dmPermission = null;
    this.contexts = null;
    this.integrationTypes = null;
    this.nsfw = false;
    this.version = data.id;
    this._patch(data);
  }

  public override _patch(data: Partial<RawApplicationCommandData>): void {
    if (data.appId ?? data.applicationId) this.applicationId = (data.appId ?? data.applicationId)!;
    if (data.name !== undefined) this.name = data.name;
    if (data.description !== undefined) this.description = data.description ?? '';
    this.type = commandTypeFromBisim(data.type ?? this.type);
    if (data.options !== undefined) this.options = (data.options ?? []).map((option) => optionFromBisim(option));
    if ('defaultMemberPermissions' in data) {
      this.defaultMemberPermissions =
        data.defaultMemberPermissions === null || data.defaultMemberPermissions === undefined
          ? null
          : new PermissionsBitField(BigInt(data.defaultMemberPermissions)).freeze();
    }
    if ('contexts' in data) {
      this.contexts = data.contexts ? data.contexts.map((context) => contextFromBisim(context)).filter((context): context is InteractionContextType => context !== null) : null;
      this.dmPermission = this.contexts ? this.contexts.includes(1) : null;
    }
    if ('nameLocalizations' in data) this.nameLocalizations = data.nameLocalizations ?? null;
    if ('descriptionLocalizations' in data) this.descriptionLocalizations = data.descriptionLocalizations ?? null;
    if (data.nsfw !== undefined) this.nsfw = Boolean(data.nsfw);
    this.applicationId ??= this.client.application?.id ?? '';
  }

  /**
   * When the command was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the command was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The manager the command belongs to.
   */
  public get manager(): ApplicationCommandManager {
    return (this.guild?.commands ?? this.client.application.commands) as ApplicationCommandManager;
  }

  /**
   * Not on Bisim: per command permissions.
   */
  public get permissions(): never {
    return notSupported('Command permissions');
  }

  /**
   * Edits the command.
   *
   * @param data - What to change
   */
  public edit(data: Partial<ApplicationCommandDataResolvable>): Promise<ApplicationCommand> {
    return this.manager.edit(this, data, this.guildId ?? undefined);
  }

  /** Renames the command. */
  public setName(name: string): Promise<ApplicationCommand> {
    return this.edit({ name });
  }

  /** Sets the names in other languages. */
  public setNameLocalizations(nameLocalizations: Record<string, string>): Promise<ApplicationCommand> {
    return this.edit({ nameLocalizations } as never);
  }

  /** Sets the description. */
  public setDescription(description: string): Promise<ApplicationCommand> {
    return this.edit({ description } as never);
  }

  /** Sets the descriptions in other languages. */
  public setDescriptionLocalizations(descriptionLocalizations: Record<string, string>): Promise<ApplicationCommand> {
    return this.edit({ descriptionLocalizations } as never);
  }

  /** Sets who may run the command by default. */
  public setDefaultMemberPermissions(defaultMemberPermissions: PermissionResolvable | null): Promise<ApplicationCommand> {
    return this.edit({ defaultMemberPermissions } as never);
  }

  /** Sets whether the command can run in the bot's DMs. */
  public setDMPermission(dmPermission = true): Promise<ApplicationCommand> {
    return this.edit({ contexts: dmPermission ? [0, 1] : [0] } as never);
  }

  /** Replaces the options. */
  public setOptions(options: readonly unknown[]): Promise<ApplicationCommand> {
    return this.edit({ options } as never);
  }

  /**
   * Deletes the command.
   */
  public delete(): Promise<ApplicationCommand | null> {
    return this.manager.delete(this, this.guildId ?? undefined);
  }

  /**
   * Whether this command is the same as other command data.
   *
   * @param command - The other command
   * @param enforceOptionOrder - Whether the options must be in the same order
   */
  public equals(command: ApplicationCommand | ApplicationCommandDataResolvable, enforceOptionOrder = false): boolean {
    const mine = toBisimCommand(this.toBisim());
    const other = toBisimCommand(command instanceof ApplicationCommand ? command.toBisim() : command);
    if (!enforceOptionOrder) {
      const sort = (options?: RawApplicationCommandOptionData[]) => options?.slice().sort((a, b) => a.name.localeCompare(b.name));
      mine.options = sort(mine.options);
      other.options = sort(other.options);
    }
    return JSON.stringify(mine) === JSON.stringify(other);
  }

  /**
   * The command as Bisim's JSON.
   *
   * @internal
   */
  public toBisim(): Omit<RawApplicationCommandData, 'id'> {
    return toBisimCommand({
      type: this.type,
      name: this.name,
      description: this.description,
      options: this.options,
      defaultMemberPermissions: this.defaultMemberPermissions?.bitfield.toString() ?? null,
      contexts: this.contexts,
      nameLocalizations: this.nameLocalizations,
      descriptionLocalizations: this.descriptionLocalizations,
      nsfw: this.nsfw,
    });
  }

  /**
   * The command as a mention, `</name:id>`.
   */
  public override toString(): string {
    return `</${this.name}:${this.id}>`;
  }
}

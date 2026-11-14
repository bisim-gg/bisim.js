import { BisimjsRangeError, ErrorCodes } from '../errors/index.js';
import type { RawApplicationCommandData, RawApplicationCommandOptionData } from '../types/raw.js';
import { ApplicationCommandOptionType, ChannelType, InteractionContextType, type Locale } from '../util/Enums.js';
import { PermissionsBitField, type PermissionResolvable } from '../util/PermissionsBitField.js';
import { channelTypeToBisim, contextToBisim, localizationsToBisim, optionTypeToBisim } from '../util/Transformers.js';

/**
 * A map of language codes to names or descriptions. Bisim shows `fa` and `en`; English variants count as
 * `en` and other languages are dropped.
 */
export type LocalizationMap = Partial<Record<Locale | `${Locale}` | string, string | null>>;

const COMMAND_NAME = /^[a-z0-9_-]{1,32}$/;

function assertName(name: string): void {
  if (typeof name !== 'string' || !COMMAND_NAME.test(name)) throw new BisimjsRangeError(ErrorCodes.CommandName, name);
}

function assertDescription(description: string): void {
  if (typeof description !== 'string' || description.length < 1 || description.length > 100) {
    throw new BisimjsRangeError(ErrorCodes.CommandDescription);
  }
}

/**
 * The part every command and option shares: a name, a description and their translations.
 */
export abstract class SharedNameAndDescription {
  /** The name. */
  public readonly name!: string;
  /** The name in other languages. */
  public readonly name_localizations?: LocalizationMap;
  /** The description. */
  public readonly description!: string;
  /** The description in other languages. */
  public readonly description_localizations?: LocalizationMap;

  /**
   * Sets the name: 1 to 32 lowercase letters, digits, `-` or `_`.
   *
   * @param name - The name
   */
  public setName(name: string): this {
    assertName(name);
    Reflect.set(this, 'name', name);
    return this;
  }

  /**
   * Sets the description: 1 to 100 characters.
   *
   * @param description - The description
   */
  public setDescription(description: string): this {
    assertDescription(description);
    Reflect.set(this, 'description', description);
    return this;
  }

  /**
   * Sets the name in one language.
   *
   * @param locale - The language, for example `fa` or `en-US`
   * @param localizedName - The name in that language, or `null` to remove it
   */
  public setNameLocalization(locale: string, localizedName: string | null): this {
    const map: LocalizationMap = { ...(this.name_localizations ?? {}) };
    if (localizedName === null) delete map[locale];
    else map[locale] = localizedName;
    Reflect.set(this, 'name_localizations', map);
    return this;
  }

  /**
   * Sets the name in several languages at once.
   *
   * @param localizedNames - The names, by language, or `null` to remove them all
   */
  public setNameLocalizations(localizedNames: LocalizationMap | null): this {
    Reflect.set(this, 'name_localizations', localizedNames === null ? undefined : { ...localizedNames });
    return this;
  }

  /**
   * Sets the description in one language.
   *
   * @param locale - The language, for example `fa` or `en-US`
   * @param localizedDescription - The description in that language, or `null` to remove it
   */
  public setDescriptionLocalization(locale: string, localizedDescription: string | null): this {
    const map: LocalizationMap = { ...(this.description_localizations ?? {}) };
    if (localizedDescription === null) delete map[locale];
    else map[locale] = localizedDescription;
    Reflect.set(this, 'description_localizations', map);
    return this;
  }

  /**
   * Sets the description in several languages at once.
   *
   * @param localizedDescriptions - The descriptions, by language, or `null` to remove them all
   */
  public setDescriptionLocalizations(localizedDescriptions: LocalizationMap | null): this {
    Reflect.set(this, 'description_localizations', localizedDescriptions === null ? undefined : { ...localizedDescriptions });
    return this;
  }
}

/**
 * The base of every slash command option builder.
 */
export abstract class ApplicationCommandOptionBase extends SharedNameAndDescription {
  /** The type of the option. */
  public abstract readonly type: ApplicationCommandOptionType;
  /** Whether the option must be filled in. */
  public readonly required: boolean = false;

  /**
   * Sets whether the option must be filled in.
   *
   * @param required - Whether it is required
   */
  public setRequired(required: boolean): this {
    Reflect.set(this, 'required', required);
    return this;
  }

  /**
   * The option as Bisim's JSON.
   */
  public toJSON(): RawApplicationCommandOptionData {
    if (this.name === undefined) throw new BisimjsRangeError(ErrorCodes.CommandName, String(this.name));
    if (this.description === undefined) throw new BisimjsRangeError(ErrorCodes.CommandDescription);
    const json: RawApplicationCommandOptionData = {
      type: optionTypeToBisim(this.type),
      name: this.name,
      description: this.description,
    };
    if (this.required) json.required = true;
    const names = localizationsToBisim(this.name_localizations);
    if (names) json.nameLocalizations = names;
    const descriptions = localizationsToBisim(this.description_localizations);
    if (descriptions) json.descriptionLocalizations = descriptions;
    return json;
  }
}

/**
 * A choice of a string, integer or number option.
 */
export interface APIApplicationCommandOptionChoice<Value extends number | string = number | string> {
  name: string;
  name_localizations?: LocalizationMap | null;
  value: Value;
}

abstract class ChoicesOption<Value extends number | string> extends ApplicationCommandOptionBase {
  /** The fixed choices, if any. */
  public readonly choices?: APIApplicationCommandOptionChoice<Value>[];
  /** Whether the bot suggests values while the user types. */
  public readonly autocomplete?: boolean;

  /**
   * Adds choices the user picks from.
   *
   * @param choices - The choices, each a name and a value
   */
  public addChoices(...choices: (APIApplicationCommandOptionChoice<Value> | APIApplicationCommandOptionChoice<Value>[])[]): this {
    const flat = choices.flat() as APIApplicationCommandOptionChoice<Value>[];
    const current = [...(this.choices ?? []), ...flat];
    if (current.length > 25) throw new RangeError('An option has at most 25 choices.');
    Reflect.set(this, 'choices', current);
    return this;
  }

  /**
   * Replaces the choices.
   *
   * @param choices - The choices
   */
  public setChoices(...choices: (APIApplicationCommandOptionChoice<Value> | APIApplicationCommandOptionChoice<Value>[])[]): this {
    Reflect.set(this, 'choices', []);
    return this.addChoices(...choices);
  }

  /**
   * Sets whether the bot suggests values while the user types (answer them with
   * `AutocompleteInteraction#respond`). An option with autocomplete has no fixed choices.
   *
   * @param autocomplete - Whether to suggest
   */
  public setAutocomplete(autocomplete: boolean): this {
    Reflect.set(this, 'autocomplete', autocomplete);
    return this;
  }

  public override toJSON(): RawApplicationCommandOptionData {
    const json = super.toJSON();
    if (this.choices?.length) {
      json.choices = this.choices.map((choice) => {
        const result: { name: string; value: Value; nameLocalizations?: Record<string, string> } = {
          name: choice.name,
          value: choice.value,
        };
        const names = localizationsToBisim(choice.name_localizations ?? (choice as { nameLocalizations?: LocalizationMap }).nameLocalizations);
        if (names) result.nameLocalizations = names;
        return result;
      });
    }
    if (this.autocomplete) json.autocomplete = true;
    return json;
  }
}

/**
 * A text option.
 */
export class SlashCommandStringOption extends ChoicesOption<string> {
  public readonly type = ApplicationCommandOptionType.String as const;
  /** The shortest allowed text. */
  public readonly min_length?: number;
  /** The longest allowed text. */
  public readonly max_length?: number;

  /**
   * Sets the shortest allowed text.
   *
   * @param min - The minimum length
   */
  public setMinLength(min: number): this {
    Reflect.set(this, 'min_length', min);
    return this;
  }

  /**
   * Sets the longest allowed text.
   *
   * @param max - The maximum length
   */
  public setMaxLength(max: number): this {
    Reflect.set(this, 'max_length', max);
    return this;
  }

  public override toJSON(): RawApplicationCommandOptionData {
    const json = super.toJSON();
    if (this.min_length !== undefined) json.minLength = this.min_length;
    if (this.max_length !== undefined) json.maxLength = this.max_length;
    return json;
  }
}

abstract class NumericOption extends ChoicesOption<number> {
  /** The smallest allowed value. */
  public readonly min_value?: number;
  /** The largest allowed value. */
  public readonly max_value?: number;

  /**
   * Sets the smallest allowed value.
   *
   * @param min - The minimum
   */
  public setMinValue(min: number): this {
    Reflect.set(this, 'min_value', min);
    return this;
  }

  /**
   * Sets the largest allowed value.
   *
   * @param max - The maximum
   */
  public setMaxValue(max: number): this {
    Reflect.set(this, 'max_value', max);
    return this;
  }

  public override toJSON(): RawApplicationCommandOptionData {
    const json = super.toJSON();
    if (this.min_value !== undefined) json.minValue = this.min_value;
    if (this.max_value !== undefined) json.maxValue = this.max_value;
    return json;
  }
}

/**
 * A whole number option.
 */
export class SlashCommandIntegerOption extends NumericOption {
  public readonly type = ApplicationCommandOptionType.Integer as const;
}

/**
 * A number option (fractions allowed).
 */
export class SlashCommandNumberOption extends NumericOption {
  public readonly type = ApplicationCommandOptionType.Number as const;
}

/**
 * A true or false option.
 */
export class SlashCommandBooleanOption extends ApplicationCommandOptionBase {
  public readonly type = ApplicationCommandOptionType.Boolean as const;
}

/**
 * A user option.
 */
export class SlashCommandUserOption extends ApplicationCommandOptionBase {
  public readonly type = ApplicationCommandOptionType.User as const;
}

/**
 * A role option.
 */
export class SlashCommandRoleOption extends ApplicationCommandOptionBase {
  public readonly type = ApplicationCommandOptionType.Role as const;
}

/**
 * A user or role option.
 */
export class SlashCommandMentionableOption extends ApplicationCommandOptionBase {
  public readonly type = ApplicationCommandOptionType.Mentionable as const;
}

/**
 * A file option.
 */
export class SlashCommandAttachmentOption extends ApplicationCommandOptionBase {
  public readonly type = ApplicationCommandOptionType.Attachment as const;
}

/**
 * A channel option.
 */
export class SlashCommandChannelOption extends ApplicationCommandOptionBase {
  public readonly type = ApplicationCommandOptionType.Channel as const;
  /** The channel types the user may pick. */
  public readonly channel_types?: ChannelType[];

  /**
   * Limits the channels the user may pick to these types.
   *
   * @param channelTypes - The kinds of channel that can be picked
   */
  public addChannelTypes(...channelTypes: (ChannelType | ChannelType[])[]): this {
    Reflect.set(this, 'channel_types', [...(this.channel_types ?? []), ...(channelTypes.flat() as ChannelType[])]);
    return this;
  }

  public override toJSON(): RawApplicationCommandOptionData {
    const json = super.toJSON();
    if (this.channel_types?.length) {
      json.channelTypes = this.channel_types
        .map((type) => channelTypeToBisim(type))
        .filter((type): type is NonNullable<typeof type> => type !== null);
    }
    return json;
  }
}

type OptionInput<Option> = Option | ((builder: Option) => Option);

function resolveOption<Option>(input: OptionInput<Option>, Factory: new () => Option): Option {
  return typeof input === 'function' ? (input as (builder: Option) => Option)(new Factory()) : input;
}

/**
 * The option adders shared by commands and subcommands.
 */
export abstract class SharedSlashCommandOptions extends SharedNameAndDescription {
  /** The options. */
  public readonly options: ToJSON[] = [];

  protected pushOption<Option extends ToJSON>(option: Option): this {
    if (this.options.length >= 25) throw new BisimjsRangeError(ErrorCodes.CommandOptionCount);
    this.options.push(option);
    return this;
  }

  /** Adds a text option. */
  public addStringOption(input: OptionInput<SlashCommandStringOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandStringOption));
  }

  /** Adds a whole number option. */
  public addIntegerOption(input: OptionInput<SlashCommandIntegerOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandIntegerOption));
  }

  /** Adds a number option. */
  public addNumberOption(input: OptionInput<SlashCommandNumberOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandNumberOption));
  }

  /** Adds a true or false option. */
  public addBooleanOption(input: OptionInput<SlashCommandBooleanOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandBooleanOption));
  }

  /** Adds a user option. */
  public addUserOption(input: OptionInput<SlashCommandUserOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandUserOption));
  }

  /** Adds a channel option. */
  public addChannelOption(input: OptionInput<SlashCommandChannelOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandChannelOption));
  }

  /** Adds a role option. */
  public addRoleOption(input: OptionInput<SlashCommandRoleOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandRoleOption));
  }

  /** Adds a user or role option. */
  public addMentionableOption(input: OptionInput<SlashCommandMentionableOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandMentionableOption));
  }

  /** Adds a file option. */
  public addAttachmentOption(input: OptionInput<SlashCommandAttachmentOption>): this {
    return this.pushOption(resolveOption(input, SlashCommandAttachmentOption));
  }
}

interface ToJSON {
  toJSON(): RawApplicationCommandOptionData;
}

/**
 * A subcommand: `/command subcommand`.
 */
export class SlashCommandSubcommandBuilder extends SharedSlashCommandOptions {
  /** Always {@link ApplicationCommandOptionType.Subcommand}. */
  public readonly type = ApplicationCommandOptionType.Subcommand as const;

  /**
   * The subcommand as Bisim's JSON.
   */
  public toJSON(): RawApplicationCommandOptionData {
    const json: RawApplicationCommandOptionData = {
      type: optionTypeToBisim(this.type),
      name: this.name,
      description: this.description,
    };
    if (this.options.length) json.options = this.options.map((option) => option.toJSON());
    const names = localizationsToBisim(this.name_localizations);
    if (names) json.nameLocalizations = names;
    const descriptions = localizationsToBisim(this.description_localizations);
    if (descriptions) json.descriptionLocalizations = descriptions;
    return json;
  }
}

/**
 * A group of subcommands: `/command group subcommand`.
 */
export class SlashCommandSubcommandGroupBuilder extends SharedNameAndDescription {
  /** Always {@link ApplicationCommandOptionType.SubcommandGroup}. */
  public readonly type = ApplicationCommandOptionType.SubcommandGroup as const;
  /** The subcommands in the group. */
  public readonly options: SlashCommandSubcommandBuilder[] = [];

  /**
   * Adds a subcommand to the group.
   *
   * @param input - A subcommand builder, or a function that fills one in
   */
  public addSubcommand(input: OptionInput<SlashCommandSubcommandBuilder>): this {
    if (this.options.length >= 25) throw new BisimjsRangeError(ErrorCodes.CommandOptionCount);
    this.options.push(resolveOption(input, SlashCommandSubcommandBuilder));
    return this;
  }

  /**
   * The group as Bisim's JSON.
   */
  public toJSON(): RawApplicationCommandOptionData {
    const json: RawApplicationCommandOptionData = {
      type: optionTypeToBisim(this.type),
      name: this.name,
      description: this.description,
      options: this.options.map((option) => option.toJSON()),
    };
    const names = localizationsToBisim(this.name_localizations);
    if (names) json.nameLocalizations = names;
    const descriptions = localizationsToBisim(this.description_localizations);
    if (descriptions) json.descriptionLocalizations = descriptions;
    return json;
  }
}

/**
 * Builds a slash command, the discord.js way. `toJSON()` gives Bisim's JSON (option types as names,
 * camelCase), which `client.application.commands.set()` and `rest.put(Routes.applicationCommands(...))`
 * both take.
 *
 * @example
 * ```js
 * const data = new SlashCommandBuilder()
 *   .setName('echo')
 *   .setDescription('Replies with your input')
 *   .addStringOption((option) => option.setName('input').setDescription('What to echo').setRequired(true));
 * ```
 */
export class SlashCommandBuilder extends SharedSlashCommandOptions {
  /** Who may run the command by default, as a decimal permission string. */
  public readonly default_member_permissions?: string | null;
  /** @deprecated Use {@link SlashCommandBuilder.contexts} */
  public readonly dm_permission?: boolean;
  /** Where the command can run. */
  public readonly contexts?: InteractionContextType[];
  /** Accepted for compatibility: Bisim installs commands in servers. */
  public readonly integration_types?: number[];
  /** Whether the command is age restricted. */
  public readonly nsfw?: boolean;
  /** @deprecated Use {@link SlashCommandBuilder.setDefaultMemberPermissions} */
  public readonly default_permission?: boolean;

  /**
   * Sets who may run the command by default: members with all of these permissions. `0` hides it from
   * everyone but administrators.
   *
   * @param permissions - The permissions, or `null` / `undefined` for everyone
   */
  public setDefaultMemberPermissions(permissions: PermissionResolvable | bigint | number | string | null | undefined): this {
    Reflect.set(
      this,
      'default_member_permissions',
      permissions === null || permissions === undefined ? permissions : PermissionsBitField.resolve(permissions).toString(),
    );
    return this;
  }

  /**
   * Sets whether the command can run in the bot's DMs.
   *
   * @deprecated Use {@link SlashCommandBuilder.setContexts}
   * @param enabled - Whether it can run in DMs
   */
  public setDMPermission(enabled: boolean | null | undefined): this {
    Reflect.set(this, 'dm_permission', enabled ?? undefined);
    return this;
  }

  /**
   * @deprecated Use {@link SlashCommandBuilder.setDefaultMemberPermissions}
   * @param value - Whether the command is enabled by default
   */
  public setDefaultPermission(value: boolean): this {
    Reflect.set(this, 'default_permission', value);
    return this;
  }

  /**
   * Sets where the command can run: in servers ({@link InteractionContextType.Guild}) and in the bot's own
   * DMs ({@link InteractionContextType.BotDM}).
   *
   * @param contexts - Where the command can be used
   */
  public setContexts(...contexts: (InteractionContextType | InteractionContextType[])[]): this {
    Reflect.set(this, 'contexts', contexts.flat());
    return this;
  }

  /**
   * Accepted for compatibility: Bisim installs bots in servers only.
   *
   * @param integrationTypes - How the app must be installed for the command to show
   */
  public setIntegrationTypes(...integrationTypes: (number | number[])[]): this {
    Reflect.set(this, 'integration_types', integrationTypes.flat());
    return this;
  }

  /**
   * Sets whether the command is age restricted.
   *
   * @param nsfw - Whether it is
   */
  public setNSFW(nsfw = true): this {
    Reflect.set(this, 'nsfw', nsfw);
    return this;
  }

  /**
   * Adds a subcommand.
   *
   * @param input - A subcommand builder, or a function that fills one in
   */
  public addSubcommand(input: OptionInput<SlashCommandSubcommandBuilder>): this {
    return this.pushOption(resolveOption(input, SlashCommandSubcommandBuilder));
  }

  /**
   * Adds a group of subcommands.
   *
   * @param input - A group builder, or a function that fills one in
   */
  public addSubcommandGroup(input: OptionInput<SlashCommandSubcommandGroupBuilder>): this {
    return this.pushOption(resolveOption(input, SlashCommandSubcommandGroupBuilder));
  }

  /**
   * The command as Bisim's JSON.
   */
  public toJSON(): Omit<RawApplicationCommandData, 'id'> {
    if (this.name === undefined) throw new BisimjsRangeError(ErrorCodes.CommandName, 'undefined');
    if (this.description === undefined) throw new BisimjsRangeError(ErrorCodes.CommandDescription);
    const json: Omit<RawApplicationCommandData, 'id'> = { name: this.name, description: this.description };
    if (this.options.length) json.options = this.options.map((option) => option.toJSON());
    if (this.default_member_permissions !== undefined && this.default_member_permissions !== null) {
      json.defaultMemberPermissions = this.default_member_permissions;
    }
    let contexts = this.contexts;
    if (!contexts?.length && this.dm_permission === false) contexts = [InteractionContextType.Guild];
    if (contexts?.length) {
      json.contexts = contexts.map((context) => contextToBisim(context)).filter((context): context is 'GUILD' | 'BOT_DM' => context !== null);
    }
    const names = localizationsToBisim(this.name_localizations);
    if (names) json.nameLocalizations = names;
    const descriptions = localizationsToBisim(this.description_localizations);
    if (descriptions) json.descriptionLocalizations = descriptions;
    if (this.nsfw) json.nsfw = true;
    return json;
  }
}

/**
 * The type of a slash command builder once it holds subcommands. One class serves both on Bisim.
 */
export type SlashCommandSubcommandsOnlyBuilder = SlashCommandBuilder;
/**
 * The type of a slash command builder once it holds options. One class serves both on Bisim.
 */
export type SlashCommandOptionsOnlyBuilder = SlashCommandBuilder;

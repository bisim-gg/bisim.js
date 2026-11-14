import type {
  RawApplicationCommandData,
  RawApplicationCommandOptionData,
  RawChannelType,
  RawComponentData,
} from '../types/raw.js';
import { ApplicationCommandOptionType, ApplicationCommandType, ChannelType, InteractionContextType, MessageType } from './Enums.js';

/**
 * Converts between Bisim's own names (channel types as strings, option types as names, camelCase) and the
 * numbers and shapes discord.js code uses. Everything here is pure.
 *
 * @packageDocumentation
 */

const CHANNEL_TYPES: Record<RawChannelType, ChannelType> = {
  GUILD_TEXT: ChannelType.GuildText,
  DM: ChannelType.DM,
  GUILD_VOICE: ChannelType.GuildVoice,
  GROUP_DM: ChannelType.GroupDM,
  GUILD_CATEGORY: ChannelType.GuildCategory,
};

const CHANNEL_NAMES: Partial<Record<ChannelType, RawChannelType>> = {
  [ChannelType.GuildText]: 'GUILD_TEXT',
  [ChannelType.DM]: 'DM',
  [ChannelType.GuildVoice]: 'GUILD_VOICE',
  [ChannelType.GroupDM]: 'GROUP_DM',
  [ChannelType.GuildCategory]: 'GUILD_CATEGORY',
};

/**
 * Bisim's channel type name to discord.js's {@link ChannelType} number. Unknown names read as a text channel.
 *
 * @param type - Bisim's type, or a number already
 */
export function channelTypeFromBisim(type: string | number | undefined | null): ChannelType {
  if (typeof type === 'number') return type;
  if (type && /^\d+$/.test(type)) return Number(type);
  return CHANNEL_TYPES[(type ?? 'GUILD_TEXT') as RawChannelType] ?? ChannelType.GuildText;
}

/**
 * A {@link ChannelType} number (or a name) to Bisim's channel type name, or `null` when Bisim has no such type.
 *
 * @param type - The type as a number, discord.js's key name, or Bisim's name
 */
export function channelTypeToBisim(type: ChannelType | number | string): RawChannelType | null {
  if (typeof type === 'number') return CHANNEL_NAMES[type as ChannelType] ?? null;
  if (/^\d+$/.test(type)) return CHANNEL_NAMES[Number(type) as ChannelType] ?? null;
  if (type in CHANNEL_TYPES) return type as RawChannelType;
  const fromKey = (ChannelType as unknown as Record<string, number>)[type];
  if (typeof fromKey === 'number') return CHANNEL_NAMES[fromKey as ChannelType] ?? null;
  const legacy: Record<string, RawChannelType> = {
    TEXT: 'GUILD_TEXT',
    VOICE: 'GUILD_VOICE',
    CATEGORY: 'GUILD_CATEGORY',
  };
  return legacy[type.toUpperCase()] ?? null;
}

/**
 * Bisim's message type name to discord.js's {@link MessageType} number.
 *
 * @param type - Bisim's message type
 * @param hasInteraction - Whether the message answers a command (Discord gives those their own type)
 */
export function messageTypeFromBisim(type: string | undefined | null, hasInteraction = false): MessageType {
  switch (type) {
    case 'REPLY':
      return MessageType.Reply;
    case 'SYSTEM_JOIN':
      return MessageType.UserJoin;
    case 'SYSTEM_PIN':
      return MessageType.ChannelPinnedMessage;
    case 'SYSTEM_AUTOMOD':
      return MessageType.AutoModerationAction;
    default:
      return hasInteraction ? MessageType.ChatInputCommand : MessageType.Default;
  }
}

const OPTION_NAMES: Record<ApplicationCommandOptionType, string> = {
  [ApplicationCommandOptionType.Subcommand]: 'SUB_COMMAND',
  [ApplicationCommandOptionType.SubcommandGroup]: 'SUB_COMMAND_GROUP',
  [ApplicationCommandOptionType.String]: 'STRING',
  [ApplicationCommandOptionType.Integer]: 'INTEGER',
  [ApplicationCommandOptionType.Boolean]: 'BOOLEAN',
  [ApplicationCommandOptionType.User]: 'USER',
  [ApplicationCommandOptionType.Channel]: 'CHANNEL',
  [ApplicationCommandOptionType.Role]: 'ROLE',
  [ApplicationCommandOptionType.Mentionable]: 'MENTIONABLE',
  [ApplicationCommandOptionType.Number]: 'NUMBER',
  [ApplicationCommandOptionType.Attachment]: 'ATTACHMENT',
};

const OPTION_TYPES: Record<string, ApplicationCommandOptionType> = Object.fromEntries(
  Object.entries(OPTION_NAMES).map(([type, name]) => [name, Number(type) as ApplicationCommandOptionType]),
);

/**
 * An option type (number, discord.js key name or Bisim name) to Bisim's option type name.
 *
 * @param type - The option type
 */
export function optionTypeToBisim(type: ApplicationCommandOptionType | number | string): string {
  if (typeof type === 'number') {
    const name = OPTION_NAMES[type as ApplicationCommandOptionType];
    if (!name) throw new TypeError(`Unknown application command option type: ${type}`);
    return name;
  }
  if (/^\d+$/.test(type)) return optionTypeToBisim(Number(type));
  const upper = type.toUpperCase();
  if (upper in OPTION_TYPES) return upper;
  if (upper === 'SUBCOMMAND') return 'SUB_COMMAND';
  if (upper === 'SUBCOMMANDGROUP' || upper === 'SUBCOMMAND_GROUP') return 'SUB_COMMAND_GROUP';
  const fromKey = (ApplicationCommandOptionType as unknown as Record<string, number>)[type];
  if (typeof fromKey === 'number') return OPTION_NAMES[fromKey as ApplicationCommandOptionType];
  throw new TypeError(`Unknown application command option type: ${type}`);
}

/**
 * Bisim's option type name (or a number) to discord.js's {@link ApplicationCommandOptionType} number.
 *
 * @param type - The option type
 */
export function optionTypeFromBisim(type: string | number): ApplicationCommandOptionType {
  if (typeof type === 'number') return type;
  if (/^\d+$/.test(type)) return Number(type);
  const found = OPTION_TYPES[optionTypeToBisim(type)];
  if (found === undefined) throw new TypeError(`Unknown application command option type: ${type}`);
  return found;
}

const COMMAND_TYPE_NAMES: Record<string, ApplicationCommandType> = {
  CHAT_INPUT: ApplicationCommandType.ChatInput,
  USER: ApplicationCommandType.User,
  MESSAGE: ApplicationCommandType.Message,
};

/**
 * A command type from Bisim (number or name) to discord.js's {@link ApplicationCommandType}.
 *
 * @param type - The command type
 */
export function commandTypeFromBisim(type: string | number | undefined | null): ApplicationCommandType {
  if (type === undefined || type === null || type === '') return ApplicationCommandType.ChatInput;
  if (typeof type === 'number') return type;
  if (/^\d+$/.test(type)) return Number(type);
  return COMMAND_TYPE_NAMES[type.toUpperCase()] ?? ApplicationCommandType.ChatInput;
}

/**
 * A context (number, discord.js key name or Bisim name) to Bisim's context name, or `null` for a context
 * Bisim does not have.
 *
 * @param context - The context
 */
export function contextToBisim(context: InteractionContextType | number | string): 'GUILD' | 'BOT_DM' | null {
  if (context === InteractionContextType.Guild || context === 'GUILD' || context === 'Guild' || context === '0') return 'GUILD';
  if (context === InteractionContextType.BotDM || context === 'BOT_DM' || context === 'BotDM' || context === '1') return 'BOT_DM';
  return null;
}

/**
 * Bisim's context name to discord.js's {@link InteractionContextType}.
 *
 * @param context - The context
 */
export function contextFromBisim(context: string | number): InteractionContextType | null {
  if (typeof context === 'number') return context;
  if (context === 'GUILD') return InteractionContextType.Guild;
  if (context === 'BOT_DM') return InteractionContextType.BotDM;
  if (/^\d+$/.test(context)) return Number(context);
  return null;
}

/**
 * Discord locale keys to Bisim's two languages: anything English becomes `en`, Persian stays `fa`, and
 * languages Bisim does not show are dropped.
 *
 * @param localizations - The localizations map
 */
export function localizationsToBisim(
  localizations: Record<string, string | null | undefined> | null | undefined,
): { fa?: string; en?: string } | undefined {
  if (!localizations) return undefined;
  const result: { fa?: string; en?: string } = {};
  for (const [locale, value] of Object.entries(localizations)) {
    if (typeof value !== 'string') continue;
    const lower = locale.toLowerCase();
    if (lower === 'fa' || lower.startsWith('fa-')) result.fa = value;
    else if (lower === 'en' || lower.startsWith('en-')) {
      if (lower === 'en' || lower === 'en-us' || result.en === undefined) result.en = value;
    }
  }
  return Object.keys(result).length ? result : undefined;
}

/**
 * Reads a value as a plain object, calling `toJSON()` on builders and structures.
 *
 * @param value - A builder, a structure or a plain object
 * @internal
 */
export function toPlain<Output = Record<string, unknown>>(value: unknown): Output {
  if (value && typeof value === 'object' && typeof (value as { toJSON?: unknown }).toJSON === 'function') {
    return (value as { toJSON: () => Output }).toJSON();
  }
  return value as Output;
}

/**
 * Reads a key in either camelCase or snake_case.
 *
 * @internal
 */
export function pick<Value = unknown>(data: Record<string, unknown>, camel: string, snake?: string): Value | undefined {
  if (data[camel] !== undefined) return data[camel] as Value;
  const snakeKey = snake ?? camel.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
  return data[snakeKey] as Value | undefined;
}

function cleanObject<Data extends Record<string, unknown>>(data: Data): Data {
  for (const key of Object.keys(data)) {
    if (data[key] === undefined) delete data[key];
  }
  return data;
}

/**
 * Converts one command option (discord.js data, Discord JSON or Bisim JSON) to Bisim's JSON.
 *
 * @param input - The option
 * @internal
 */
export function toBisimCommandOption(input: unknown): RawApplicationCommandOptionData {
  const data = toPlain<Record<string, unknown>>(input);
  const type = optionTypeToBisim(data.type as string | number);
  const choices = pick<{ name: string; value: string | number; name_localizations?: Record<string, string> }[]>(
    data,
    'choices',
  );
  const nested = pick<unknown[]>(data, 'options');
  const channelTypes = pick<(number | string)[]>(data, 'channelTypes');
  return cleanObject({
    type,
    name: data.name as string,
    description: data.description as string | undefined,
    required: data.required === true ? true : undefined,
    choices: choices?.map((choice) =>
      cleanObject({
        name: choice.name,
        value: choice.value,
        nameLocalizations: localizationsToBisim(
          pick<Record<string, string>>(choice as unknown as Record<string, unknown>, 'nameLocalizations'),
        ),
      }),
    ),
    minValue: pick<number>(data, 'minValue'),
    maxValue: pick<number>(data, 'maxValue'),
    minLength: pick<number>(data, 'minLength'),
    maxLength: pick<number>(data, 'maxLength'),
    autocomplete: data.autocomplete === true ? true : undefined,
    channelTypes: channelTypes
      ?.map((channelType) => channelTypeToBisim(channelType))
      .filter((name): name is RawChannelType => name !== null),
    options: nested?.map((option) => toBisimCommandOption(option)),
    nameLocalizations: localizationsToBisim(pick(data, 'nameLocalizations')),
    descriptionLocalizations: localizationsToBisim(pick(data, 'descriptionLocalizations')),
  }) as RawApplicationCommandOptionData;
}

/**
 * Converts a command (a builder, discord.js's `ApplicationCommandData`, Discord's JSON, or Bisim's JSON) to
 * the JSON Bisim's command routes take: camelCase, option types as names, Bisim's contexts and languages.
 *
 * @param input - The command
 * @param partial - Whether this is an edit, where missing fields stay as they are
 */
export function toBisimCommand(input: unknown, partial = false): Omit<RawApplicationCommandData, 'id'> {
  const data = toPlain<Record<string, unknown>>(input);
  const type = data.type === undefined ? undefined : commandTypeFromBisim(data.type as number | string);
  const permissions = pick<string | number | bigint | null>(data, 'defaultMemberPermissions');
  let contexts = pick<(number | string)[] | null>(data, 'contexts');
  const dmPermission = pick<boolean | null>(data, 'dmPermission');
  if ((contexts === undefined || contexts === null) && dmPermission === false) contexts = [InteractionContextType.Guild];
  const options = pick<unknown[]>(data, 'options');
  const isContextMenu = type === ApplicationCommandType.User || type === ApplicationCommandType.Message;
  return cleanObject({
    type: type === ApplicationCommandType.ChatInput && !partial ? undefined : type,
    name: data.name as string,
    description: isContextMenu ? undefined : partial ? (data.description as string | undefined) : ((data.description as string | undefined) ?? ''),
    options: options === undefined ? undefined : options.length || partial ? options.map((option) => toBisimCommandOption(option)) : undefined,
    defaultMemberPermissions:
      permissions === undefined || permissions === null ? undefined : String(BigInt(permissions as string)),
    contexts: contexts
      ?.map((context) => contextToBisim(context))
      .filter((context): context is 'GUILD' | 'BOT_DM' => context !== null),
    nameLocalizations: localizationsToBisim(pick(data, 'nameLocalizations')),
    descriptionLocalizations: localizationsToBisim(pick(data, 'descriptionLocalizations')),
    nsfw: data.nsfw === true ? true : undefined,
  }) as Omit<RawApplicationCommandData, 'id'>;
}

/**
 * Converts a component emoji (a string or an object) to Bisim's shape.
 *
 * @internal
 */
export function toBisimComponentEmoji(
  emoji: unknown,
): { id?: string; name?: string; animated?: boolean } | undefined {
  if (emoji === undefined || emoji === null) return undefined;
  if (typeof emoji === 'string') {
    const match = /^<?(a)?:?(\w{2,32}):(\d{1,20})>?$/.exec(emoji);
    if (match) return cleanObject({ id: match[3], name: match[2], animated: match[1] ? true : undefined });
    if (/^\d{1,20}$/.test(emoji)) return { id: emoji };
    return { name: emoji };
  }
  const data = emoji as { id?: string | null; name?: string | null; animated?: boolean | null };
  return cleanObject({
    id: data.id ?? undefined,
    name: data.name ?? undefined,
    animated: data.animated ? true : undefined,
  });
}

/**
 * Converts a component (a builder, Discord's snake_case JSON or Bisim's camelCase JSON) to Bisim's JSON.
 *
 * @param input - The component or action row
 */
export function toBisimComponent(input: unknown): RawComponentData {
  const data = toPlain<Record<string, unknown>>(input);
  const nested = pick<unknown[]>(data, 'components');
  const options = pick<Record<string, unknown>[]>(data, 'options');
  const channelTypes = pick<(number | string)[]>(data, 'channelTypes');
  return cleanObject({
    type: data.type as number,
    style: data.style as number | undefined,
    label: data.label as string | undefined,
    emoji: toBisimComponentEmoji(data.emoji),
    customId: pick<string>(data, 'customId'),
    url: data.url as string | undefined,
    disabled: data.disabled === true ? true : undefined,
    placeholder: data.placeholder as string | undefined,
    minValues: pick<number>(data, 'minValues'),
    maxValues: pick<number>(data, 'maxValues'),
    minLength: pick<number>(data, 'minLength'),
    maxLength: pick<number>(data, 'maxLength'),
    required: typeof data.required === 'boolean' ? data.required : undefined,
    value: data.value as string | undefined,
    options: options?.map((option) =>
      cleanObject({
        label: option.label as string,
        value: option.value as string,
        description: option.description as string | undefined,
        emoji: toBisimComponentEmoji(option.emoji),
        default: option.default === true ? true : undefined,
      }),
    ),
    channelTypes: channelTypes
      ?.map((channelType) => channelTypeToBisim(channelType))
      .filter((name): name is RawChannelType => name !== null),
    components: nested?.map((component) => toBisimComponent(component)),
  }) as RawComponentData;
}

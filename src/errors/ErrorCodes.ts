/**
 * The codes of the errors bisim.js throws itself. The names match discord.js's where discord.js has the same
 * error, so `error.code === ErrorCodes.InteractionAlreadyReplied` keeps working. `NotSupported` is Bisim's
 * own: the feature exists in discord.js but not on Bisim.
 */
export const ErrorCodes = {
  ClientInvalidOption: 'ClientInvalidOption',
  ClientInvalidProvidedShards: 'ClientInvalidProvidedShards',
  ClientMissingIntents: 'ClientMissingIntents',
  ClientNotReady: 'ClientNotReady',

  TokenInvalid: 'TokenInvalid',
  TokenMissing: 'TokenMissing',
  ApplicationCommandPermissionsTokenMissing: 'ApplicationCommandPermissionsTokenMissing',

  WSCloseRequested: 'WSCloseRequested',
  WSConnectionExists: 'WSConnectionExists',
  WSNotOpen: 'WSNotOpen',

  BitFieldInvalid: 'BitFieldInvalid',

  InvalidIntents: 'InvalidIntents',
  DisallowedIntents: 'DisallowedIntents',
  MissingIntent: 'MissingIntent',

  ColorRange: 'ColorRange',
  ColorConvert: 'ColorConvert',

  InviteOptionsMissingChannel: 'InviteOptionsMissingChannel',

  ButtonLabel: 'ButtonLabel',
  ButtonURL: 'ButtonURL',
  ButtonCustomId: 'ButtonCustomId',

  SelectMenuCustomId: 'SelectMenuCustomId',
  SelectMenuPlaceholder: 'SelectMenuPlaceholder',
  SelectOptionLabel: 'SelectOptionLabel',
  SelectOptionValue: 'SelectOptionValue',
  SelectOptionDescription: 'SelectOptionDescription',

  TextInputCustomId: 'TextInputCustomId',
  TextInputLabel: 'TextInputLabel',

  ModalCustomId: 'ModalCustomId',
  ModalTitle: 'ModalTitle',

  EmbedTitle: 'EmbedTitle',
  EmbedDescription: 'EmbedDescription',
  EmbedFooterText: 'EmbedFooterText',
  EmbedAuthorName: 'EmbedAuthorName',
  EmbedFieldName: 'EmbedFieldName',
  EmbedFieldValue: 'EmbedFieldValue',
  EmbedFieldCount: 'EmbedFieldCount',

  CommandName: 'CommandName',
  CommandDescription: 'CommandDescription',
  CommandOptionCount: 'CommandOptionCount',

  FileNotFound: 'FileNotFound',

  UserNoDMChannel: 'UserNoDMChannel',

  VoiceNotStageChannel: 'VoiceNotStageChannel',
  VoiceStateNotOwn: 'VoiceStateNotOwn',
  VoiceStateInvalidType: 'VoiceStateInvalidType',

  ReqResourceType: 'ReqResourceType',

  MessageBulkDeleteType: 'MessageBulkDeleteType',
  MessageContentType: 'MessageContentType',
  MessageNonceRequired: 'MessageNonceRequired',
  MessageNonceType: 'MessageNonceType',
  MessageReferenceMissing: 'MessageReferenceMissing',

  BanResolveId: 'BanResolveId',
  FetchBanResolveId: 'FetchBanResolveId',
  BulkBanUsersOptionEmpty: 'BulkBanUsersOptionEmpty',

  GuildChannelResolve: 'GuildChannelResolve',
  GuildVoiceChannelResolve: 'GuildVoiceChannelResolve',
  GuildChannelOrphan: 'GuildChannelOrphan',
  GuildChannelUnowned: 'GuildChannelUnowned',
  GuildOwned: 'GuildOwned',
  GuildMembersTimeout: 'GuildMembersTimeout',
  GuildUncachedMe: 'GuildUncachedMe',
  ChannelNotCached: 'ChannelNotCached',
  FetchOwnerId: 'FetchOwnerId',

  InvalidType: 'InvalidType',
  InvalidElement: 'InvalidElement',

  WebhookMessage: 'WebhookMessage',
  WebhookTokenUnavailable: 'WebhookTokenUnavailable',
  WebhookURLInvalid: 'WebhookURLInvalid',
  WebhookApplication: 'WebhookApplication',

  EmojiType: 'EmojiType',
  EmojiManaged: 'EmojiManaged',

  ReactionResolveUser: 'ReactionResolveUser',

  InviteResolveCode: 'InviteResolveCode',
  InviteNotFound: 'InviteNotFound',

  GlobalCommandPermissions: 'GlobalCommandPermissions',
  GuildUncachedEntityResolve: 'GuildUncachedEntityResolve',

  InteractionAlreadyReplied: 'InteractionAlreadyReplied',
  InteractionNotReplied: 'InteractionNotReplied',

  CommandInteractionOptionNotFound: 'CommandInteractionOptionNotFound',
  CommandInteractionOptionType: 'CommandInteractionOptionType',
  CommandInteractionOptionEmpty: 'CommandInteractionOptionEmpty',
  CommandInteractionOptionNoSubcommand: 'CommandInteractionOptionNoSubcommand',
  CommandInteractionOptionNoSubcommandGroup: 'CommandInteractionOptionNoSubcommandGroup',
  CommandInteractionOptionInvalidChannelType: 'CommandInteractionOptionInvalidChannelType',
  AutocompleteInteractionOptionNoFocusedOption: 'AutocompleteInteractionOptionNoFocusedOption',

  ModalSubmitInteractionFieldNotFound: 'ModalSubmitInteractionFieldNotFound',
  ModalSubmitInteractionFieldType: 'ModalSubmitInteractionFieldType',

  InvalidMissingScopes: 'InvalidMissingScopes',
  InvalidScopesWithPermissions: 'InvalidScopesWithPermissions',

  NotImplemented: 'NotImplemented',
  NotSupported: 'NotSupported',

  SweepFilterReturn: 'SweepFilterReturn',

  PollAlreadyExpired: 'PollAlreadyExpired',

  InteractionCollectorError: 'InteractionCollectorError',
  InteractionVerifyFailed: 'InteractionVerifyFailed',
} as const;

/**
 * One of the codes in {@link ErrorCodes}.
 */
export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

const join = (value: unknown): string => (Array.isArray(value) ? value.join(', ') : String(value));

/**
 * The message for each code. A function receives the arguments the error was created with.
 */
export const Messages: Record<ErrorCode, string | ((...args: any[]) => string)> = {
  ClientInvalidOption: (prop: string, must: string) => `The ${prop} option must be ${must}`,
  ClientInvalidProvidedShards: 'Bisim has no sharding: only shard 0 exists.',
  ClientMissingIntents: 'Valid intents must be provided for the Client.',
  ClientNotReady: (action: string) => `The client needs to be logged in to ${action}.`,

  TokenInvalid: 'An invalid token was provided.',
  TokenMissing: 'Request to use a token, but no token was provided to the client.',
  ApplicationCommandPermissionsTokenMissing: 'Editing command permissions needs a user token, which Bisim does not offer.',

  WSCloseRequested: 'The WebSocket was closed because it was asked to close.',
  WSConnectionExists: 'There is already an existing WebSocket connection.',
  WSNotOpen: (data = 'data') => `The WebSocket is not open to send ${data}.`,

  BitFieldInvalid: (bit: unknown) => `Invalid bitfield flag or number: ${String(bit)}.`,

  InvalidIntents: 'Invalid intent provided for WebSocket intents.',
  DisallowedIntents:
    'Privileged intent provided is not enabled or whitelisted. Switch it on in the Developer Portal: bisim.gg/developers, ' +
    'your app, Bot, Privileged Gateway Intents (from 100 servers on, Bisim must approve it too).',
  MissingIntent: (action: string, intent: string) =>
    `${action} needs the ${intent}. Switch it on in the Developer Portal: bisim.gg/developers, your app, Bot, Privileged Gateway Intents.`,

  ColorRange: 'Color must be within the range 0 - 16777215 (0xFFFFFF).',
  ColorConvert: (color: unknown) => `Unable to convert "${String(color)}" to a number.`,

  InviteOptionsMissingChannel: 'A valid guild channel must be provided when an invite is created.',

  ButtonLabel: 'A button must have a label or an emoji.',
  ButtonURL: 'A link button must have a url, and no custom id.',
  ButtonCustomId: 'A button must have a custom id (up to 100 characters), unless it is a link button.',

  SelectMenuCustomId: 'A select menu must have a custom id (up to 100 characters).',
  SelectMenuPlaceholder: 'A select menu placeholder is at most 150 characters.',
  SelectOptionLabel: 'A select menu option must have a label (up to 100 characters).',
  SelectOptionValue: 'A select menu option must have a value (up to 100 characters).',
  SelectOptionDescription: 'A select menu option description is at most 100 characters.',

  TextInputCustomId: 'A text input must have a custom id (up to 100 characters).',
  TextInputLabel: 'A text input must have a label (up to 45 characters).',

  ModalCustomId: 'A modal must have a custom id (up to 100 characters).',
  ModalTitle: 'A modal must have a title (up to 45 characters).',

  EmbedTitle: 'An embed title is at most 256 characters.',
  EmbedDescription: 'An embed description is at most 4096 characters.',
  EmbedFooterText: 'An embed footer text is at most 2048 characters.',
  EmbedAuthorName: 'An embed author name is at most 256 characters.',
  EmbedFieldName: 'An embed field name is 1 to 256 characters.',
  EmbedFieldValue: 'An embed field value is 1 to 1024 characters.',
  EmbedFieldCount: 'An embed has at most 25 fields.',

  CommandName: (name: string) =>
    `Invalid command name "${name}": 1 to 32 lowercase letters, digits, "-" or "_" (context menu commands may use spaces and capitals).`,
  CommandDescription: 'A command description is 1 to 100 characters.',
  CommandOptionCount: 'A command has at most 25 options.',

  FileNotFound: (file: string) => `File could not be found: ${file}`,

  UserNoDMChannel: 'No DM Channel exists!',

  VoiceNotStageChannel: 'Bisim has no stage channels.',
  VoiceStateNotOwn: 'You cannot self-deafen or self-mute on voice states other than the client user.',
  VoiceStateInvalidType: (name: string) => `${name} must be a voice channel.`,

  ReqResourceType: 'The resource must be a string, Buffer, a stream, or a valid file path.',

  MessageBulkDeleteType: 'The messages must be an Array, Collection, or number.',
  MessageContentType: 'Message content must be a string.',
  MessageNonceRequired: 'Message nonce is required when enforceNonce is true.',
  MessageNonceType: 'Message nonce must be an integer or a string.',
  MessageReferenceMissing: 'The message to reply to could not be found.',

  BanResolveId: (ban = false) => `Couldn't resolve the user id to ${ban ? 'ban' : 'unban'}.`,
  BulkBanUsersOptionEmpty: 'Option "users" array or collection is empty',
  FetchBanResolveId: "Couldn't resolve the user id to fetch the ban.",

  GuildChannelResolve: 'Could not resolve channel to a guild channel.',
  GuildVoiceChannelResolve: 'Could not resolve channel to a guild voice channel.',
  GuildChannelOrphan: 'Could not find a parent to this guild channel.',
  GuildChannelUnowned: "The fetched channel does not belong to this manager's guild.",
  GuildOwned: 'Guild is owned by the client.',
  GuildMembersTimeout: "Members didn't arrive in time.",
  GuildUncachedMe: 'The client user as a member of this guild is uncached.',
  ChannelNotCached: 'Could not find the channel where this message came from in the cache!',
  FetchOwnerId: (type = 'guild') => `Couldn't resolve the ${type} ownerId to fetch the ${type} owner.`,

  InvalidType: (name: string, expected: string, an = false) => `Supplied ${name} is not a${an ? 'n' : ''} ${expected}.`,
  InvalidElement: (type: string, name: string, elem: unknown) => `Supplied ${type} ${name} includes an invalid element: ${String(elem)}`,

  WebhookMessage: 'The message was not sent by a webhook.',
  WebhookTokenUnavailable: 'This action requires a webhook token, but none is available.',
  WebhookURLInvalid: 'The provided webhook URL is not valid.',
  WebhookApplication: 'This message webhook belongs to an application and cannot be fetched.',

  EmojiType: 'Emoji must be a string or GuildEmoji/ReactionEmoji',
  EmojiManaged: 'Emoji is managed and has no Author.',

  ReactionResolveUser: "Couldn't resolve the user id to remove from the reaction.",

  InviteResolveCode: 'Could not resolve the code to fetch the invite.',
  InviteNotFound: 'Could not find the requested invite.',

  GlobalCommandPermissions: 'Permissions for global commands may only be fetched or modified by providing a GuildResolvable.',
  GuildUncachedEntityResolve: (type: string) => `Cannot resolve ${type} from an arbitrary guild, provide an id instead`,

  InteractionAlreadyReplied: 'The reply to this interaction has already been sent or deferred.',
  InteractionNotReplied: 'The reply to this interaction has not been sent or deferred.',

  CommandInteractionOptionNotFound: (name: string) => `Required option "${name}" not found.`,
  CommandInteractionOptionType: (name: string, type: unknown, expected: string) =>
    `Option "${name}" is of type: ${String(type)}; expected ${expected}.`,
  CommandInteractionOptionEmpty: (name: string, type: unknown) =>
    `Required option "${name}" is of type: ${String(type)}; expected a non-empty value.`,
  CommandInteractionOptionNoSubcommand: 'No subcommand specified for interaction.',
  CommandInteractionOptionNoSubcommandGroup: 'No subcommand group specified for interaction.',
  CommandInteractionOptionInvalidChannelType: (name: string, type: unknown, expected: string) =>
    `The type of channel of the option "${name}" is: ${String(type)}; expected ${expected}.`,
  AutocompleteInteractionOptionNoFocusedOption: 'No focused option for autocomplete interaction.',

  ModalSubmitInteractionFieldNotFound: (customId: string) => `Required field with custom id "${customId}" not found.`,
  ModalSubmitInteractionFieldType: (customId: string, type: unknown, expected: string) =>
    `Field with custom id "${customId}" is of type: ${String(type)}; expected ${expected}.`,

  InvalidMissingScopes: 'At least one valid scope must be provided for the invite',
  InvalidScopesWithPermissions: 'Permissions cannot be set without the bot scope.',

  NotImplemented: (what: string, name: string) => `Method ${what} not implemented on ${name}.`,
  NotSupported: (feature: string) => `${feature}: not supported on Bisim.`,

  SweepFilterReturn: 'The return value of the sweepFilter function was not false or a Function',

  PollAlreadyExpired: 'This poll has already expired.',

  InteractionCollectorError: (reason: string) => `Collector received no interactions before ending with reason: ${reason}`,
  InteractionVerifyFailed: 'The interaction signature could not be verified.',
};

/**
 * Builds the message for an error code.
 *
 * @internal
 */
export function messageFor(code: ErrorCode, args: unknown[]): string {
  const message = Messages[code];
  if (message === undefined) return `Unknown error (${code}): ${args.map(join).join(' ')}`;
  return typeof message === 'function' ? message(...args) : message;
}

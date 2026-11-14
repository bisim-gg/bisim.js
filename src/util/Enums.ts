/**
 * The enums a discord.js bot uses, with discord.js's names and Discord's numbers. Bisim uses the same
 * numbers, so `channel.type === ChannelType.GuildText` and `ButtonStyle.Primary` mean what they always meant.
 * Values Bisim does not have (threads, stages, forums...) are still defined so code that mentions them keeps
 * compiling; Bisim never produces them.
 *
 * @packageDocumentation
 */

/**
 * The type of a channel.
 */
export enum ChannelType {
  /** A text channel in a server. */
  GuildText = 0,
  /** A direct message between two users. */
  DM = 1,
  /** A voice channel in a server. */
  GuildVoice = 2,
  /** A direct message between several users. */
  GroupDM = 3,
  /** A category that holds other channels. */
  GuildCategory = 4,
  /** Not on Bisim. */
  GuildAnnouncement = 5,
  /** Not on Bisim. */
  AnnouncementThread = 10,
  /** Not on Bisim. */
  PublicThread = 11,
  /** Not on Bisim. */
  PrivateThread = 12,
  /** Not on Bisim. */
  GuildStageVoice = 13,
  /** Not on Bisim. */
  GuildDirectory = 14,
  /** Not on Bisim. */
  GuildForum = 15,
  /** Not on Bisim. */
  GuildMedia = 16,
}

/**
 * The type of a message.
 */
export enum MessageType {
  Default = 0,
  RecipientAdd = 1,
  RecipientRemove = 2,
  Call = 3,
  ChannelNameChange = 4,
  ChannelIconChange = 5,
  ChannelPinnedMessage = 6,
  UserJoin = 7,
  GuildBoost = 8,
  GuildBoostTier1 = 9,
  GuildBoostTier2 = 10,
  GuildBoostTier3 = 11,
  ChannelFollowAdd = 12,
  GuildDiscoveryDisqualified = 14,
  GuildDiscoveryRequalified = 15,
  GuildDiscoveryGracePeriodInitialWarning = 16,
  GuildDiscoveryGracePeriodFinalWarning = 17,
  ThreadCreated = 18,
  Reply = 19,
  ChatInputCommand = 20,
  ThreadStarterMessage = 21,
  GuildInviteReminder = 22,
  ContextMenuCommand = 23,
  AutoModerationAction = 24,
  RoleSubscriptionPurchase = 25,
  InteractionPremiumUpsell = 26,
  StageStart = 27,
  StageEnd = 28,
  StageSpeaker = 29,
  StageRaiseHand = 30,
  StageTopic = 31,
  GuildApplicationPremiumSubscription = 32,
  GuildIncidentAlertModeEnabled = 36,
  GuildIncidentAlertModeDisabled = 37,
  GuildIncidentReportRaid = 38,
  GuildIncidentReportFalseAlarm = 39,
  PurchaseNotification = 44,
  PollResult = 46,
}

/**
 * Whether a permission overwrite targets a role or a member.
 */
export enum OverwriteType {
  Role = 0,
  Member = 1,
}

/**
 * The verification level of a server.
 */
export enum GuildVerificationLevel {
  None = 0,
  Low = 1,
  Medium = 2,
  High = 3,
  VeryHigh = 4,
}

/**
 * The default notification setting of a server.
 */
export enum GuildDefaultMessageNotifications {
  AllMessages = 0,
  OnlyMentions = 1,
}

/**
 * The explicit content filter of a server.
 */
export enum GuildExplicitContentFilter {
  Disabled = 0,
  MembersWithoutRoles = 1,
  AllMembers = 2,
}

/**
 * The two-factor requirement of a server's moderators.
 */
export enum GuildMFALevel {
  None = 0,
  Elevated = 1,
}

/**
 * The age rating of a server.
 */
export enum GuildNSFWLevel {
  Default = 0,
  Explicit = 1,
  Safe = 2,
  AgeRestricted = 3,
}

/**
 * The boost tier of a server. Bisim has no boosts: always `None`.
 */
export enum GuildPremiumTier {
  None = 0,
  Tier1 = 1,
  Tier2 = 2,
  Tier3 = 3,
}

/**
 * The style of a button.
 */
export enum ButtonStyle {
  Primary = 1,
  Secondary = 2,
  Success = 3,
  Danger = 4,
  Link = 5,
  /** Not on Bisim. */
  Premium = 6,
}

/**
 * The type of a message component.
 */
export enum ComponentType {
  ActionRow = 1,
  Button = 2,
  StringSelect = 3,
  TextInput = 4,
  UserSelect = 5,
  RoleSelect = 6,
  MentionableSelect = 7,
  ChannelSelect = 8,
  /** Not on Bisim. */
  Section = 9,
  /** Not on Bisim. */
  TextDisplay = 10,
  /** Not on Bisim. */
  Thumbnail = 11,
  /** Not on Bisim. */
  MediaGallery = 12,
  /** Not on Bisim. */
  File = 13,
  /** Not on Bisim. */
  Separator = 14,
  /** Not on Bisim. */
  Container = 17,
  /** Not on Bisim. */
  Label = 18,
  /**
   * The old name of {@link ComponentType.StringSelect}.
   *
   * @deprecated Use {@link ComponentType.StringSelect}
   */
  SelectMenu = 3,
}

/**
 * The style of a text input in a modal.
 */
export enum TextInputStyle {
  Short = 1,
  Paragraph = 2,
}

/**
 * The type of an application command.
 */
export enum ApplicationCommandType {
  ChatInput = 1,
  User = 2,
  Message = 3,
  /** Not on Bisim. */
  PrimaryEntryPoint = 4,
}

/**
 * The type of an application command option.
 */
export enum ApplicationCommandOptionType {
  Subcommand = 1,
  SubcommandGroup = 2,
  String = 3,
  Integer = 4,
  Boolean = 5,
  User = 6,
  Channel = 7,
  Role = 8,
  Mentionable = 9,
  Number = 10,
  Attachment = 11,
}

/**
 * The type of an interaction.
 */
export enum InteractionType {
  Ping = 1,
  ApplicationCommand = 2,
  MessageComponent = 3,
  ApplicationCommandAutocomplete = 4,
  ModalSubmit = 5,
}

/**
 * The type of an answer to an interaction.
 */
export enum InteractionResponseType {
  Pong = 1,
  ChannelMessageWithSource = 4,
  DeferredChannelMessageWithSource = 5,
  DeferredMessageUpdate = 6,
  UpdateMessage = 7,
  ApplicationCommandAutocompleteResult = 8,
  Modal = 9,
  /** Not on Bisim. */
  PremiumRequired = 10,
  /** Not on Bisim. */
  LaunchActivity = 12,
}

/**
 * Where a command can run. Bisim has servers (`Guild`) and the bot's own DMs (`BotDM`).
 */
export enum InteractionContextType {
  Guild = 0,
  BotDM = 1,
  /** Not on Bisim: commands do not run in other people's DMs. */
  PrivateChannel = 2,
}

/**
 * How an application is installed. Bisim installs bots in servers only.
 */
export enum ApplicationIntegrationType {
  GuildInstall = 0,
  /** Not on Bisim. */
  UserInstall = 1,
}

/**
 * The type of an activity in a presence.
 */
export enum ActivityType {
  Playing = 0,
  Streaming = 1,
  Listening = 2,
  Watching = 3,
  Custom = 4,
  Competing = 5,
}

/**
 * A presence status.
 */
export enum PresenceUpdateStatus {
  Online = 'online',
  DoNotDisturb = 'dnd',
  Idle = 'idle',
  Invisible = 'invisible',
  Offline = 'offline',
}

/**
 * The flags of a message.
 */
export enum MessageFlags {
  Crossposted = 1 << 0,
  IsCrosspost = 1 << 1,
  SuppressEmbeds = 1 << 2,
  SourceMessageDeleted = 1 << 3,
  Urgent = 1 << 4,
  HasThread = 1 << 5,
  /** Only the person who ran the command sees the message. */
  Ephemeral = 1 << 6,
  /** The application is still thinking (a deferred answer). */
  Loading = 1 << 7,
  FailedToMentionSomeRolesInThread = 1 << 8,
  ShouldShowLinkNotDiscordWarning = 1 << 10,
  SuppressNotifications = 1 << 12,
  IsVoiceMessage = 1 << 13,
  HasSnapshot = 1 << 14,
  IsComponentsV2 = 1 << 15,
}

/**
 * The type of a webhook.
 */
export enum WebhookType {
  Incoming = 1,
  ChannelFollower = 2,
  Application = 3,
}

/**
 * The type of a reaction. Bisim has normal reactions only.
 */
export enum ReactionType {
  Normal = 0,
  Super = 1,
}

/**
 * The kinds of mention `allowedMentions.parse` names. Accepted for compatibility; Bisim does not filter
 * mentions yet.
 */
export enum AllowedMentionsTypes {
  Everyone = 'everyone',
  Role = 'roles',
  User = 'users',
}

/**
 * The type of a default value in an auto-populated select menu.
 */
export enum SelectMenuDefaultValueType {
  Channel = 'channel',
  Role = 'role',
  User = 'user',
}

/**
 * OAuth2 scopes. Bisim's install link understands `bot` (and accepts `applications.commands`).
 */
export enum OAuth2Scopes {
  Bot = 'bot',
  ApplicationsCommands = 'applications.commands',
  ApplicationsCommandsUpdate = 'applications.commands.update',
  Identify = 'identify',
  Email = 'email',
  Guilds = 'guilds',
  GuildsJoin = 'guilds.join',
  GuildsMembersRead = 'guilds.members.read',
  MessagesRead = 'messages.read',
  WebhookIncoming = 'webhook.incoming',
}

/**
 * A language code. Bisim shows commands in Persian (`fa`) and English (`en`); the Discord locales are kept so
 * code that names them still compiles, and English variants map to `en`.
 */
export enum Locale {
  Persian = 'fa',
  English = 'en',
  EnglishUS = 'en-US',
  EnglishGB = 'en-GB',
  Indonesian = 'id',
  Bulgarian = 'bg',
  ChineseCN = 'zh-CN',
  ChineseTW = 'zh-TW',
  Croatian = 'hr',
  Czech = 'cs',
  Danish = 'da',
  Dutch = 'nl',
  Finnish = 'fi',
  French = 'fr',
  German = 'de',
  Greek = 'el',
  Hindi = 'hi',
  Hungarian = 'hu',
  Italian = 'it',
  Japanese = 'ja',
  Korean = 'ko',
  Lithuanian = 'lt',
  Norwegian = 'no',
  Polish = 'pl',
  PortugueseBR = 'pt-BR',
  Romanian = 'ro',
  Russian = 'ru',
  SpanishES = 'es-ES',
  SpanishLATAM = 'es-419',
  Swedish = 'sv-SE',
  Thai = 'th',
  Turkish = 'tr',
  Ukrainian = 'uk',
  Vietnamese = 'vi',
}

/**
 * The connection status of the client's WebSocket.
 */
export enum Status {
  Ready = 0,
  Connecting = 1,
  Reconnecting = 2,
  Idle = 3,
  Nearly = 4,
  Disconnected = 5,
  WaitingForGuilds = 6,
  Identifying = 7,
  Resuming = 8,
}

/**
 * Data that a structure may be missing until it is fetched. Accepted for compatibility: bisim.js creates
 * partial structures for messages, reactions, users and members it has not cached when the matching partial
 * is enabled, like discord.js does.
 */
export enum Partials {
  User = 0,
  Channel = 1,
  GuildMember = 2,
  Message = 3,
  Reaction = 4,
  GuildScheduledEvent = 5,
  ThreadMember = 6,
  Poll = 7,
  PollAnswer = 8,
  SoundboardSound = 9,
}

/**
 * The gateway intents. Bisim accepts them for compatibility and ignores them: a bot receives what its
 * permissions let it see.
 */
export enum GatewayIntentBits {
  Guilds = 1 << 0,
  GuildMembers = 1 << 1,
  GuildModeration = 1 << 2,
  /** @deprecated Use {@link GatewayIntentBits.GuildModeration} */
  GuildBans = 1 << 2,
  GuildExpressions = 1 << 3,
  /** @deprecated Use {@link GatewayIntentBits.GuildExpressions} */
  GuildEmojisAndStickers = 1 << 3,
  GuildIntegrations = 1 << 4,
  GuildWebhooks = 1 << 5,
  GuildInvites = 1 << 6,
  GuildVoiceStates = 1 << 7,
  GuildPresences = 1 << 8,
  GuildMessages = 1 << 9,
  GuildMessageReactions = 1 << 10,
  GuildMessageTyping = 1 << 11,
  DirectMessages = 1 << 12,
  DirectMessageReactions = 1 << 13,
  DirectMessageTyping = 1 << 14,
  MessageContent = 1 << 15,
  GuildScheduledEvents = 1 << 16,
  AutoModerationConfiguration = 1 << 20,
  AutoModerationExecution = 1 << 21,
  GuildMessagePolls = 1 << 24,
  DirectMessagePolls = 1 << 25,
}

/**
 * The levels of a markdown heading.
 */
export enum HeadingLevel {
  One = 1,
  Two = 2,
  Three = 3,
}

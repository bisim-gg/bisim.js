/**
 * bisim.js: the official Node.js library for Bisim bots, written the discord.js way.
 *
 * @packageDocumentation
 */

// Client
export { Client, BaseClient, ClientEmojiManager } from './client/Client.js';
export type { ClientOptions, BootstrapOptions, WebSocketOptions, InviteGenerationOptions, If, CacheFactory } from './client/Client.js';
export type { ClientEvents, MessageReactionEventDetails } from './client/ClientEvents.js';

// Gateway
export { WebSocketManager } from './gateway/WebSocketManager.js';
export { WebSocketShard, GatewayOpcodes, GatewayConnectError } from './gateway/WebSocketShard.js';
export type { GatewayFrame } from './gateway/WebSocketShard.js';

// Errors
export * from './errors/index.js';

// Utilities
export * from './util/Collection.js';
export * from './util/BitField.js';
export * from './util/PermissionsBitField.js';
export * from './util/IntentsBitField.js';
export * from './util/Enums.js';
export * from './util/Colors.js';
export * from './util/Events.js';
export * from './util/Formatters.js';
export * from './util/SnowflakeUtil.js';
export * from './util/Constants.js';
export * from './util/Options.js';
export {
  resolveColor,
  parseEmoji,
  verifyString,
  bisimSort,
  flatten,
  cleanContent,
  cleanCodeBlockContent,
  type ColorResolvable,
  type PartialEmoji,
} from './util/Util.js';
export {
  channelTypeFromBisim,
  channelTypeToBisim,
  optionTypeFromBisim,
  optionTypeToBisim,
  toBisimCommand,
  toBisimComponent,
} from './util/Transformers.js';

// REST
export * from './rest/types.js';
export * from './rest/errors.js';
export { Routes, OAuth2Routes } from './rest/Routes.js';
export { REST, DefaultRestOptions, parseResponse, type UploadedAttachment, type RateLimitBucket } from './rest/REST.js';

// Builders
export * from './builders/SlashCommandBuilder.js';
export * from './builders/ContextMenuCommandBuilder.js';
export { EmbedBuilder } from './builders/EmbedBuilder.js';
export type { APIEmbed, APIEmbedAuthor, APIEmbedField, APIEmbedFooter, APIEmbedImage, EmbedAuthorOptions, EmbedFooterOptions } from './builders/EmbedBuilder.js';
export * from './builders/components.js';
export * from './builders/AttachmentBuilder.js';

// Managers
export { BaseManager, DataManager, CachedManager } from './managers/BaseManager.js';
export * from './managers/ApplicationCommandManager.js';
export * from './managers/ChannelManager.js';
export * from './managers/GuildBanManager.js';
export * from './managers/GuildChannelManager.js';
export * from './managers/GuildExpressionManagers.js';
export * from './managers/GuildSoundboardSoundManager.js';
export * from './managers/AutoModerationRuleManager.js';
export * from './managers/GuildInviteManager.js';
export * from './managers/GuildManager.js';
export * from './managers/GuildMemberManager.js';
export * from './managers/GuildMemberRoleManager.js';
export * from './managers/MessageManager.js';
export * from './managers/PermissionOverwriteManager.js';
export * from './managers/ReactionManager.js';
export * from './managers/ReactionUserManager.js';
export * from './managers/RoleManager.js';
export * from './managers/UserManager.js';
export * from './managers/VoiceStateManager.js';
export * from './client/voice/ClientVoiceManager.js';

// Structures
export { Base } from './structures/Base.js';
export * from './structures/ApplicationCommand.js';
export * from './structures/Attachment.js';
export { AutoModerationActionExecution, AutoModerationRule } from './structures/AutoModeration.js';
export type {
  AutoModerationAction,
  AutoModerationActionMetadata,
  AutoModerationTriggerMetadata,
  RawAutoModerationActionExecutionData,
  RawAutoModerationRuleData,
} from './structures/AutoModeration.js';
export * from './structures/ClientApplication.js';
export * from './structures/ClientUser.js';
export * from './structures/Collectors.js';
export * from './structures/Component.js';
export { Embed } from './structures/Embed.js';
export { Emoji, GuildEmoji, ReactionEmoji, Sticker } from './structures/Emoji.js';
export * from './structures/Guild.js';
export * from './structures/GuildAuditLogs.js';
export * from './structures/GuildBan.js';
export * from './structures/GuildMember.js';
export * from './structures/Invite.js';
export * from './structures/Message.js';
export * from './structures/MessageMentions.js';
export * from './structures/MessagePayload.js';
export * from './structures/MessageReaction.js';
export * from './structures/PermissionOverwrites.js';
export * from './structures/Poll.js';
export { Activity, ClientPresence, Presence } from './structures/Presence.js';
export type {
  ActivitiesOptions,
  ActivityOptions,
  ActivityData,
  PresenceData,
  PresenceStatus,
  PresenceStatusData,
  PresenceUpdateData,
} from './structures/Presence.js';
export * from './structures/Role.js';
export * from './structures/SoundboardSound.js';
export * from './structures/Typing.js';
export * from './structures/User.js';
export * from './structures/VoiceState.js';
export * from './structures/Webhook.js';
export { BaseChannel } from './structures/channels/BaseChannel.js';
export { GuildChannel, type InviteCreateOptions } from './structures/channels/GuildChannel.js';
export { TextChannel } from './structures/channels/TextChannel.js';
export { VoiceChannel } from './structures/channels/VoiceChannel.js';
export { CategoryChannel, CategoryChannelChildManager } from './structures/channels/CategoryChannel.js';
export { DMChannel, PartialGroupDMChannel } from './structures/channels/DMChannel.js';
export type { TextBasedChannelFields, ChannelWebhookCreateOptions } from './structures/channels/TextBasedChannel.js';
export type * from './structures/channels/index.js';

// Interactions
export * from './interactions/BaseInteraction.js';
export * from './interactions/CommandInteraction.js';
export * from './interactions/CommandInteractionOptionResolver.js';
export * from './interactions/AutocompleteInteraction.js';
export * from './interactions/MessageComponentInteraction.js';
export * from './interactions/ModalSubmitInteraction.js';
export * from './interactions/InteractionResponse.js';
export type { InteractionDeferReplyOptions, InteractionDeferUpdateOptions } from './interactions/InteractionResponses.js';
export { verifyKey, verifyKeySync } from './interactions/verifyKey.js';
export type { ImageResolvable } from './util/images.js';

// Raw Bisim data
export type * from './types/raw.js';

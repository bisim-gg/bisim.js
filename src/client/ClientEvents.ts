import type { BaseInteraction } from '../interactions/BaseInteraction.js';
import type { Channel, TextBasedChannel } from '../structures/channels/index.js';
import type { GuildEmoji, Sticker } from '../structures/Emoji.js';
import type { Guild } from '../structures/Guild.js';
import type { GuildMember } from '../structures/GuildMember.js';
import type { Message } from '../structures/Message.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import type { PollAnswer } from '../structures/Poll.js';
import type { Presence } from '../structures/Presence.js';
import type { Role } from '../structures/Role.js';
import type { Typing } from '../structures/Typing.js';
import type { User } from '../structures/User.js';
import type { VoiceState } from '../structures/VoiceState.js';
import type { VoiceServerUpdateData } from './voice/ClientVoiceManager.js';
import type { Collection } from '../util/Collection.js';
import type { ReactionType } from '../util/Enums.js';
import type { Client } from './Client.js';

/**
 * Details of a reaction event.
 */
export interface MessageReactionEventDetails {
  type: ReactionType;
  burst: boolean;
}

/**
 * The events a {@link Client} emits and their arguments, with discord.js's names.
 */
export interface ClientEvents {
  channelCreate: [channel: Channel];
  channelDelete: [channel: Channel];
  channelPinsUpdate: [channel: TextBasedChannel, date: Date];
  channelUpdate: [oldChannel: Channel, newChannel: Channel];
  clientReady: [client: Client<true>];
  ready: [client: Client<true>];
  debug: [message: string];
  warn: [message: string];
  error: [error: Error];
  emojiCreate: [emoji: GuildEmoji];
  emojiDelete: [emoji: GuildEmoji];
  emojiUpdate: [oldEmoji: GuildEmoji, newEmoji: GuildEmoji];
  guildCreate: [guild: Guild];
  guildDelete: [guild: Guild];
  guildUpdate: [oldGuild: Guild, newGuild: Guild];
  guildUnavailable: [guild: Guild];
  guildMemberAdd: [member: GuildMember];
  guildMemberAvailable: [member: GuildMember];
  guildMemberRemove: [member: GuildMember];
  guildMemberUpdate: [oldMember: GuildMember, newMember: GuildMember];
  roleCreate: [role: Role];
  roleDelete: [role: Role];
  roleUpdate: [oldRole: Role, newRole: Role];
  stickerCreate: [sticker: Sticker];
  stickerDelete: [sticker: Sticker];
  stickerUpdate: [oldSticker: Sticker, newSticker: Sticker];
  interactionCreate: [interaction: BaseInteraction];
  invalidated: [];
  messageCreate: [message: Message];
  messageDelete: [message: Message];
  messageDeleteBulk: [messages: Collection<string, Message>, channel: TextBasedChannel];
  messageUpdate: [oldMessage: Message, newMessage: Message];
  messageReactionAdd: [reaction: MessageReaction, user: User, details: MessageReactionEventDetails];
  messageReactionRemove: [reaction: MessageReaction, user: User, details: MessageReactionEventDetails];
  messageReactionRemoveAll: [message: Message, reactions: Collection<string, MessageReaction>];
  messagePollVoteAdd: [pollAnswer: PollAnswer | { id: number; poll: null; partial: true }, userId: string];
  messagePollVoteRemove: [pollAnswer: PollAnswer | { id: number; poll: null; partial: true }, userId: string];
  presenceUpdate: [oldPresence: Presence | null, newPresence: Presence];
  raw: [packet: { op: number; t?: string; d?: unknown }];
  shardDisconnect: [closeEvent: { code: number; reason: string; wasClean: boolean }, shardId: number];
  shardError: [error: Error, shardId: number];
  shardReady: [shardId: number, unavailableGuilds: Set<string> | undefined];
  shardReconnecting: [shardId: number];
  shardResume: [shardId: number, replayedEvents: number];
  typingStart: [typing: Typing];
  userUpdate: [oldUser: User, newUser: User];
  voiceServerUpdate: [data: VoiceServerUpdateData];
  voiceStateUpdate: [oldState: VoiceState, newState: VoiceState];
}

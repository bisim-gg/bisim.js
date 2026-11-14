import type { Client } from '../client/Client.js';
import { createInteraction } from '../interactions/createInteraction.js';
import type { TextBasedChannel } from '../structures/channels/index.js';
import { GuildChannel } from '../structures/channels/GuildChannel.js';
import { emojiFromBisim } from '../structures/Emoji.js';
import type { Guild } from '../structures/Guild.js';
import { GuildMember } from '../structures/GuildMember.js';
import { Message } from '../structures/Message.js';
import type { MessageReaction } from '../structures/MessageReaction.js';
import { presenceFromBisim } from '../structures/Presence.js';
import { Typing } from '../structures/Typing.js';
import type { User } from '../structures/User.js';
import { VoiceState } from '../structures/VoiceState.js';
import type { RawInteractionData, RawMessageData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { Partials, ReactionType } from '../util/Enums.js';
import { Events } from '../util/Events.js';
import {
  normalizeChannelUpdate,
  normalizeEmoji,
  normalizeGuildUpdate,
  normalizeMember,
  normalizeMessage,
  normalizePresence,
  normalizeRole,
  normalizeUser,
  normalizeVoiceState,
} from './normalize.js';

/**
 * The `d` of a dispatch: Bisim's whole event envelope.
 */
export interface DispatchEnvelope {
  type: string;
  guildId?: string;
  userId?: string;
  channelId?: string;
  [payloadKey: string]: any;
}

/**
 * A handler for one Bisim event.
 */
export type DispatchHandler = (client: Client<true>, d: DispatchEnvelope) => void;

const hasPartial = (client: Client, partial: Partials) => client.options.partials?.includes(partial) ?? false;

function textChannel(client: Client<true>, channelId: string, guildId: string | null | undefined, author?: { id: string } | null): TextBasedChannel | null {
  const cached = client.channels.cache.get(channelId);
  if (cached) return 'messages' in cached ? (cached as TextBasedChannel) : null;
  if (guildId) {
    // A channel the bot has not heard of yet: load the server again so it appears.
    if (client.guilds.cache.has(guildId)) client.ws.queueResync(guildId);
    return null;
  }
  const participants = author && author.id !== client.user.id ? [author as never] : undefined;
  return client.channels._add({ id: channelId, type: 'DM', participants }, null) as TextBasedChannel;
}

function partialMessage(client: Client<true>, channel: TextBasedChannel, id: string, guildId?: string | null): Message {
  return channel.messages._add({ id, channelId: channel.id, guildId: guildId ?? undefined } as RawMessageData);
}

function resolveUser(client: Client<true>, userId: string): User | null {
  const cached = client.users.cache.get(userId);
  if (cached) return cached;
  return hasPartial(client, Partials.User) ? client.users._add({ id: userId } as never) : null;
}

function guildOf(client: Client<true>, d: DispatchEnvelope, inner?: { guildId?: string }): Guild | null {
  const id = d.guildId || inner?.guildId;
  return id ? (client.guilds.cache.get(id) ?? null) : null;
}

/**
 * What each Bisim event does to the caches, and which discord.js event it becomes.
 *
 * @internal
 */
export const handlers: Record<string, DispatchHandler> = {
  MESSAGE_CREATE(client, d) {
    if (!d.message) return;
    const raw = normalizeMessage(d.message, d.guildId);
    const channel = textChannel(client, raw.channelId, raw.guildId, raw.author);
    if (!channel) return;
    const message = channel.messages._add(raw);
    channel.lastMessageId = message.id;
    client.emit(Events.MessageCreate, message);
  },

  MESSAGE_UPDATE(client, d) {
    if (!d.message) return;
    const raw = normalizeMessage(d.message, d.guildId);
    const channel = textChannel(client, raw.channelId, raw.guildId, raw.author);
    if (!channel) return;
    const existing = channel.messages.cache.get(raw.id);
    if (existing && !existing.partial) {
      const old = existing._update(raw);
      client.emit(Events.MessageUpdate, old, existing);
      return;
    }
    if (!hasPartial(client, Partials.Message)) {
      if (existing) existing._patch(raw);
      return;
    }
    const old = existing ?? new Message(client, { id: raw.id, channelId: raw.channelId, guildId: raw.guildId } as RawMessageData);
    const message = channel.messages._add(raw);
    client.emit(Events.MessageUpdate, old, message);
  },

  MESSAGE_DELETE(client, d) {
    const data = d.messageDelete;
    if (!data) return;
    const channel = client.channels.cache.get(data.channelId) as TextBasedChannel | undefined;
    if (!channel || !('messages' in channel)) return;
    let message = channel.messages.cache.get(data.id);
    if (message) {
      channel.messages.cache.delete(data.id);
    } else if (hasPartial(client, Partials.Message)) {
      message = new Message(client, { id: data.id, channelId: data.channelId, guildId: data.guildId || d.guildId } as RawMessageData);
    }
    if (!message) return;
    message.deleted = true;
    client.emit(Events.MessageDelete, message);
  },

  MESSAGE_DELETE_BULK(client, d) {
    const data = d.messageDeleteBulk;
    if (!data) return;
    const channel = client.channels.cache.get(data.channelId) as TextBasedChannel | undefined;
    if (!channel || !('messages' in channel)) return;
    const deleted = new Collection<string, Message>();
    for (const id of data.ids ?? []) {
      let message = channel.messages.cache.get(id);
      if (message) channel.messages.cache.delete(id);
      else if (hasPartial(client, Partials.Message)) {
        message = new Message(client, { id, channelId: data.channelId, guildId: data.guildId || d.guildId } as RawMessageData);
      }
      if (message) {
        message.deleted = true;
        deleted.set(id, message);
      }
    }
    if (deleted.size) client.emit(Events.MessageBulkDelete, deleted, channel);
  },

  MESSAGE_REACTION_ADD(client, d) {
    const data = d.reaction;
    if (!data) return;
    const channel = textChannel(client, data.channelId, data.guildId || d.guildId, null);
    if (!channel) return;
    const message = channel.messages.cache.get(data.messageId) ?? (hasPartial(client, Partials.Message) ? partialMessage(client, channel, data.messageId, data.guildId) : null);
    if (!message) return;
    const user = resolveUser(client, data.userId);
    if (!user) return;
    const parsed = emojiFromBisim(data.emoji);
    const reaction: MessageReaction = message.reactions.cache.get(parsed.id ?? parsed.name) ?? message.reactions._add({ emoji: data.emoji, count: 0, me: false });
    reaction._add(user);
    client.emit(Events.MessageReactionAdd, reaction, user, { type: ReactionType.Normal, burst: false });
  },

  MESSAGE_REACTION_REMOVE(client, d) {
    const data = d.reaction;
    if (!data) return;
    const channel = textChannel(client, data.channelId, data.guildId || d.guildId, null);
    if (!channel) return;
    const message = channel.messages.cache.get(data.messageId) ?? (hasPartial(client, Partials.Message) ? partialMessage(client, channel, data.messageId, data.guildId) : null);
    if (!message) return;
    const user = resolveUser(client, data.userId);
    if (!user) return;
    const parsed = emojiFromBisim(data.emoji);
    const key = parsed.id ?? parsed.name;
    const reaction = message.reactions.cache.get(key) ?? (hasPartial(client, Partials.Reaction) ? message.reactions._add({ emoji: data.emoji, count: 1, me: false }) : null);
    if (!reaction) return;
    reaction._remove(user);
    if (reaction.count === 0) message.reactions.cache.delete(key);
    client.emit(Events.MessageReactionRemove, reaction, user, { type: ReactionType.Normal, burst: false });
  },

  MESSAGE_REACTION_REMOVE_ALL(client, d) {
    const data = d.reactionRemoveAll;
    if (!data) return;
    const channel = textChannel(client, data.channelId, data.guildId || d.guildId, null);
    if (!channel) return;
    const message = channel.messages.cache.get(data.messageId) ?? (hasPartial(client, Partials.Message) ? partialMessage(client, channel, data.messageId, data.guildId) : null);
    if (!message) return;
    const removed = message.reactions.cache.clone();
    message.reactions.cache.clear();
    client.emit(Events.MessageReactionRemoveAll, message, removed);
  },

  MESSAGE_POLL_VOTE(client, d) {
    const data = d.pollVote;
    if (!data) return;
    const channel = client.channels.cache.get(data.channelId) as TextBasedChannel | undefined;
    const message = channel && 'messages' in channel ? channel.messages.cache.get(data.messageId) : undefined;
    const counts = new Map<number, number>((data.counts ?? []).map((count: { answerId?: number; count?: number }) => [count.answerId ?? 0, count.count ?? 0]));
    const added: number[] = [];
    const removed: number[] = [];
    if (message?.poll) {
      for (const answer of message.poll.answers.values()) {
        const next = counts.get(answer.id) ?? 0;
        if (next > answer.voteCount) added.push(answer.id);
        else if (next < answer.voteCount) removed.push(answer.id);
      }
      message.poll._patch({ counts: [...counts].map(([answerId, count]) => ({ answerId, count })), total: data.total ?? 0 });
    } else {
      added.push(...((data.answerIds ?? []) as number[]));
    }
    for (const answerId of added) {
      const answer = message?.poll?.answers.get(answerId) ?? { id: answerId, poll: null, partial: true as const };
      client.emit(Events.MessagePollVoteAdd, answer, data.userId);
    }
    for (const answerId of removed) {
      const answer = message?.poll?.answers.get(answerId) ?? { id: answerId, poll: null, partial: true as const };
      client.emit(Events.MessagePollVoteRemove, answer, data.userId);
    }
  },

  PINS_UPDATE(client, d) {
    const data = d.pinsUpdate;
    if (!data || !d.channelId) return;
    const channel = client.channels.cache.get(d.channelId) as TextBasedChannel | undefined;
    if (!channel) return;
    const message = 'messages' in channel ? channel.messages.cache.get(data.messageId) : undefined;
    if (message) message.pinned = Boolean(data.pinned);
    const now = new Date();
    if ('lastPinTimestamp' in channel) channel.lastPinTimestamp = now.getTime();
    client.emit(Events.ChannelPinsUpdate, channel, now);
  },

  TYPING_START(client, d) {
    const data = d.typing;
    if (!data) return;
    const channel = textChannel(client, data.channelId, data.guildId || d.guildId, { id: data.userId });
    if (!channel) return;
    const user = resolveUser(client, data.userId) ?? client.users._add({ id: data.userId } as never, false);
    const typing = new Typing(client, channel, user, {
      startedTimestamp: Number(data.timestamp) || Date.now(),
      guildId: data.guildId || d.guildId || null,
    });
    client.emit(Events.TypingStart, typing);
  },

  PRESENCE_UPDATE(client, d) {
    if (!d.presence) return;
    const raw = normalizePresence(d.presence);
    const guild = guildOf(client, d, { guildId: raw.guildId });
    if (!guild) return;
    const data = presenceFromBisim({ ...raw, guildId: guild.id });
    const existing = guild.presences.cache.get(raw.userId);
    const old = existing ? existing._clone() : null;
    if (old) old.activities = [...existing!.activities];
    const presence = guild.presences._add(data);
    if (old && old.equals(presence)) return;
    client.emit(Events.PresenceUpdate, old, presence);
  },

  PRESENCE_SYNC(client, d) {
    const guild = guildOf(client, d);
    if (!guild) return;
    for (const entry of d.presenceSync?.presences ?? []) {
      const raw = normalizePresence(entry);
      guild.presences._add(presenceFromBisim({ ...raw, guildId: guild.id }));
    }
  },

  GUILD_UPDATE(client, d) {
    if (!d.guildUpdate) return;
    const raw = normalizeGuildUpdate(d.guildUpdate);
    const guild = client.guilds.cache.get(raw.id || d.guildId!);
    if (!guild) return;
    const old = guild._update(raw);
    client.emit(Events.GuildUpdate, old, guild);
  },

  CHANNEL_UPDATE(client, d) {
    if (!d.channelUpdate) return;
    const raw = normalizeChannelUpdate(d.channelUpdate);
    const channel = client.channels.cache.get(raw.id);
    if (!channel) {
      if (d.guildId) client.ws.queueResync(d.guildId);
      return;
    }
    const old = channel._update(raw);
    client.emit(Events.ChannelUpdate, old, channel);
  },

  GUILD_ROLE_CREATE(client, d) {
    const guild = guildOf(client, d);
    if (!guild || !d.guildRole?.role) return;
    const role = guild.roles._add(normalizeRole(d.guildRole.role, guild.id));
    client.emit(Events.GuildRoleCreate, role);
  },

  GUILD_ROLE_UPDATE(client, d) {
    const guild = guildOf(client, d);
    if (!guild || !d.guildRole?.role) return;
    const raw = normalizeRole(d.guildRole.role, guild.id);
    const existing = guild.roles.cache.get(raw.id);
    if (!existing) {
      client.emit(Events.GuildRoleCreate, guild.roles._add(raw));
      return;
    }
    const old = existing._update(raw);
    client.emit(Events.GuildRoleUpdate, old, existing);
  },

  GUILD_ROLE_DELETE(client, d) {
    const guild = guildOf(client, d);
    const roleId = d.guildRoleDelete?.roleId;
    if (!guild || !roleId) return;
    const role = guild.roles.cache.get(roleId);
    if (!role) return;
    guild.roles.cache.delete(roleId);
    for (const member of guild.members.cache.values()) member._roles = member._roles.filter((id) => id !== roleId);
    client.emit(Events.GuildRoleDelete, role);
  },

  GUILD_ROLE_POSITIONS(client, d) {
    const guild = guildOf(client, d);
    if (!guild) return;
    for (const entry of d.guildRolePositions?.roles ?? []) {
      const role = guild.roles.cache.get(entry.id);
      if (!role) continue;
      const position = entry.position ?? 0;
      if (role.rawPosition === position) continue;
      const old = role._update({ position });
      client.emit(Events.GuildRoleUpdate, old, role);
    }
  },

  GUILD_MEMBER_ADD(client, d) {
    const guild = guildOf(client, d);
    if (!guild || !d.guildMember?.member) return;
    const raw = normalizeMember(d.guildMember.member, guild.id);
    if (raw.userId === client.user.id) {
      guild.members._add(raw);
      return;
    }
    const known = guild.members.cache.has(raw.userId);
    const member = guild.members._add(raw);
    if (!known) guild._countMember(1);
    client.emit(Events.GuildMemberAdd, member);
  },

  GUILD_MEMBER_UPDATE(client, d) {
    const guild = guildOf(client, d);
    if (!guild || !d.guildMember?.member) return;
    const raw = normalizeMember(d.guildMember.member, guild.id);
    const existing = guild.members.cache.get(raw.userId);
    if (existing) {
      const old = existing._update(raw);
      if (!existing.equals(old) || old.user?.username !== existing.user.username) client.emit(Events.GuildMemberUpdate, old, existing);
      return;
    }
    if (hasPartial(client, Partials.GuildMember)) {
      const old = new GuildMember(client, { userId: raw.userId, user: raw.user }, guild);
      const member = guild.members._add(raw);
      client.emit(Events.GuildMemberUpdate, old, member);
      return;
    }
    client.emit(Events.GuildMemberAvailable, guild.members._add(raw));
  },

  GUILD_MEMBER_REMOVE(client, d) {
    const guild = guildOf(client, d);
    const userId = d.guildMemberRemove?.userId ?? d.userId;
    if (!guild || !userId) return;
    let member = guild.members.cache.get(userId);
    if (member) guild.members.cache.delete(userId);
    else if (hasPartial(client, Partials.GuildMember)) member = new GuildMember(client, { userId }, guild);
    guild._countMember(-1);
    guild.presences.cache.delete(userId);
    guild.voiceStates.cache.delete(userId);
    if (member) client.emit(Events.GuildMemberRemove, member);
    if (userId === client.user.id) client.ws.queueResync(guild.id);
  },

  GUILD_EMOJI_CREATE(client, d) {
    const guild = guildOf(client, d);
    if (!guild || !d.emoji) return;
    const emoji = guild.emojis._add(normalizeEmoji(d.emoji));
    client.emit(Events.GuildEmojiCreate, emoji);
  },

  GUILD_EMOJI_DELETE(client, d) {
    const guild = guildOf(client, d);
    const id = d.emojiDelete?.emojiId;
    if (!guild || !id) return;
    const emoji = guild.emojis.cache.get(id);
    if (!emoji) return;
    guild.emojis.cache.delete(id);
    client.emit(Events.GuildEmojiDelete, emoji);
  },

  GUILD_STICKER_CREATE(client, d) {
    const guild = guildOf(client, d);
    if (!guild || !d.sticker) return;
    const sticker = guild.stickers._add(normalizeEmoji(d.sticker));
    client.emit(Events.GuildStickerCreate, sticker);
  },

  GUILD_STICKER_DELETE(client, d) {
    const guild = guildOf(client, d);
    const id = d.stickerDelete?.stickerId;
    if (!guild || !id) return;
    const sticker = guild.stickers.cache.get(id);
    if (!sticker) return;
    guild.stickers.cache.delete(id);
    client.emit(Events.GuildStickerDelete, sticker);
  },

  VOICE_STATE_UPDATE(client, d) {
    const guild = guildOf(client, d);
    if (!guild || !d.voiceState) return;
    const raw = normalizeVoiceState(d.voiceState, d.channelId ?? null, guild.id);
    const existing = guild.voiceStates.cache.get(raw.userId);
    const old = existing ? existing._clone() : new VoiceState(guild, { userId: raw.userId });
    const state = guild.voiceStates._add(raw);
    client.emit(Events.VoiceStateUpdate, old, state);
  },

  USER_UPDATE(client, d) {
    const data = d.userUpdate?.user;
    if (!data) return;
    const raw = normalizeUser(data);
    const existing = client.users.cache.get(raw.id) ?? (raw.id === client.user.id ? client.user : undefined);
    if (!existing) return;
    const old = existing._update(raw);
    if (!existing.equals(old)) client.emit(Events.UserUpdate, old, existing);
  },

  INTERACTION_CREATE(client, d) {
    const json = d.interaction?.payloadJson;
    if (!json) return;
    let payload: RawInteractionData;
    try {
      payload = JSON.parse(json) as RawInteractionData;
    } catch (error) {
      client._emitError(error);
      return;
    }
    client._dispatchInteraction(payload);
  },

  DM_CHANNEL_UPDATE(client) {
    void client.ws.refreshDMs();
  },

  RESUMED(client) {
    client.emit(Events.Debug, '[WS] RESUMED');
  },
};

/**
 * Builds an interaction and emits it.
 *
 * @internal
 */
export function emitInteraction(client: Client<true>, payload: RawInteractionData): void {
  const interaction = createInteraction(client, payload);
  client.emit(Events.InteractionCreate, interaction);
}

/**
 * Whether a channel belongs to a server (used when diffing).
 *
 * @internal
 */
export function isGuildChannel(channel: unknown): channel is GuildChannel {
  return channel instanceof GuildChannel;
}

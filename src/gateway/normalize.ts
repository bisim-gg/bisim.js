import type { RawAuditLogEntry } from '../structures/GuildAuditLogs.js';
import type { RawSoundboardSoundData } from '../structures/SoundboardSound.js';
import type {
  RawAttachmentData,
  RawChannelData,
  RawComponentData,
  RawEmbedData,
  RawEmojiData,
  RawGuildData,
  RawInviteData,
  RawMemberData,
  RawMessageData,
  RawPollData,
  RawPresenceData,
  RawRoleData,
  RawUserData,
  RawVoiceStateData,
} from '../types/raw.js';

/**
 * The gateway speaks proto3-JSON: values that equal their default (false, 0, "" and []) are left out, and
 * 64 bit numbers are strings. These functions put the defaults back, so the structures see the same shapes
 * the REST API sends.
 *
 * @packageDocumentation
 */

type Loose = Record<string, any>;

const orNull = (value: unknown): string | null => (typeof value === 'string' && value.length ? value : null);

/** A user from an event. */
export function normalizeUser(data: Loose): RawUserData {
  return {
    id: data.id,
    username: data.username ?? '',
    displayName: orNull(data.displayName),
    avatarKey: orNull(data.avatarKey),
    bot: Boolean(data.bot),
  };
}

function normalizeAttachment(data: Loose): RawAttachmentData {
  return {
    id: data.id,
    kind: data.kind || 'FILE',
    url: data.url ?? '',
    fileName: data.fileName ?? '',
    contentType: data.contentType ?? '',
    sizeBytes: Number(data.sizeBytes ?? 0),
    width: data.width || null,
    height: data.height || null,
    description: orNull(data.description),
    spoiler: Boolean(data.spoiler),
    blocked: Boolean(data.blocked),
    durationSecs: data.durationSecs || null,
    waveform: orNull(data.waveform),
    gif: Boolean(data.gif),
  };
}

function normalizeEmbed(data: Loose): RawEmbedData {
  return {
    url: data.url ?? '',
    type: data.type || 'rich',
    title: orNull(data.title),
    description: orNull(data.description),
    siteName: orNull(data.siteName),
    imageUrl: orNull(data.imageUrl),
    imageWidth: data.imageWidth || null,
    imageHeight: data.imageHeight || null,
    color: data.color || null,
    authorName: orNull(data.authorName),
    authorUrl: orNull(data.authorUrl),
    footerText: orNull(data.footerText),
    timestamp: orNull(data.timestamp),
    fields: (data.fields ?? []).map((field: Loose) => ({ name: field.name ?? '', value: field.value ?? '', inline: Boolean(field.inline) })),
  };
}

function normalizePoll(data: Loose): RawPollData {
  return {
    question: data.question ?? '',
    answers: (data.answers ?? []).map((answer: Loose) => ({ id: answer.id ?? 0, text: answer.text ?? '', emoji: orNull(answer.emoji) })),
    multiselect: Boolean(data.multiselect),
    expiresAt: orNull(data.expiresAt),
    endedAt: orNull(data.endedAt),
    counts: (data.counts ?? []).map((count: Loose) => ({ answerId: count.answerId ?? 0, count: count.count ?? 0 })),
    total: data.total ?? 0,
  };
}

function normalizeComponent(data: Loose): RawComponentData {
  const component: RawComponentData = { type: data.type ?? 0 };
  if (data.style) component.style = data.style;
  if (data.label) component.label = data.label;
  if (data.emoji) component.emoji = { id: orNull(data.emoji.id), name: orNull(data.emoji.name), animated: Boolean(data.emoji.animated) };
  if (data.customId) component.customId = data.customId;
  if (data.url) component.url = data.url;
  if (data.disabled) component.disabled = true;
  if (data.placeholder) component.placeholder = data.placeholder;
  if (data.minValues) component.minValues = data.minValues;
  if (data.maxValues) component.maxValues = data.maxValues;
  if (data.options?.length) {
    component.options = data.options.map((option: Loose) => ({
      label: option.label ?? '',
      value: option.value ?? '',
      description: option.description || undefined,
      emoji: option.emoji ? { id: orNull(option.emoji.id), name: orNull(option.emoji.name), animated: Boolean(option.emoji.animated) } : undefined,
      default: Boolean(option.default),
    }));
  }
  if (data.channelTypes?.length) component.channelTypes = data.channelTypes;
  if (data.defaultValues?.length) {
    component.defaultValues = data.defaultValues.map((value: Loose) => ({ id: value.id ?? '', type: value.type ?? '' }));
  }
  if (data.components) component.components = data.components.map((nested: Loose) => normalizeComponent(nested));
  return component;
}

/**
 * A message from MESSAGE_CREATE or MESSAGE_UPDATE. Reactions and the embedded replied message are not in
 * events, so they are left out (the cached message keeps its own).
 */
export function normalizeMessage(data: Loose, guildId?: string | null): RawMessageData {
  const author = data.author ? normalizeUser(data.author) : undefined;
  const message: RawMessageData = {
    id: data.id,
    channelId: data.channelId,
    guildId: orNull(data.guildId) ?? guildId ?? null,
    authorId: data.authorId ?? author?.id,
    type: data.type || 'DEFAULT',
    content: data.content ?? '',
    referencedMessageId: orNull(data.referencedMessageId),
    nonce: orNull(data.nonce),
    pinned: Boolean(data.pinned),
    editedAt: orNull(data.editedAt),
    createdAt: orNull(data.createdAt) ?? undefined,
    author,
    attachments: (data.attachments ?? []).map((attachment: Loose) => normalizeAttachment(attachment)),
    embeds: (data.embeds ?? []).map((embed: Loose) => normalizeEmbed(embed)),
    poll: data.poll ? normalizePoll(data.poll) : null,
    webhookId: orNull(data.webhookId),
    interaction: data.interaction ? { name: data.interaction.name ?? '', userId: data.interaction.userId ?? '', username: data.interaction.username ?? '' } : null,
    ephemeral: Boolean(data.ephemeral),
    components: (data.components ?? []).map((row: Loose) => normalizeComponent(row)),
    loading: Boolean(data.loading),
    flags: Number(data.flags ?? 0),
  };
  // The mention lists are left out when empty, and an older server never sends them (nor `member`): when
  // none of these is here, Message reads the mentions from the text instead.
  if ('mentions' in data || 'mentionRoleIds' in data || 'mentionEveryone' in data || 'member' in data) {
    message.mentions = (data.mentions ?? []).map((user: Loose) => normalizeUser(user));
    message.mentionRoleIds = data.mentionRoleIds ?? [];
    message.mentionEveryone = Boolean(data.mentionEveryone);
  }
  if (data.member) message.member = normalizeMember(data.member, message.guildId ?? undefined);
  return message;
}

/** A member from GUILD_MEMBER_ADD or GUILD_MEMBER_UPDATE. */
export function normalizeMember(data: Loose, guildId?: string): RawMemberData {
  return {
    guildId,
    userId: data.userId ?? data.user?.id,
    nickname: orNull(data.nickname),
    roleIds: data.roleIds ?? [],
    joinedAt: orNull(data.joinedAt),
    timeoutUntil: orNull(data.timeoutUntil),
    user: data.user ? normalizeUser(data.user) : undefined,
  };
}

/** A role from GUILD_ROLE_CREATE or GUILD_ROLE_UPDATE. */
export function normalizeRole(data: Loose, guildId?: string): RawRoleData {
  return {
    id: data.id,
    guildId,
    name: data.name ?? '',
    color: data.color ?? 0,
    position: data.position ?? 0,
    permissions: data.permissions || '0',
    hoist: Boolean(data.hoist),
    mentionable: Boolean(data.mentionable),
    isEveryone: Boolean(data.isEveryone),
  };
}

/** A channel from CHANNEL_UPDATE (the fields it carries, with their defaults). */
export function normalizeChannelUpdate(data: Loose): Partial<RawChannelData> & { id: string } {
  return {
    id: data.id,
    name: data.name ?? '',
    topic: orNull(data.topic),
    parentId: orNull(data.parentId),
    position: data.position ?? 0,
    nsfw: Boolean(data.nsfw),
    slowmodeSec: data.slowmodeSec ?? 0,
    permissionsSynced: Boolean(data.permissionsSynced),
  };
}

/** A whole channel from CHANNEL_CREATE or CHANNEL_DELETE, which carry its type and server too. */
export function normalizeChannel(data: Loose, guildId?: string): RawChannelData {
  return {
    ...normalizeChannelUpdate(data),
    guildId: orNull(data.guildId) ?? guildId ?? null,
    type: data.type || 'GUILD_TEXT',
  };
}

/** An invite from INVITE_CREATE (`maxAge` is in seconds, 0 for ever). */
export function normalizeInvite(data: Loose): RawInviteData {
  const inviter = data.inviter?.id ? normalizeUser(data.inviter) : null;
  return {
    code: data.code,
    guildId: data.guildId || undefined,
    channelId: orNull(data.channelId),
    inviter,
    inviterId: inviter?.id,
    maxUses: data.maxUses ?? 0,
    uses: data.uses ?? 0,
    maxAgeSec: data.maxAge ?? 0,
    createdAt: orNull(data.createdAt) ?? undefined,
    expiresAt: orNull(data.expiresAt),
  };
}

/** An audit log entry from GUILD_AUDIT_LOG_ENTRY_CREATE, in the shape REST gives it. */
export function normalizeAuditLogEntry(data: Loose): RawAuditLogEntry {
  let meta: Record<string, unknown> | null = null;
  if (data.metaJson) {
    try {
      const parsed: unknown = JSON.parse(data.metaJson);
      if (parsed && typeof parsed === 'object') meta = parsed as Record<string, unknown>;
    } catch {
      meta = null;
    }
  }
  const reason = orNull(data.reason);
  if (reason && meta?.reason === undefined) meta = { ...meta, reason };
  return {
    id: data.id,
    guildId: data.guildId || undefined,
    actorId: orNull(data.userId),
    action: data.action ?? '',
    targetType: orNull(data.targetType),
    targetId: orNull(data.targetId),
    meta,
    createdAt: data.createdAt ?? '',
    actor: null,
    target: null,
  };
}

/** A server from GUILD_UPDATE. */
export function normalizeGuildUpdate(data: Loose): Partial<RawGuildData> & { id: string } {
  return {
    id: data.id,
    name: data.name ?? '',
    iconKey: orNull(data.iconKey),
    bannerKey: orNull(data.bannerKey),
    splashKey: orNull(data.splashKey),
    description: orNull(data.description),
    ownerId: data.ownerId ?? undefined,
    verificationLevel: data.verificationLevel ?? 0,
    systemChannelId: orNull(data.systemChannelId),
    afkChannelId: orNull(data.afkChannelId),
    afkTimeout: data.afkTimeout ?? 300,
  };
}

/** A presence from PRESENCE_UPDATE or PRESENCE_SYNC. */
export function normalizePresence(data: Loose): RawPresenceData {
  return {
    userId: data.userId,
    guildId: data.guildId ?? '',
    status: data.status || 'offline',
    customText: data.customText ?? '',
    customEmoji: data.customEmoji ?? '',
    activityType: data.activityType ?? 0,
    activityName: data.activityName ?? '',
  };
}

/** A voice state from VOICE_STATE_UPDATE (the channel and server come from the envelope). */
export function normalizeVoiceState(data: Loose, channelId: string | null, guildId: string | null): RawVoiceStateData {
  return {
    userId: data.userId,
    guildId,
    channelId: data.left ? null : channelId,
    left: Boolean(data.left),
    user: data.user ? normalizeUser(data.user) : undefined,
    serverMuted: Boolean(data.serverMuted),
    serverDeafened: Boolean(data.serverDeafened),
    selfMuted: Boolean(data.selfMuted),
    selfDeafened: Boolean(data.selfDeafened),
    selfVideo: Boolean(data.selfVideo),
    selfStream: Boolean(data.selfStream),
  };
}

/** A soundboard sound from GUILD_SOUND_CREATE, GUILD_SOUND_UPDATE or SOUNDBOARD_PLAY (a volume of 0 is left out). */
export function normalizeSound(data: Loose): RawSoundboardSoundData {
  return {
    id: data.id,
    guildId: orNull(data.guildId) ?? undefined,
    name: data.name ?? '',
    objectKey: data.objectKey ?? '',
    emojiName: orNull(data.emojiName),
    volume: data.volume ?? 0,
    durationMs: data.durationMs ?? 0,
    creatorId: orNull(data.creatorId),
  };
}

/** An emoji or sticker from GUILD_EMOJI_CREATE or GUILD_STICKER_CREATE. */
export function normalizeEmoji(data: Loose): RawEmojiData {
  return {
    id: data.id,
    guildId: data.guildId ?? undefined,
    name: data.name ?? '',
    objectKey: data.objectKey ?? '',
    creatorId: orNull(data.creatorId),
  };
}

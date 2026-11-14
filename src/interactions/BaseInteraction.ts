import type { Client } from '../client/Client.js';
import { Base } from '../structures/Base.js';
import type { TextBasedChannel } from '../structures/channels/index.js';
import type { Guild } from '../structures/Guild.js';
import type { GuildMember } from '../structures/GuildMember.js';
import type { User } from '../structures/User.js';
import type { RawInteractionData, RawMemberData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { ApplicationCommandType, ComponentType, InteractionContextType, InteractionType } from '../util/Enums.js';
import { PermissionsBitField } from '../util/PermissionsBitField.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { commandTypeFromBisim, contextFromBisim } from '../util/Transformers.js';
import type { AutocompleteInteraction } from './AutocompleteInteraction.js';
import type { CommandInteraction } from './CommandInteraction.js';
import type { ChatInputCommandInteraction, ContextMenuCommandInteraction, MessageContextMenuCommandInteraction, UserContextMenuCommandInteraction } from './CommandInteraction.js';
import type { ButtonInteraction, ChannelSelectMenuInteraction, MentionableSelectMenuInteraction, MessageComponentInteraction, RoleSelectMenuInteraction, StringSelectMenuInteraction, UserSelectMenuInteraction } from './MessageComponentInteraction.js';
import type { ModalSubmitInteraction } from './ModalSubmitInteraction.js';
import { attachHidden, dateFrom } from '../util/internal.js';

function commandKind(interaction: BaseInteraction): ApplicationCommandType {
  return commandTypeFromBisim(interaction._raw.data?.type);
}

function componentKind(interaction: BaseInteraction): ComponentType {
  return interaction._raw.data?.componentType ?? ComponentType.Button;
}

/**
 * Whether an interaction's server is cached (`'cached'`), only known by id (`'raw'`), or neither.
 */
export type CacheType = 'cached' | 'raw' | undefined;

/**
 * Picks a type by the cache state, like discord.js's typings.
 */
export type CacheTypeReducer<State extends CacheType, CachedType, RawType = CachedType, PresentType = CachedType | RawType, Fallback = PresentType | null> =
  [State] extends ['cached'] ? CachedType : [State] extends ['raw'] ? RawType : [State] extends ['raw' | 'cached'] ? PresentType : Fallback;

/**
 * Something a user can answer to: a command, a component, or a modal submission.
 */
export type RepliableInteraction<Cached extends CacheType = CacheType> = CommandInteraction<Cached> | MessageComponentInteraction<Cached> | ModalSubmitInteraction<Cached>;

/**
 * Any select menu interaction.
 */
export type AnySelectMenuInteraction<Cached extends CacheType = CacheType> =
  | ChannelSelectMenuInteraction<Cached>
  | MentionableSelectMenuInteraction<Cached>
  | RoleSelectMenuInteraction<Cached>
  | StringSelectMenuInteraction<Cached>
  | UserSelectMenuInteraction<Cached>;

/**
 * The base of every interaction: a slash command, a context menu command, a button or select menu, an
 * autocomplete request or a modal submission.
 */
export class BaseInteraction<Cached extends CacheType = CacheType> extends Base {
  /** Brands the type so the cache guards narrow it (types only, nothing at runtime). */
  private declare readonly _cacheType: Cached;
  /** The id. */
  public id: string;
  /** The type. */
  public type: InteractionType;
  /** The token that answers it (valid for 15 minutes). */
  public declare readonly token: string;
  /** The application (the bot) it is for. */
  public applicationId: string;
  /** The channel it came from. */
  public channelId: string | null;
  /** The server it came from, or `null` in a DM. */
  public guildId: CacheTypeReducer<Cached, string, string, string, string | null>;
  /** Who ran it. */
  public user: User;
  /** Who ran it, as a member of the server, or `null` in a DM. */
  public member: CacheTypeReducer<Cached, GuildMember, GuildMember, GuildMember, GuildMember | null>;
  /** Always 1. */
  public version: number;
  /** The bot's own permissions in the channel. */
  public appPermissions: Readonly<PermissionsBitField>;
  /** Who ran it's permissions in the channel, or `null` in a DM. */
  public memberPermissions: CacheTypeReducer<Cached, Readonly<PermissionsBitField>, Readonly<PermissionsBitField>, Readonly<PermissionsBitField>, Readonly<PermissionsBitField> | null>;
  /** The language of who ran it (`fa` or `en` on Bisim). */
  public locale: string;
  /** The server's language (always `en-US` on Bisim). */
  public guildLocale: CacheTypeReducer<Cached, string, string, string, string | null>;
  /** Always empty on Bisim. */
  public entitlements: Collection<string, unknown>;
  /** Where it ran: a server or the bot's DMs. */
  public context: InteractionContextType | null;
  /** Always `{}` on Bisim (bots are installed in servers only). */
  public authorizingIntegrationOwners: Record<string, string>;
  /** The largest file the bot may upload in answer, in bytes. */
  public attachmentSizeLimit: number;
  /**
   * The payload as Bisim sent it.
   *
   * @internal
   */
  public declare readonly _raw: RawInteractionData;

  /**
   * @param client - The client
   * @param data - The interaction payload
   */
  public constructor(client: Client, data: RawInteractionData) {
    super(client);
    attachHidden(this, 'token', data.token);
    attachHidden(this, '_raw', data);
    this.id = data.id;
    this.type = data.type;
    this.applicationId = data.applicationId;
    this.channelId = data.channelId ?? null;
    this.guildId = (data.guildId || null) as never;
    this.version = data.version ?? 1;
    this.locale = data.locale ?? 'en-US';
    this.guildLocale = (this.guildId ? (data.guildLocale ?? 'en-US') : null) as never;
    this.entitlements = new Collection();
    this.authorizingIntegrationOwners = {};
    this.attachmentSizeLimit = 10 * 1024 * 1024;
    this.context =
      data.context !== undefined && data.context !== null
        ? contextFromBisim(data.context)
        : this.guildId
          ? InteractionContextType.Guild
          : InteractionContextType.BotDM;

    const rawMember = data.member ?? null;
    const userData = data.user ?? (rawMember
      ? { id: rawMember.userId, username: rawMember.username ?? '', displayName: rawMember.displayName ?? null, avatarKey: rawMember.avatarKey ?? null, bot: rawMember.bot }
      : null);
    this.user = userData ? client.users._add(userData) : client.users._add({ id: rawMember?.userId ?? '0', username: '' });

    const guild = this.guild;
    let member: GuildMember | null = null;
    if (guild && rawMember) {
      const memberData: RawMemberData = { userId: this.user.id, user: userData ?? undefined };
      if (rawMember.roleIds) memberData.roleIds = rawMember.roleIds;
      if ('nickname' in rawMember) memberData.nickname = rawMember.nickname;
      if (rawMember.joinedAt) memberData.joinedAt = rawMember.joinedAt;
      if ('timeoutUntil' in rawMember) memberData.timeoutUntil = rawMember.timeoutUntil;
      const cached = guild.members.cache.get(this.user.id);
      member = cached || rawMember.roleIds ? guild.members._add(memberData) : guild.members._add(memberData, false);
    }
    this.member = member as never;

    if (rawMember?.permissions !== undefined) {
      this.memberPermissions = new PermissionsBitField(BigInt(rawMember.permissions)).freeze() as never;
    } else if (member && this.channel && 'permissionsFor' in this.channel) {
      this.memberPermissions = ((this.channel as { permissionsFor(member: GuildMember): Readonly<PermissionsBitField> | null }).permissionsFor(member) ??
        member.permissions) as never;
    } else {
      this.memberPermissions = (member ? member.permissions : null) as never;
    }

    if (data.appPermissions !== undefined) this.appPermissions = new PermissionsBitField(BigInt(data.appPermissions)).freeze();
    else {
      const channel = this.channel as { _myPermissions?: bigint | null } | null;
      const fromChannel = channel?._myPermissions ?? null;
      this.appPermissions = new PermissionsBitField(fromChannel ?? guild?._myPermissions ?? PermissionsBitField.All).freeze();
    }

    if (!this.guildId && this.channelId && !client.channels.cache.has(this.channelId)) {
      client.channels._add({ id: this.channelId, type: 'DM', participants: [userData ?? { id: this.user.id, username: '' }] }, null);
    }
  }

  /**
   * When the interaction was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the interaction was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The channel it came from.
   */
  public get channel(): TextBasedChannel | null {
    return (this.channelId ? (this.client.channels.cache.get(this.channelId) ?? null) : null) as TextBasedChannel | null;
  }

  /**
   * The server it came from, or `null` in a DM.
   */
  public get guild(): CacheTypeReducer<Cached, Guild, null> {
    return (this.guildId ? (this.client.guilds.cache.get(this.guildId) ?? null) : null) as never;
  }

  /** Whether it came from a server. */
  public inGuild(): this is BaseInteraction<'cached' | 'raw'> {
    return Boolean(this.guildId);
  }

  /** Whether it came from a server the client has cached. */
  public inCachedGuild(): this is BaseInteraction<'cached'> {
    return Boolean(this.guildId && this.client.guilds.cache.has(this.guildId));
  }

  /** Whether it came from a server the client has not cached. */
  public inRawGuild(): this is BaseInteraction<'raw'> {
    return Boolean(this.guildId && !this.client.guilds.cache.has(this.guildId));
  }

  /** Whether this is a command (slash or context menu). */
  public isCommand(): this is CommandInteraction<Cached> {
    return isOfType(this, InteractionType.ApplicationCommand);
  }

  /** Whether this is a slash command. */
  public isChatInputCommand(): this is ChatInputCommandInteraction<Cached> {
    return this.isCommand() && commandKind(this) === ApplicationCommandType.ChatInput;
  }

  /** Whether this is a context menu command. */
  public isContextMenuCommand(): this is ContextMenuCommandInteraction<Cached> {
    return this.isCommand() && [ApplicationCommandType.User, ApplicationCommandType.Message].includes(commandKind(this));
  }

  /** Whether this is a user context menu command. */
  public isUserContextMenuCommand(): this is UserContextMenuCommandInteraction<Cached> {
    return this.isCommand() && commandKind(this) === ApplicationCommandType.User;
  }

  /** Whether this is a message context menu command. */
  public isMessageContextMenuCommand(): this is MessageContextMenuCommandInteraction<Cached> {
    return this.isCommand() && commandKind(this) === ApplicationCommandType.Message;
  }

  /** Always `false` on Bisim (no entry point commands). */
  public isPrimaryEntryPointCommand(): false {
    return false;
  }

  /** Whether this is an autocomplete request. */
  public isAutocomplete(): this is AutocompleteInteraction<Cached> {
    return isOfType(this, InteractionType.ApplicationCommandAutocomplete);
  }

  /** Whether this is a button or select menu interaction. */
  public isMessageComponent(): this is MessageComponentInteraction<Cached> {
    return isOfType(this, InteractionType.MessageComponent);
  }

  /** Whether this is a button press. */
  public isButton(): this is ButtonInteraction<Cached> {
    return this.isMessageComponent() && componentKind(this) === ComponentType.Button;
  }

  /** Whether this is any select menu. */
  public isAnySelectMenu(): this is AnySelectMenuInteraction<Cached> {
    return (
      this.isMessageComponent() &&
      [ComponentType.StringSelect, ComponentType.UserSelect, ComponentType.RoleSelect, ComponentType.MentionableSelect, ComponentType.ChannelSelect].includes(
        componentKind(this),
      )
    );
  }

  /**
   * Whether this is a string select menu.
   *
   * @deprecated Use {@link BaseInteraction.isStringSelectMenu}
   */
  public isSelectMenu(): this is StringSelectMenuInteraction<Cached> {
    return this.isStringSelectMenu();
  }

  /** Whether this is a string select menu. */
  public isStringSelectMenu(): this is StringSelectMenuInteraction<Cached> {
    return this.isMessageComponent() && componentKind(this) === ComponentType.StringSelect;
  }

  /** Whether this is a user select menu. */
  public isUserSelectMenu(): this is UserSelectMenuInteraction<Cached> {
    return this.isMessageComponent() && componentKind(this) === ComponentType.UserSelect;
  }

  /** Whether this is a role select menu. */
  public isRoleSelectMenu(): this is RoleSelectMenuInteraction<Cached> {
    return this.isMessageComponent() && componentKind(this) === ComponentType.RoleSelect;
  }

  /** Whether this is a user or role select menu. */
  public isMentionableSelectMenu(): this is MentionableSelectMenuInteraction<Cached> {
    return this.isMessageComponent() && componentKind(this) === ComponentType.MentionableSelect;
  }

  /** Whether this is a channel select menu. */
  public isChannelSelectMenu(): this is ChannelSelectMenuInteraction<Cached> {
    return this.isMessageComponent() && componentKind(this) === ComponentType.ChannelSelect;
  }

  /** Whether this is a modal submission. */
  public isModalSubmit(): this is ModalSubmitInteraction<Cached> {
    return isOfType(this, InteractionType.ModalSubmit);
  }

  /** Whether this interaction can be answered with a message. */
  public isRepliable(): this is RepliableInteraction<Cached> {
    return !isOfType(this, InteractionType.Ping) && !isOfType(this, InteractionType.ApplicationCommandAutocomplete);
  }

}

/** Whether an interaction is of the given kind. */
function isOfType(interaction: { type: InteractionType }, kind: InteractionType): boolean {
  return interaction.type === kind;
}

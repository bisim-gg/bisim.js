import type { Client } from '../client/Client.js';
import type { RawUserData } from '../types/raw.js';
import { Collection } from '../util/Collection.js';
import { flatten } from '../util/Util.js';
import type { Channel } from './channels/index.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { Message } from './Message.js';
import type { Role } from './Role.js';
import type { User } from './User.js';
import { attachHidden } from '../util/internal.js';

/**
 * Options for {@link MessageMentions.has}.
 */
export interface MessageMentionsHasOptions {
  ignoreDirect?: boolean;
  ignoreRoles?: boolean;
  ignoreRepliedUser?: boolean;
  ignoreEveryone?: boolean;
}

/**
 * The mention lists Bisim sends with a message: the people (whole on events, ids on REST), the roles, and
 * whether everyone is mentioned.
 */
export interface MessageMentionLists {
  users?: RawUserData[];
  userIds?: string[];
  roleIds?: string[];
  everyone?: boolean;
}

/**
 * Who and what a message mentions. Bisim sends the people, roles and `@everyone` with each message, worked
 * out from the text when it was written, so they are right even when the bot cannot read the text (no
 * Message Content intent). Without those lists (an older server, or a message the bot just sent) they are
 * read from the tokens in the text (`<@id>`, `<@&id>`, `@everyone`). Channels always come from the text.
 */
export class MessageMentions {
  /** Matches `@everyone` and `@here`. */
  public static EveryonePattern = /@(everyone|here)/;
  /** Matches a user mention. */
  public static UsersPattern = /<@!?(?<id>\d{1,20})>/;
  /** Matches a role mention. */
  public static RolesPattern = /<@&(?<id>\d{1,20})>/;
  /** Matches a channel mention. */
  public static ChannelsPattern = /<#(?<id>\d{1,20})>/;
  /** Matches every user mention. */
  public static GlobalUsersPattern = new RegExp(MessageMentions.UsersPattern.source, 'g');
  /** Matches every role mention. */
  public static GlobalRolesPattern = new RegExp(MessageMentions.RolesPattern.source, 'g');
  /** Matches every channel mention. */
  public static GlobalChannelsPattern = new RegExp(MessageMentions.ChannelsPattern.source, 'g');

  /** The client. */
  public declare readonly client: Client<true>;
  /** The server of the message, or `null` in a DM. */
  public declare readonly guild: Guild | null;
  /** The message. */
  public declare readonly message: Message;
  /** Whether `@everyone` (or `@here`) is mentioned. */
  public everyone: boolean;
  /** The users mentioned. */
  public users: Collection<string, User>;
  /** The roles mentioned. */
  public roles: Collection<string, Role>;
  /** Always empty on Bisim. */
  public crosspostedChannels: Collection<string, unknown> = new Collection();
  /** The author of the message this one replies to, or `null`. */
  public repliedUser: User | null;
  private _channels: Collection<string, Channel> | null = null;
  private _members: Collection<string, GuildMember> | null = null;
  private readonly content: string;

  /**
   * @param message - The message
   * @param repliedUser - The author of the message it replies to
   * @param lists - The mention lists Bisim sent, or `null` to read the mentions from the text
   */
  public constructor(message: Message, repliedUser?: RawUserData | null, lists?: MessageMentionLists | null) {
    attachHidden(this, 'client', message.client);
    attachHidden(this, 'guild', message.guild);
    attachHidden(this, 'message', message);
    this.content = message.content ?? '';
    const { users } = this.client;
    const known = (id: string) => users.cache.get(id) ?? users._add({ id } as RawUserData, false);
    let mentioned: User[];
    let roleIds: string[];
    if (lists) {
      this.everyone = Boolean(lists.everyone);
      mentioned = lists.users ? lists.users.map((user) => users._add(user)) : (lists.userIds ?? []).map(known);
      roleIds = lists.roleIds ?? [];
    } else {
      this.everyone = MessageMentions.EveryonePattern.test(this.content);
      mentioned = [...new Set(idsIn(this.content, MessageMentions.GlobalUsersPattern))].map(known);
      roleIds = idsIn(this.content, MessageMentions.GlobalRolesPattern);
    }
    this.users = new Collection(mentioned.map((user) => [user.id, user]));
    const roles = this.guild?.roles.cache;
    this.roles = new Collection(roles ? [...new Set(roleIds)].filter((id) => roles.has(id)).map((id) => [id, roles.get(id)!]) : []);
    this.repliedUser = repliedUser ? users._add(repliedUser) : null;
  }

  /**
   * The members mentioned, or `null` in a DM.
   */
  public get members(): Collection<string, GuildMember> | null {
    const { guild } = this;
    if (!guild) return null;
    this._members ??= this.users.mapValues((_user, id) => guild.members.cache.get(id)).filter((member): member is GuildMember => member !== undefined);
    return this._members;
  }

  /**
   * The channels mentioned (cached ones).
   */
  public get channels(): Collection<string, Channel> {
    if (this._channels === null) {
      const known = this.client.channels.cache;
      const found = idsIn(this.content, MessageMentions.GlobalChannelsPattern).filter((id) => known.has(id));
      this._channels = new Collection(found.map((id) => [id, known.get(id)!]));
    }
    return this._channels;
  }

  /**
   * The users whose tokens are in the text the bot can read (empty when it cannot read the text).
   */
  public get parsedUsers(): Collection<string, User> {
    const ids = new Set(idsIn(this.content, MessageMentions.GlobalUsersPattern));
    const { users } = this.client;
    return new Collection([...ids].map((id) => [id, this.users.get(id) ?? users.cache.get(id) ?? users._add({ id } as RawUserData, false)]));
  }

  /**
   * Whether a user, member, role or channel is mentioned.
   *
   * @param data - What to look for
   * @param options - What to ignore
   */
  public has(data: User | GuildMember | Role | Channel | string, options: MessageMentionsHasOptions = {}): boolean {
    const { ignoreDirect = false, ignoreRoles = false, ignoreRepliedUser = false, ignoreEveryone = false } = options;
    const id = typeof data === 'string' ? data : data.id;
    if (!ignoreEveryone && this.everyone) return true;
    if (!ignoreRepliedUser && this.repliedUser?.id === id && !this.users.has(id)) return true;
    if (!ignoreDirect) {
      if (this.users.has(id) || this.channels.has(id)) return true;
      if (this.roles.has(id)) return true;
    }
    if (!ignoreRoles && this.guild) {
      const member = this.guild.members.cache.get(id);
      if (member && member._roles.some((roleId) => this.roles.has(roleId))) return true;
    }
    return false;
  }

  /**
   * The mentions as a plain object.
   */
  public toJSON(): unknown {
    return flatten(this, { members: true, channels: true });
  }
}

/** The `id` group of every match of a mention pattern, in order. */
function idsIn(content: string, pattern: RegExp): string[] {
  return Array.from(content.matchAll(pattern), (match) => match.groups!.id!);
}

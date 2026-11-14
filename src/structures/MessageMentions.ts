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
 * Who and what a message mentions. On Bisim mentions live in the content as tokens (`<@id>`, `<@&id>`,
 * `<#id>`, `@everyone`), so they are read from there.
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
   */
  public constructor(message: Message, repliedUser?: RawUserData | null) {
    attachHidden(this, 'client', message.client);
    attachHidden(this, 'guild', message.guild);
    attachHidden(this, 'message', message);
    this.content = message.content ?? '';
    this.everyone = MessageMentions.EveryonePattern.test(this.content);
    const { users } = this.client;
    const userIds = new Set(idsIn(this.content, MessageMentions.GlobalUsersPattern));
    this.users = new Collection([...userIds].map((id) => [id, users.cache.get(id) ?? users._add({ id } as RawUserData, false)]));
    const roles = this.guild?.roles.cache;
    const roleIds = roles ? idsIn(this.content, MessageMentions.GlobalRolesPattern).filter((id) => roles.has(id)) : [];
    this.roles = new Collection(roleIds.map((id) => [id, roles!.get(id)!]));
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
   * The users mentioned in the content, the same as {@link MessageMentions.users} on Bisim.
   */
  public get parsedUsers(): Collection<string, User> {
    return this.users;
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

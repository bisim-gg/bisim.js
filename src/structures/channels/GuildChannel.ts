import type { Client } from '../../client/Client.js';
import type { GuildChannelCreateOptions, GuildChannelEditOptions, SetChannelPositionOptions } from '../../managers/GuildChannelManager.js';
import { PermissionOverwriteManager } from '../../managers/PermissionOverwriteManager.js';
import type { RawChannelData } from '../../types/raw.js';
import { Collection } from '../../util/Collection.js';
import { ChannelType } from '../../util/Enums.js';
import { PermissionFlagsBits, type PermissionResolvable, PermissionsBitField } from '../../util/PermissionsBitField.js';
import type { GuildMember } from '../GuildMember.js';
import type { Guild } from '../Guild.js';
import type { Invite } from '../Invite.js';
import type { PermissionOverwrites } from '../PermissionOverwrites.js';
import type { Role } from '../Role.js';
import type { User } from '../User.js';
import { BaseChannel } from './BaseChannel.js';
import type { CategoryChannel } from './CategoryChannel.js';
import { attachHidden } from '../../util/internal.js';

/**
 * Options for creating an invite.
 */
export interface InviteCreateOptions {
  /** How long the invite lasts, in seconds (0 for ever). */
  maxAge?: number;
  /** How many times it can be used (0 for no limit). */
  maxUses?: number;
  /** Not on Bisim. */
  temporary?: boolean;
  /** Accepted for compatibility: Bisim always makes a new invite. */
  unique?: boolean;
  /** Why (for the audit log). */
  reason?: string;
}

/**
 * Which channel types sort together in the channel list.
 */
function sortGroup(type: ChannelType): number {
  if (type === ChannelType.GuildCategory) return 2;
  if (type === ChannelType.GuildVoice || type === ChannelType.GuildStageVoice) return 1;
  return 0;
}

/**
 * The base of every channel in a server.
 */
export class GuildChannel extends BaseChannel {
  /** The server. */
  public declare readonly guild: Guild;
  /** The server's id. */
  public guildId: string;
  /** The name. */
  public name!: string;
  /** The position Bisim stores. */
  public rawPosition!: number;
  /** The category's id, or `null`. */
  public parentId!: string | null;
  /** Whether the channel copies its category's permissions. */
  public permissionsLocked!: boolean | null;
  /** The channel's permission overwrites (loaded with `permissionOverwrites.fetch()`). */
  public permissionOverwrites: PermissionOverwriteManager = new PermissionOverwriteManager(this);
  /** Whether the channel is age restricted. */
  public nsfw!: boolean;
  /** Whether `@everyone` cannot see the channel. */
  public isPrivate!: boolean;
  /**
   * The bot's own permissions in the channel, as Bisim computed them.
   *
   * @internal
   */
  public _myPermissions: bigint | null = null;

  /**
   * @param guild - The server
   * @param data - The channel from Bisim
   * @param client - The client
   */
  public constructor(guild: Guild, data: RawChannelData, client?: Client) {
    super(client ?? guild.client, data, false);
    attachHidden(this, 'guild', guild);
    this.guildId = guild.id;
    this.name = data.name ?? '';
    this.rawPosition = 0;
    this.parentId = null;
    this.permissionsLocked = null;
    this.nsfw = false;
    this.isPrivate = false;
    this._patch(data);
  }

  public override _patch(data: Partial<RawChannelData>): void {
    super._patch(data);
    if (data.name !== undefined && data.name !== null) this.name = data.name;
    if (data.position !== undefined) this.rawPosition = data.position;
    if ('parentId' in data) this.parentId = data.parentId || null;
    if (data.permissionsSynced !== undefined) this.permissionsLocked = Boolean(data.permissionsSynced);
    if (data.nsfw !== undefined) this.nsfw = Boolean(data.nsfw);
    if (data.isPrivate !== undefined) this.isPrivate = Boolean(data.isPrivate);
    if (data.permissions !== undefined) this._myPermissions = BigInt(data.permissions || '0');
    if (data.permissionOverwrites) {
      const overwrites = this.permissionOverwrites;
      overwrites.cache.clear();
      for (const raw of data.permissionOverwrites) overwrites._add(raw);
      overwrites.loaded = true;
    }
  }

  public override _clone(): this {
    const clone = super._clone();
    return clone;
  }

  /**
   * The category, or `null`.
   */
  public get parent(): CategoryChannel | null {
    return (this.parentId ? (this.guild.channels.cache.get(this.parentId) ?? null) : null) as CategoryChannel | null;
  }

  /**
   * The position of the channel in the list, among the channels it sorts with.
   */
  public get position(): number {
    const group = sortGroup(this.type);
    const isCategory = this.type === ChannelType.GuildCategory;
    const sitsAbove = (other: GuildChannel) =>
      other.rawPosition < this.rawPosition || (other.rawPosition === this.rawPosition && BigInt(other.id) < BigInt(this.id));
    const siblings = this.guild.channels.cache.filter(
      (other) => (other as GuildChannel) !== this && sortGroup(other.type) === group && (isCategory || other.parentId === this.parentId),
    );
    return siblings.filter((other) => sitsAbove(other as GuildChannel)).size;
  }

  /**
   * The overwrites that apply to a member: `@everyone`'s, their roles', and their own.
   *
   * @param member - The member
   * @param roles - The member's roles
   */
  public overwritesFor(member: GuildMember, _verified = false, roles: Collection<string, Role> | null = null): {
    everyone: PermissionOverwrites | undefined;
    roles: PermissionOverwrites[];
    member: PermissionOverwrites | undefined;
  } {
    const memberRoles = roles ?? member.roles.cache;
    const serverId = this.guild.id;
    const all = [...this.permissionOverwrites.cache.values()];
    const forRole = (overwrite: PermissionOverwrites) => overwrite.id !== serverId && memberRoles.has(overwrite.id);
    return {
      everyone: all.find((overwrite) => overwrite.id === serverId),
      roles: all.filter(forRole),
      member: all.find((overwrite) => overwrite.id === member.id && overwrite.id !== serverId && !forRole(overwrite)),
    };
  }

  /**
   * The permissions a member or role has in this channel, overwrites included. For the bot itself Bisim's
   * own computation is used; for others the overwrites must be loaded (`permissionOverwrites.fetch()`), or
   * only the role permissions count.
   *
   * @param memberOrRole - The member, user, role or id
   * @param checkAdmin - Whether administrator grants everything
   */
  public permissionsFor(memberOrRole: GuildMember | User | Role | string, checkAdmin = true): Readonly<PermissionsBitField> | null {
    const id = typeof memberOrRole === 'string' ? memberOrRole : memberOrRole.id;
    if (id === this.client.user?.id && this._myPermissions !== null) {
      return new PermissionsBitField(this._myPermissions).freeze();
    }
    const member = this.guild.members.resolve(memberOrRole as GuildMember | string);
    if (member !== null) return this.memberPermissions(member, checkAdmin);
    const role = this.guild.roles.resolve(memberOrRole as Role | string);
    return role === null ? null : this.rolePermissions(role, checkAdmin);
  }

  private memberPermissions(member: GuildMember, checkAdmin: boolean): Readonly<PermissionsBitField> {
    if (checkAdmin && member.id === this.guild.ownerId) return everyPermission();
    const memberRoles = member.roles.cache;
    const base = new PermissionsBitField(memberRoles.map((role) => role.permissions));
    if (checkAdmin && base.has(PermissionFlagsBits.Administrator, false)) return everyPermission();
    const { everyone, roles, member: own } = this.overwritesFor(member, true, memberRoles);
    const fromRoles = { allow: roles.map((overwrite) => overwrite.allow), deny: roles.map((overwrite) => overwrite.deny) };
    return withOverwrites(base, [everyone, fromRoles, own]);
  }

  private rolePermissions(role: Role, checkAdmin: boolean): Readonly<PermissionsBitField> {
    if (checkAdmin && role.permissions.has(PermissionFlagsBits.Administrator, false)) return everyPermission();
    const layers = [this.guild.id, role.id].map((id) => this.permissionOverwrites.cache.get(id));
    return withOverwrites(role.permissions, layers);
  }

  /**
   * The cached members who can see this channel.
   */
  public get members(): Collection<string, GuildMember> {
    return this.guild.members.cache.filter((member) => this.permissionsFor(member)?.has(PermissionFlagsBits.ViewChannel, false) ?? false);
  }

  /**
   * Whether the bot can see this channel.
   */
  public get viewable(): boolean {
    if (this.client.user.id === this.guild.ownerId) return true;
    return this.permissionsFor(this.client.user)?.has(PermissionFlagsBits.ViewChannel, false) ?? false;
  }

  /**
   * Whether the bot can manage this channel.
   */
  public get manageable(): boolean {
    if (this.client.user.id === this.guild.ownerId) return true;
    const mine = this.permissionsFor(this.client.user);
    if (mine === null) return false;
    return mine.has([PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ViewChannel], false) || mine.has(PermissionFlagsBits.Administrator, false);
  }

  /**
   * Whether the bot can delete this channel.
   */
  public get deletable(): boolean {
    return this.manageable && this.guild.systemChannelId !== this.id;
  }

  /**
   * Edits the channel.
   *
   * @param options - What to change
   */
  public edit(options: GuildChannelEditOptions): Promise<this> {
    return this.guild.channels.edit(this as never, options) as unknown as Promise<this>;
  }

  /**
   * Renames the channel.
   *
   * @param name - The new name
   * @param reason - Why
   */
  public setName(name: string, reason?: string): Promise<this> {
    return this.edit({ reason, name });
  }

  /**
   * Moves the channel to a category, or out of one with `null`.
   *
   * @param channel - The category
   * @param options - Whether to copy the category's permissions, and why
   */
  public setParent(channel: CategoryChannel | string | null, options: { lockPermissions?: boolean; reason?: string } = {}): Promise<this> {
    return this.edit({ parent: channel, lockPermissions: options.lockPermissions ?? true, reason: options.reason });
  }

  /**
   * Moves the channel in the list.
   *
   * @param position - The new position
   * @param options - Whether it is relative, and why
   */
  public async setPosition(position: number, options: SetChannelPositionOptions = {}): Promise<this> {
    await this.guild.channels.setPosition(this as never, position, options);
    return this;
  }

  /**
   * Copies the category's permissions to this channel.
   */
  public lockPermissions(): Promise<this> {
    return this.edit({ lockPermissions: true });
  }

  /**
   * Makes a new channel with the same settings.
   *
   * @param options - What to change in the copy
   */
  public async clone(options: Partial<GuildChannelCreateOptions> = {}): Promise<GuildChannel> {
    const overwrites = this.permissionOverwrites;
    if (!overwrites.loaded) await overwrites.fetch().catch(() => undefined);
    const { channels } = this.guild;
    return channels.create({
      name: this.name,
      type: this.type as GuildChannelCreateOptions['type'],
      parent: this.parentId,
      nsfw: this.nsfw,
      permissionOverwrites: [...overwrites.cache.values()],
      topic: (this as unknown as { topic?: string | null }).topic ?? undefined,
      rateLimitPerUser: (this as unknown as { rateLimitPerUser?: number }).rateLimitPerUser,
      ...options,
    });
  }

  /**
   * Deletes the channel.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<this> {
    const { channels } = this.guild;
    await channels.delete(this.id, reason);
    return this;
  }

  /**
   * Creates an invite to this channel.
   *
   * @param options - How long and how many uses
   */
  public createInvite(options: InviteCreateOptions = {}): Promise<Invite> {
    const { invites } = this.guild;
    return invites.create(this.id, options);
  }

  /**
   * Fetches the invites to this channel.
   *
   * @param cache - Whether to cache them
   */
  public async fetchInvites(cache = true): Promise<Collection<string, Invite>> {
    const invites = await this.guild.invites.fetch({ cache });
    return invites.filter((invite) => invite.channelId === this.id);
  }

  /**
   * Whether this channel is the same as another.
   *
   * @param channel - The other channel
   */
  public equals(channel: GuildChannel): boolean {
    return (
      channel &&
      this.id === channel.id &&
      this.type === channel.type &&
      this.name === channel.name &&
      this.rawPosition === channel.rawPosition &&
      this.parentId === channel.parentId
    );
  }
}

/** A frozen set holding every permission. */
function everyPermission(): Readonly<PermissionsBitField> {
  return new PermissionsBitField(PermissionsBitField.All).freeze();
}

/** Layers of overwrites applied in order over `base`: each layer's denials go first, then its grants. */
function withOverwrites(
  base: PermissionResolvable,
  layers: ({ allow: PermissionResolvable; deny: PermissionResolvable } | undefined)[],
): Readonly<PermissionsBitField> {
  const result = new PermissionsBitField(base);
  for (const layer of layers) {
    if (layer) result.remove(layer.deny).add(layer.allow);
  }
  return result.freeze();
}

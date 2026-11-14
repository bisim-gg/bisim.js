import type { Client } from '../client/Client.js';
import type { RawRoleData } from '../types/raw.js';
import { PermissionFlagsBits, PermissionsBitField } from '../util/PermissionsBitField.js';
import { SnowflakeUtil } from '../util/SnowflakeUtil.js';
import { notSupported } from '../util/Util.js';
import type { Collection } from '../util/Collection.js';
import { Base } from './Base.js';
import type { GuildChannel } from './channels/GuildChannel.js';
import type { Guild } from './Guild.js';
import type { GuildMember } from './GuildMember.js';
import type { RoleData, SetRolePositionOptions } from '../managers/RoleManager.js';
import { attachHidden, dateFrom } from '../util/internal.js';

/**
 * A role in a server.
 */
export class Role extends Base {
  /** The role's id. For `@everyone` it is the server's id. */
  public id: string;
  /** The server the role belongs to. */
  public declare readonly guild: Guild;
  /** The name. */
  public name!: string;
  /** The color, as a number (0 for none). */
  public color!: number;
  /** Whether members with the role are listed apart. */
  public hoist!: boolean;
  /** The position Bisim stores (higher is above). */
  public rawPosition!: number;
  /** The permissions the role grants. */
  public permissions!: Readonly<PermissionsBitField>;
  /** Whether the role belongs to a bot and is managed by Bisim. */
  public managed!: boolean;
  /** Whether everyone can mention the role. */
  public mentionable!: boolean;
  /** Always `null` on Bisim. */
  public icon: null = null;
  /** Always `null` on Bisim. */
  public unicodeEmoji: null = null;
  /** Always `null` on Bisim. */
  public tags: null = null;

  /**
   * @param client - The client
   * @param data - The role from Bisim
   * @param guild - The server
   */
  public constructor(client: Client, data: RawRoleData, guild: Guild) {
    super(client);
    attachHidden(this, 'guild', guild);
    this.id = data.id;
    this.name = '';
    this.color = 0;
    this.hoist = false;
    this.rawPosition = 0;
    this.permissions = new PermissionsBitField(0n).freeze();
    this.managed = false;
    this.mentionable = false;
    this._patch(data);
  }

  public override _patch(data: Partial<RawRoleData>): void {
    if (data.name !== undefined) this.name = data.name;
    if (data.color !== undefined) this.color = data.color ?? 0;
    if (data.hoist !== undefined) this.hoist = Boolean(data.hoist);
    if (data.position !== undefined) this.rawPosition = data.position;
    if (data.permissions !== undefined) this.permissions = new PermissionsBitField(BigInt(data.permissions || '0')).freeze();
    if (data.managed !== undefined) this.managed = Boolean(data.managed);
    if (data.mentionable !== undefined) this.mentionable = Boolean(data.mentionable);
  }

  /**
   * When the role was made, in milliseconds.
   */
  public get createdTimestamp(): number {
    return SnowflakeUtil.timestampFrom(this.id);
  }

  /**
   * When the role was made.
   */
  public get createdAt(): Date {
    return dateFrom(this.createdTimestamp);
  }

  /**
   * The color as a hex string, `#rrggbb`.
   */
  public get hexColor(): `#${string}` {
    return `#${this.color.toString(16).padStart(6, '0')}`;
  }

  /**
   * The cached members that have the role.
   */
  public get members(): Collection<string, GuildMember> {
    return this.guild.members.cache.filter((member) => member._roles.includes(this.id) || this.id === this.guild.id);
  }

  /**
   * Whether the bot can edit this role (it holds Manage Roles and sits above it).
   */
  public get editable(): boolean {
    if (this.managed === true) return false;
    const me = this.guild.members.me;
    if (!me) return false;
    if (this.guild.ownerId === me.id) return true;
    if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) return false;
    return me.roles.highest.comparePositionTo(this) > 0;
  }

  /**
   * The position of the role among the server's roles, counted from the bottom.
   */
  public get position(): number {
    let position = 0;
    for (const role of this.guild.roles.cache.values()) {
      if (role !== this && this.guild.roles.comparePositions(this, role) > 0) position++;
    }
    return position;
  }

  /**
   * Compares this role's position to another: positive when this one is higher.
   *
   * @param role - The other role
   */
  public comparePositionTo(role: Role | string): number {
    const { roles } = this.guild;
    return roles.comparePositions(this, role);
  }

  /**
   * Edits the role.
   *
   * @param data - What to change
   */
  public edit(data: RoleData & { reason?: string }): Promise<Role> {
    return this.guild.roles.edit(this, data);
  }

  /**
   * Deletes the role.
   *
   * @param reason - Why
   */
  public async delete(reason?: string): Promise<Role> {
    const { roles } = this.guild;
    await roles.delete(this.id, reason);
    return this;
  }

  /** Sets the name. */
  public setName(name: string, reason?: string): Promise<Role> {
    return this.edit({ reason, name });
  }

  /** Sets the color. */
  public setColor(color: RoleData['color'], reason?: string): Promise<Role> {
    return this.edit({ reason, color });
  }

  /** Sets whether members with the role are listed apart. */
  public setHoist(hoist = true, reason?: string): Promise<Role> {
    return this.edit({ reason, hoist });
  }

  /** Sets the permissions. */
  public setPermissions(permissions: RoleData['permissions'], reason?: string): Promise<Role> {
    return this.edit({ reason, permissions });
  }

  /** Sets whether everyone can mention the role. */
  public setMentionable(mentionable = true, reason?: string): Promise<Role> {
    return this.edit({ reason, mentionable });
  }

  /** Not on Bisim: role icons. */
  public setIcon(_icon: unknown, _reason?: string): Promise<Role> {
    return notSupported('Role icons');
  }

  /** Not on Bisim: role emoji. */
  public setUnicodeEmoji(_emoji: string | null, _reason?: string): Promise<Role> {
    return notSupported('Role emoji');
  }

  /**
   * Moves the role.
   *
   * @param position - The new position
   * @param options - Whether it is relative, and why
   */
  public setPosition(position: number, options: SetRolePositionOptions = {}): Promise<Role> {
    const { roles } = this.guild;
    return roles.setPosition(this, position, options);
  }

  /**
   * The permissions this role has in a channel, overwrites included.
   *
   * @param channel - The channel
   * @param checkAdmin - Whether administrator grants everything
   */
  public permissionsIn(channel: GuildChannel | string, checkAdmin = true): Readonly<PermissionsBitField> {
    const resolved = typeof channel === 'string' ? this.guild.channels.cache.get(channel) : channel;
    if (!resolved) throw new TypeError('Could not resolve the channel.');
    return resolved.permissionsFor(this, checkAdmin)!;
  }

  /**
   * Always `null` on Bisim (no role icons).
   */
  public iconURL(): null {
    return null;
  }

  /**
   * Whether this role is the same as another.
   *
   * @param role - The other role
   */
  public equals(role: Role): boolean {
    if (!role) return false;
    const fields = ['id', 'name', 'color', 'hoist', 'rawPosition', 'managed', 'mentionable'] as const;
    return this.permissions.equals(role.permissions) && fields.every((field) => this[field] === role[field]);
  }

  /**
   * The role as a mention: `<@&id>`, or `@everyone`.
   */
  public override toString(): string {
    return this.id === this.guild.id ? '@everyone' : `<@&${this.id}>`;
  }

  public override toJSON(...props: Record<string, boolean | string>[]): unknown {
    return { ...(super.toJSON({ createdTimestamp: true }, ...props) as object), permissions: this.permissions.bitfield.toString() };
  }
}
